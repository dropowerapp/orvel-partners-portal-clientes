"""Failure-path and real age round-trip tests; no production connections or data."""
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import urllib.parse
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('orvel-backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)
web_spec = importlib.util.spec_from_file_location('configure_web', Path(__file__).with_name('configure-web.py'))
configure_web = importlib.util.module_from_spec(web_spec)
web_spec.loader.exec_module(configure_web)
TOOLS = Path.home() / 'Library/Application Support/OrvelBackup/bin'
REF = 'a' * 20


class FakeStorage:
    change = False
    def __init__(self, *args):
        self.calls = 0
    def inventory(self):
        self.calls += 1
        return {'buckets': [{'id': 'documents', 'public': False}], 'objects': [{
            'bucket': 'documents', 'name': 'processo/ficheiro-fictício.pdf', 'id': 'fake-id',
            'updated_at': 'changed' if self.change and self.calls > 1 else 'stable',
            'metadata': {'size': len(b'%PDF-fixture-only')}}]}
    def download(self, item):
        return io.BytesIO(b'%PDF-fixture-only')


@unittest.skipUnless((TOOLS / 'age').exists(), 'Install the pinned age tools first')
class BackupTests(unittest.TestCase):
    def setUp(self):
        self.previous_umask = os.umask(0o077)
        self.temp = tempfile.TemporaryDirectory(prefix='orvel-backup-test-')
        self.root = Path(self.temp.name)
        self.base = self.root / 'control'
        self.dest = self.root / 'backups'
        self.repo = self.root / 'repository'
        for p in [self.base, self.base / 'bin', self.dest, self.repo]:
            p.mkdir(mode=0o700)
        for name in ['age', 'age-keygen']:
            (self.base / 'bin' / name).symlink_to(TOOLS / name)
        subprocess.run([str(TOOLS / 'age-keygen'), '-o', str(self.base / 'identity.agekey')],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.recipient = subprocess.check_output([str(TOOLS / 'age-keygen'), '-y',
            str(self.base / 'identity.agekey')], text=True).strip()
        backup.write_json(self.base / 'config.json', {'project_ref': REF,
            'destination': str(self.dest), 'source_repository': str(self.repo), 'recipient': self.recipient})
        backup.write_json(self.base / 'credentials.json', {
            'database_url': f'postgresql://postgres:fixture-only@db.{REF}.supabase.co:5432/postgres',
            'storage_key': 'sb_secret_' + 'x' * 40})

    def tearDown(self):
        self.temp.cleanup()
        os.umask(self.previous_umask)

    def run_fixture(self, export_failure=False, storage=FakeStorage):
        def export(command, output, env, base, recipient):
            if export_failure and output.name == 'schema.sql.age':
                raise backup.BackupError('Injected export failure')
            return backup.encrypt_stream(io.BytesIO(b'fictional SQL or source only'), output,
                                         base / 'bin/age', recipient)
        with patch.object(backup, 'preflight', return_value={'ready_for_first_backup': True}), \
             patch.object(backup, 'docker_binary', return_value='/usr/bin/true'), \
             patch.object(backup, 'Storage', storage), \
             patch.object(backup, 'export_command', side_effect=export), \
             patch.object(backup.subprocess, 'check_output', return_value='f' * 40 + '\n'):
            return backup.run_backup(self.base)

    def test_round_trip_has_all_export_parts_and_no_plaintext_files(self):
        result = self.run_fixture()
        folder = Path(result['backup'])
        self.assertTrue((folder / 'COMPLETE.json').exists())
        self.assertTrue(result['integrity_verified'])
        self.assertFalse(result['restore_test_completed'])
        self.assertEqual(result['files_verified'], 8)
        self.assertTrue((folder / 'managed_schema.sql.age').exists())
        self.assertTrue((folder / 'history_schema.sql.age').exists())
        self.assertTrue((folder / 'history_data.sql.age').exists())
        self.assertEqual(len(list(folder.glob('*.sql'))), 0)
        self.assertNotIn('processo', ' '.join(p.name for p in folder.iterdir()))
        manifest = backup.decrypt_manifest(folder, self.base)
        self.assertEqual(manifest['inventory']['objects'][0]['name'], 'processo/ficheiro-fictício.pdf')
        self.assertFalse((self.base / 'backup.lock').exists())

    def test_export_failure_never_marks_complete_and_keeps_partial(self):
        with self.assertRaises(backup.BackupError):
            self.run_fixture(export_failure=True)
        self.assertEqual(len(list(self.dest.glob('*.partial'))), 1)
        self.assertEqual(list(self.dest.glob('*/COMPLETE.json')), [])
        self.assertFalse((self.base / 'backup.lock').exists())

    def test_storage_change_fails_closed(self):
        class ChangingStorage(FakeStorage):
            change = True
        with self.assertRaisesRegex(backup.BackupError, 'mudou'):
            self.run_fixture(storage=ChangingStorage)
        self.assertEqual(list(self.dest.glob('*/COMPLETE.json')), [])

    def test_corrupted_ciphertext_is_detected(self):
        folder = Path(self.run_fixture()['backup'])
        with (folder / 'data.sql.age').open('ab') as stream:
            stream.write(b'corruption')
        with self.assertRaisesRegex(backup.BackupError, 'integridade'):
            backup.verify(folder, self.base)

    def test_second_run_keeps_first_copy(self):
        first = Path(self.run_fixture()['backup'])
        checksum = backup.file_hash(first / 'data.sql.age')
        second = Path(self.run_fixture()['backup'])
        self.assertNotEqual(first, second)
        self.assertEqual(backup.file_hash(first / 'data.sql.age'), checksum)
        self.assertTrue((first / 'COMPLETE.json').exists())

    def test_existing_lock_stops_concurrent_run(self):
        (self.base / 'backup.lock').mkdir()
        with self.assertRaisesRegex(backup.BackupError, 'bloqueio'):
            self.run_fixture()
        self.assertTrue((self.base / 'backup.lock').exists())

    def test_credentials_require_private_permissions(self):
        path = self.base / 'credentials.json'
        path.chmod(0o644)
        with self.assertRaises(backup.BackupError):
            backup.private_file(path)

    def test_database_connection_never_places_password_in_command_url(self):
        uri, password = backup.database_connection(
            f'postgresql://postgres.{REF}:abc%40xyz@aws-1-eu-west-1.pooler.supabase.com:5432/postgres', REF)
        self.assertEqual(password, 'abc@xyz')
        self.assertNotIn('abc', uri)
        self.assertIn('sslmode=require', uri)

    def test_wrong_project_and_transaction_pooler_are_rejected(self):
        for uri in [f'postgresql://postgres:pw@db.{"b"*20}.supabase.co:5432/postgres',
                    f'postgresql://postgres.{REF}:pw@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
                    'postgresql://postgres:pw@unrelated.example:5432/postgres']:
            with self.assertRaises(backup.BackupError):
                backup.database_connection(uri, REF)

    def test_separate_password_preserves_special_characters(self):
        endpoint = f'postgresql://postgres.{REF}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'
        password = 'fake@:/?#% +\\á$()'
        stored = backup.database_url_with_password(endpoint, password, REF)
        public, recovered = backup.database_connection(stored, REF)
        self.assertEqual(recovered, password)
        self.assertNotIn(password, stored)
        self.assertNotIn(password, public)

    def test_separate_password_rejects_wrong_project_and_embedded_password(self):
        for endpoint in [f'postgresql://postgres:old@db.{REF}.supabase.co:5432/postgres',
                         f'postgresql://postgres@db.{"b"*20}.supabase.co:5432/postgres']:
            with self.assertRaises(backup.BackupError):
                backup.database_url_with_password(endpoint, 'fixture-only', REF)

    def web_fixture(self):
        config = backup.load_config(self.base)
        config['database_endpoint'] = f'postgresql://postgres@db.{REF}.supabase.co:5432/postgres'
        origin = 'http://127.0.0.1:12345'
        headers = {'Host': '127.0.0.1:12345', 'Origin': origin, 'Sec-Fetch-Site': 'same-origin',
                   'Content-Type': 'application/x-www-form-urlencoded'}
        body = urllib.parse.urlencode({'csrf': 'fixture-token', 'password': 'fake@password%',
                                      'key': 'sb_secret_' + 'x' * 40}).encode()
        return config, headers, origin, body

    def test_web_form_saves_privately_without_exposing_credentials(self):
        config, headers, origin, body = self.web_fixture()
        path = self.base / 'credentials.json'
        path.unlink()  # Fictitious fixture only.
        configure_web.save_submission(self.base, config, headers, origin, 'fixture-token', body)
        self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        stored = json.loads(path.read_text())
        _, password = backup.database_connection(stored['database_url'], REF)
        self.assertEqual(password, 'fake@password%')
        self.assertNotIn(b'fake@password', configure_web.page('fixture-token', success=True))

    def test_web_form_rejects_cross_origin_and_rebinding(self):
        config, headers, origin, body = self.web_fixture()
        before = (self.base / 'credentials.json').read_bytes()
        for key, value in [('Origin', 'https://unrelated.example'), ('Host', 'unrelated.example'),
                           ('Sec-Fetch-Site', 'cross-site')]:
            with self.assertRaises(configure_web.backup.BackupError):
                configure_web.save_submission(self.base, config, {**headers, key: value}, origin,
                                              'fixture-token', body)
        self.assertEqual((self.base / 'credentials.json').read_bytes(), before)

    def test_web_form_rejects_wrong_csrf_duplicate_fields_and_overwrite(self):
        config, headers, origin, body = self.web_fixture()
        before = (self.base / 'credentials.json').read_bytes()
        for token, payload in [('wrong-token', body), ('fixture-token', body + b'&password=other'),
                               ('fixture-token', body)]:
            with self.assertRaises(configure_web.backup.BackupError):
                configure_web.save_submission(self.base, config, headers, origin, token, payload)
        self.assertEqual((self.base / 'credentials.json').read_bytes(), before)

    def test_inventory_handles_nested_names_without_writing_remote_data(self):
        client = backup.Storage(REF, 'fixture-only')
        calls = []
        def respond(route, body=None):
            calls.append((route, body))
            if route == 'bucket':
                return [{'id': 'documents'}]
            if body['prefix'] == '':
                return [{'id': None, 'name': 'pasta'}]
            return [{'id': 'x', 'name': 'fictício.pdf', 'metadata': {'size': 4}}]
        with patch.object(client, 'json', side_effect=respond):
            result = client.inventory()
        self.assertEqual(result['objects'][0]['name'], 'pasta/fictício.pdf')
        self.assertEqual([r for r, _ in calls], ['bucket', 'object/list/documents', 'object/list/documents'])


if __name__ == '__main__':
    unittest.main()
