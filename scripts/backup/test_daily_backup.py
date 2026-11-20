"""Daily scheduling safeguards, using fictional data only."""
from datetime import datetime, timezone
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('daily', Path(__file__).with_name('daily-backup.py'))
daily = importlib.util.module_from_spec(spec)
spec.loader.exec_module(daily)
NOW = datetime(2026, 11, 19, 9, tzinfo=timezone.utc)


class DailyTests(unittest.TestCase):
    def setUp(self):
        self.previous_umask = os.umask(0o077)
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.dest = self.base / 'copies'
        self.dest.mkdir(mode=0o700)
        self.config = patch.object(daily.backup, 'load_config', return_value={'destination': str(self.dest)})
        self.config.start()

    def tearDown(self):
        self.config.stop()
        self.temp.cleanup()
        os.umask(self.previous_umask)

    def fixture(self, name):
        folder = self.dest / name
        folder.mkdir(mode=0o700)
        daily.backup.write_json(folder / 'COMPLETE.json', {'integrity_verified': True, 'automatic_deletion': False})
        return folder

    def test_recent_copy_is_verified_without_duplicate(self):
        folder = self.fixture('20261119T080000Z-abcdef12')
        with patch.object(daily.backup, 'verify') as verify, patch.object(daily.backup, 'run_backup') as run:
            report = daily.execute(self.base, NOW)
        verify.assert_called_once_with(folder, self.base)
        run.assert_not_called()
        self.assertEqual(report['status'], 'verified_recent_copy')

    def test_stale_copy_creates_new_copy_and_keeps_old(self):
        folder = self.fixture('20261117T080000Z-abcdef12')
        with patch.object(daily.backup, 'run_backup', return_value={'backup': str(self.dest / 'new'), 'files_verified': 8, 'storage_objects': 1}) as run:
            report = daily.execute(self.base, NOW)
        run.assert_called_once()
        self.assertEqual(report['status'], 'completed')
        self.assertTrue(folder.exists())

    def test_low_disk_blocks_creation_without_deleting(self):
        folder = self.fixture('20261117T080000Z-abcdef12')
        with patch.object(daily.shutil, 'disk_usage', return_value=type('Disk', (), {'free': 1})()), patch.object(daily.backup, 'run_backup') as run:
            report = daily.execute(self.base, NOW)
        run.assert_not_called()
        self.assertEqual(report['error_code'], 'insufficient_disk_space_no_copies_deleted')
        self.assertTrue(folder.exists())

    def test_failure_is_reported_without_child_secrets(self):
        with patch.object(daily.backup, 'run_backup', side_effect=RuntimeError('secret-fixture-password')):
            report = daily.execute(self.base, NOW)
        self.assertEqual(report['status'], 'failed')
        self.assertNotIn('secret-fixture', json.dumps(report))
        saved = next((self.base / 'reports').iterdir())
        self.assertNotIn('secret-fixture', saved.read_text())
        self.assertEqual(saved.stat().st_mode & 0o777, 0o600)

    def test_partial_copy_does_not_count_as_complete(self):
        self.fixture('20261119T080000Z-abcdef12.partial')
        report = daily.execute(self.base, NOW, inspect_only=True)
        self.assertEqual(report['status'], 'stale')
        self.assertIsNone(report['last_complete'])

    def test_corruption_in_recent_copy_is_not_hidden_by_new_backup(self):
        self.fixture('20261119T080000Z-abcdef12')
        with patch.object(daily.backup, 'verify', side_effect=RuntimeError('corrupt')), patch.object(daily.backup, 'run_backup') as run:
            report = daily.execute(self.base, NOW)
        run.assert_not_called()
        self.assertEqual(report['status'], 'failed')

    def test_future_timestamp_fails_closed(self):
        self.fixture('20261121T080000Z-abcdef12')
        with patch.object(daily.backup, 'run_backup') as run:
            report = daily.execute(self.base, NOW)
        run.assert_not_called()
        self.assertEqual(report['status'], 'failed')



class OffsiteTests(unittest.TestCase):
    def setUp(self):
        self.previous_umask = os.umask(0o077)
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.dest = self.root / 'copies'
        self.dest.mkdir(mode=0o700)
        self.offsite = self.root / 'icloud' / 'Orvel-Backups'

    def tearDown(self):
        self.temp.cleanup()
        os.umask(self.previous_umask)

    def complete(self, name, payload=b'cifrado'):
        folder = self.dest / name
        folder.mkdir(mode=0o700)
        (folder / 'part-01.age').write_bytes(payload)
        daily.backup.write_json(folder / 'COMPLETE.json', {'integrity_verified': True, 'automatic_deletion': False})
        return folder

    def test_copies_complete_sets_and_skips_partial(self):
        self.complete('20261119T080000Z-abcdef12')
        partial = self.dest / '20261120T080000Z-12345678'
        partial.mkdir(mode=0o700)
        (partial / 'part-01.age').write_bytes(b'meio')
        result = daily.mirror_offsite(self.dest, self.offsite)
        self.assertEqual(result, {'copied': 1, 'verified': 0})
        self.assertEqual((self.offsite / '20261119T080000Z-abcdef12' / 'part-01.age').read_bytes(), b'cifrado')
        self.assertFalse((self.offsite / partial.name).exists())
        self.assertEqual(oct(self.offsite.stat().st_mode & 0o777), '0o700')

    def test_second_run_verifies_without_copying_or_deleting(self):
        self.complete('20261119T080000Z-abcdef12')
        daily.mirror_offsite(self.dest, self.offsite)
        extra = self.offsite / 'nota-da-responsavel.txt'
        extra.write_text('fica')
        self.assertEqual(daily.mirror_offsite(self.dest, self.offsite), {'copied': 0, 'verified': 1})
        self.assertTrue(extra.exists())

    def test_tampered_offsite_copy_fails(self):
        self.complete('20261119T080000Z-abcdef12')
        daily.mirror_offsite(self.dest, self.offsite)
        (self.offsite / '20261119T080000Z-abcdef12' / 'part-01.age').write_bytes(b'alterado')
        with self.assertRaises(daily.backup.BackupError):
            daily.mirror_offsite(self.dest, self.offsite)

    def test_failure_is_reported_as_failed_run(self):
        self.complete('20261119T080000Z-abcdef12')
        config = {'destination': str(self.dest), 'offsite_destination': str(self.offsite)}
        with patch.object(daily.backup, 'load_config', return_value=config), \
                patch.object(daily.backup, 'verify'), \
                patch.object(daily, 'mirror_offsite', side_effect=OSError('sem iCloud')), \
                patch.object(daily, 'save_report'):
            report = daily.execute(base=self.root, now=datetime(2026, 11, 19, 9, tzinfo=timezone.utc))
        self.assertEqual(report['status'], 'failed')
        self.assertEqual(report['error_code'], 'offsite_copy_failed')
        self.assertNotIn('sem iCloud', json.dumps(report))

if __name__ == '__main__':
    unittest.main()
