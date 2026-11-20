#!/usr/bin/env python3
"""Private local backups: Supabase CLI exports + Storage bytes, encrypted with age.

No deletes, restores, publication, purchases or automatic scheduling. A successful
integrity check is not a database restore test. Never log credentials or object paths.
"""
import argparse
import base64
import getpass
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone

BASE = Path.home() / 'Library/Application Support/OrvelBackup'


class BackupError(Exception):
    pass


def private_file(path):
    if path.is_symlink() or not path.is_file():
        raise BackupError('Ficheiro privado em falta ou inválido.')
    info = path.stat()
    if info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise BackupError('O ficheiro de configuração/chave deve ter permissões 600.')
    return path


def write_json(path, data):
    with path.open('x', encoding='utf-8') as stream:
        json.dump(data, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    path.chmod(0o600)


def inside(path, parent):
    return path.resolve() == parent.resolve() or parent.resolve() in path.resolve().parents


def load_config(base=BASE):
    data = json.loads(private_file(base / 'config.json').read_text())
    if not re.fullmatch(r'[a-z]{20}', data.get('project_ref', '')):
        raise BackupError('Projeto inválido.')
    if not re.fullmatch(r'age1[a-z0-9]{58}', data.get('recipient', '')):
        raise BackupError('Destinatário de cifra inválido.')
    destination = Path(data['destination'])
    source = Path(data['source_repository'])
    if destination.is_symlink() or not destination.is_dir():
        raise BackupError('A pasta privada de destino não está disponível.')
    if inside(destination, source) or inside(base, destination):
        raise BackupError('Backups devem ficar fora do repositório e separados da chave.')
    if destination.stat().st_uid != os.getuid() or destination.stat().st_mode & 0o077:
        raise BackupError('A pasta de backup deve ter permissões 700.')
    return data


def database_connection(uri, ref):
    try:
        value = urllib.parse.urlsplit(uri)
        user = urllib.parse.unquote(value.username or '')
        password = urllib.parse.unquote(value.password or '')
        valid_host = (value.hostname == f'db.{ref}.supabase.co' and user == 'postgres') or (
            (value.hostname or '').endswith('.pooler.supabase.com') and user == f'postgres.{ref}')
        if value.scheme not in ('postgresql', 'postgres') or not valid_host or not password:
            raise ValueError()
        if value.port not in (None, 5432) or value.path != '/postgres' or value.fragment:
            raise ValueError()
        # Credentials are passed in the child environment, never in argv or logs.
        public_uri = urllib.parse.urlunsplit(('postgresql',
            urllib.parse.quote(user, safe='') + '@' + value.hostname + ':5432',
            '/postgres', 'sslmode=require', ''))
        return public_uri, password
    except (ValueError, TypeError):
        raise BackupError('Usa a ligação Direct ou Session pooler do projeto configurado, porta 5432.') from None


def service_key_valid(key, ref):
    if key.startswith('sb_secret_') and len(key) > 30:
        return True
    try:
        payload = key.split('.')[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
        return claims.get('role') == 'service_role' and claims.get('ref') == ref
    except (IndexError, ValueError, TypeError):
        return False


def database_url_with_password(endpoint, password, ref):
    """Add a separately entered password; never require manual URL encoding."""
    try:
        value = urllib.parse.urlsplit(endpoint)
        if value.password is not None or not password or '\x00' in password:
            raise ValueError()
        uri = urllib.parse.urlunsplit((value.scheme,
            urllib.parse.quote(urllib.parse.unquote(value.username or ''), safe='') + ':' +
            urllib.parse.quote(password, safe='') + '@' + (value.hostname or '') +
            ':' + str(value.port or 5432), value.path, value.query, value.fragment))
        database_connection(uri, ref)
        return uri
    except (ValueError, TypeError):
        raise BackupError('A ligação deve estar sem password; introduz a password apenas no pedido separado.') from None


def configure(base=BASE):
    config = load_config(base)
    path = base / 'credentials.json'
    if path.exists():
        raise BackupError('Já existe configuração de acesso. Não será substituída automaticamente.')
    if not sys.stdin.isatty():
        raise BackupError('Abre Configurar acesso.command no Terminal; não introduzas segredos no chat.')
    print('Configuração local do backup Orvel — projeto ' + config['project_ref'])
    print('Os valores não serão mostrados nem enviados para o chat.')
    endpoint = config.get('database_endpoint')
    if not endpoint:
        endpoint = input('Ligação PostgreSQL Direct/Session SEM password: ').strip()
    # Validate the non-secret endpoint before asking for any real credential.
    database_url_with_password(endpoint, 'validation-only', config['project_ref'])
    print('Ligação ao projeto já preparada. Não precisas de copiar a ligação do Supabase.')
    print('Usa a password da BASE DE DADOS, definida ao criar este projeto.')
    print('É diferente da password de entrada na conta Supabase.')
    password = getpass.getpass('1/2 — Password da base de dados (invisível ao escrever): ')
    uri = database_url_with_password(endpoint, password, config['project_ref'])
    key = getpass.getpass('2/2 — Chave secret/service_role do projeto (invisível ao colar): ').strip()
    if not service_key_valid(key, config['project_ref']):
        raise BackupError('É necessária uma chave de servidor do projeto, não a chave pública.')
    write_json(path, {'database_url': uri, 'storage_key': key})
    print('Acesso guardado localmente com permissões restritas. Nenhum backup foi executado.')


def docker_binary():
    return shutil.which('docker') or next((str(p) for p in [
        Path('/Applications/Docker.app/Contents/Resources/bin/docker'),
        Path.home() / '.docker/bin/docker',
        Path.home() / '.rd/bin/docker',
        Path.home() / 'Applications/Rancher Desktop.app/Contents/Resources/resources/darwin/bin/docker',
    ] if p.is_file()), None)


def preflight(base=BASE):
    config = load_config(base)
    missing = []
    for tool in ['age', 'age-keygen', 'supabase']:
        if not (base / 'bin' / tool).is_file():
            missing.append(tool)
    if not (base / 'credentials.json').exists():
        missing.append('acesso PostgreSQL/Storage por configurar no Terminal')
    else:
        credentials = json.loads(private_file(base / 'credentials.json').read_text())
        database_connection(credentials['database_url'], config['project_ref'])
        if not service_key_valid(credentials['storage_key'], config['project_ref']):
            raise BackupError('Chave de acesso ao Storage inválida.')
    private_file(base / 'identity.agekey')
    docker = docker_binary()
    if not docker:
        missing.append('Docker compatível com o Supabase CLI')
    else:
        try:
            result = subprocess.run([docker, 'info'], capture_output=True, timeout=15)
            if result.returncode:
                missing.append('Docker não está em execução')
        except (OSError, subprocess.TimeoutExpired):
            missing.append('Docker não está disponível')
    return {'ready_for_first_backup': not missing, 'missing': missing,
            'scheduled': bool(config.get('schedule_enabled')), 'destination': config['destination'],
            'restore_test_completed': False}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise BackupError('Redirecionamento inesperado do Storage; operação interrompida.')


class Storage:
    def __init__(self, ref, key):
        self.base_url = f'https://{ref}.supabase.co/storage/v1/'
        self.headers = {'Authorization': 'Bearer ' + key, 'apikey': key}
        self.opener = urllib.request.build_opener(NoRedirect)

    def request(self, route, body=None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(self.base_url + route, data=data,
            headers={**self.headers, 'Content-Type': 'application/json'})
        try:
            return self.opener.open(request, timeout=60)
        except urllib.error.URLError:
            raise BackupError('Não foi possível ler o Storage. Nenhuma cópia completa foi marcada.') from None

    def json(self, route, body=None):
        with self.request(route, body) as response:
            data = response.read(32 * 1024 * 1024 + 1)
        if len(data) > 32 * 1024 * 1024:
            raise BackupError('Resposta de inventário demasiado grande.')
        return json.loads(data)

    def inventory(self):
        buckets = self.json('bucket')
        files = []
        for bucket in sorted(buckets, key=lambda x: x['id']):
            stack, seen = [''], set()
            while stack:
                prefix = stack.pop()
                if prefix in seen or len(seen) > 50000 or prefix.count('/') > 50:
                    raise BackupError('Inventário de pastas inválido ou demasiado grande.')
                seen.add(prefix)
                offset = 0
                while True:
                    page = self.json('object/list/' + urllib.parse.quote(bucket['id'], safe=''),
                        {'prefix': prefix, 'limit': 1000, 'offset': offset,
                         'sortBy': {'column': 'name', 'order': 'asc'}})
                    if not isinstance(page, list):
                        raise BackupError('Inventário do Storage inválido.')
                    for item in page:
                        name = item['name']
                        if not name or name in ('.', '..') or '/' in name or '\x00' in name:
                            raise BackupError('Nome de objeto inválido no inventário.')
                        object_name = (prefix + '/' if prefix else '') + name
                        if item.get('id') is None:
                            stack.append(object_name)
                        else:
                            files.append({'bucket': bucket['id'], 'name': object_name,
                                          'id': item['id'], 'updated_at': item.get('updated_at'),
                                          'metadata': item.get('metadata')})
                    if len(page) < 1000:
                        break
                    offset += len(page)
                    if offset > 1000000:
                        raise BackupError('Inventário excede o limite de segurança.')
        return {'buckets': buckets, 'objects': sorted(files, key=lambda x: (x['bucket'], x['name']))}

    def download(self, item):
        route = 'object/' + urllib.parse.quote(item['bucket'], safe='') + '/' + urllib.parse.quote(item['name'], safe='/')
        return self.request(route)


def file_hash(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(part)
    return digest.hexdigest()


def encrypt_stream(stream, output, age, recipient):
    digest, size = hashlib.sha256(), 0
    with output.open('xb') as encrypted:
        process = subprocess.Popen([str(age), '-r', recipient], stdin=subprocess.PIPE,
                                   stdout=encrypted, stderr=subprocess.DEVNULL)
        try:
            while True:
                data = stream.read(1024 * 1024)
                if not data:
                    break
                process.stdin.write(data)
                digest.update(data)
                size += len(data)
            process.stdin.close()
            if process.wait(timeout=120):
                raise BackupError('A cifra falhou; a cópia permanece incompleta.')
        except BaseException:
            process.kill()
            process.wait()
            raise
    return {'file': output.name, 'bytes': size, 'sha256': digest.hexdigest(),
            'encrypted_sha256': file_hash(output)}


def export_command(command, output, env, base, recipient):
    # Child stderr may include credentials or data, so it is never emitted or persisted.
    process = subprocess.Popen(command, env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        entry = encrypt_stream(process.stdout, output, base / 'bin/age', recipient)
        if process.wait(timeout=120):
            raise BackupError('A exportação falhou; confirma o acesso e as dependências localmente.')
        if not entry['bytes']:
            raise BackupError('Exportação vazia; a cópia não pode ser marcada como completa.')
        return entry
    except BaseException:
        process.kill()
        process.wait()
        raise
    finally:
        process.stdout.close()


def decrypt_manifest(folder, base):
    result = subprocess.run([str(base / 'bin/age'), '-d', '-i', str(private_file(base / 'identity.agekey')),
                             str(folder / 'manifest.json.age')], capture_output=True, timeout=120)
    if result.returncode or len(result.stdout) > 64 * 1024 * 1024:
        raise BackupError('Não foi possível verificar o manifesto cifrado.')
    try:
        return json.loads(result.stdout)
    except ValueError:
        raise BackupError('Manifesto inválido.') from None


def verify(folder, base=BASE):
    config = load_config(base)
    folder = folder.resolve()
    if not inside(folder, Path(config['destination'])):
        raise BackupError('A verificação só aceita conjuntos na pasta privada configurada.')
    manifest = decrypt_manifest(folder, base)
    if manifest['project_ref'] != config['project_ref']:
        raise BackupError('O projeto do manifesto não corresponde ao configurado.')
    for entry in manifest['entries']:
        if not re.fullmatch(r'[a-z0-9_-]+\.(sql|tar|bin)\.age', entry['file']):
            raise BackupError('Caminho de ficheiro inválido no manifesto.')
        path = folder / entry['file']
        if path.is_symlink() or file_hash(path) != entry['encrypted_sha256']:
            raise BackupError('A integridade do ficheiro cifrado falhou.')
        process = subprocess.Popen([str(base / 'bin/age'), '-d', '-i', str(base / 'identity.agekey'), str(path)],
                                   stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        digest, size = hashlib.sha256(), 0
        try:
            for part in iter(lambda: process.stdout.read(1024 * 1024), b''):
                size += len(part)
                digest.update(part)
            if process.wait(timeout=120) or size != entry['bytes'] or digest.hexdigest() != entry['sha256']:
                raise BackupError('A verificação do conteúdo recuperado falhou.')
        finally:
            process.stdout.close()
            if process.poll() is None:
                process.kill()
                process.wait()
    return {'integrity_verified': True, 'files_verified': len(manifest['entries']),
            'restore_test_completed': False}


def run_backup(base=BASE):
    status = preflight(base)
    if not status['ready_for_first_backup']:
        raise BackupError('Backup não iniciado: ' + '; '.join(status['missing']))
    config = load_config(base)
    destination = Path(config['destination'])
    lock = base / 'backup.lock'
    try:
        lock.mkdir(mode=0o700)
    except FileExistsError:
        raise BackupError('Existe uma execução ou bloqueio anterior; não iniciar outra cópia.') from None
    try:
        credentials = json.loads(private_file(base / 'credentials.json').read_text())
        uri, password = database_connection(credentials['database_url'], config['project_ref'])
        env = dict(os.environ, PGPASSWORD=password, SUPABASE_DB_PASSWORD=password,
                   PGOPTIONS='-c default_transaction_read_only=on', PGCONNECT_TIMEOUT='20')
        docker = docker_binary()
        env['PATH'] = str(Path(docker).parent) + os.pathsep + os.environ.get('PATH', '')
        storage = Storage(config['project_ref'], credentials['storage_key'])
        inventory = storage.inventory()
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
        folder = destination / (stamp + '.partial')
        folder.mkdir(mode=0o700)
        entries = []
        cli = [str(base / 'bin/supabase'), 'db', 'dump', '--db-url', uri]
        for name, flags in [('roles', ['--role-only']), ('schema', []),
                            ('managed_schema', ['--schema', 'auth,storage']),
                            ('history_schema', ['--schema', 'supabase_migrations']),
                            ('history_data', ['--schema', 'supabase_migrations', '--data-only', '--use-copy']),
                            ('data', ['--data-only', '--use-copy', '-x', 'storage.buckets_vectors', '-x', 'storage.vector_indexes'])]:
            entries.append(export_command(cli + flags, folder / (name + '.sql.age'), env, base, config['recipient']))
        commit = subprocess.check_output(['git', '-C', config['source_repository'], 'rev-parse', 'HEAD'], text=True).strip()
        entries.append(export_command(['git', '-C', config['source_repository'], 'archive', '--format=tar', commit],
                       folder / 'source.tar.age', os.environ.copy(), base, config['recipient']))
        for number, item in enumerate(inventory['objects']):
            with storage.download(item) as stream:
                entry = encrypt_stream(stream, folder / f'object_{number:08d}.bin.age', base / 'bin/age', config['recipient'])
            expected = (item.get('metadata') or {}).get('size')
            if expected is not None and entry['bytes'] != int(expected):
                raise BackupError('O tamanho descarregado não corresponde ao inventário.')
            entries.append({**entry, 'object': item})
        if storage.inventory() != inventory:
            raise BackupError('O Storage mudou durante a cópia; o conjunto permanece incompleto.')
        manifest = {'format': 2, 'project_ref': config['project_ref'], 'created_at': stamp,
                    'source_commit': commit, 'inventory': inventory, 'entries': entries,
                    'automatic_deletion': False, 'restore_test_completed': False,
                    'limitations': ['No atomic snapshot across database and Storage; use a quiet change window.',
                      'Platform secrets/settings require separate recovery configuration.',
                      'Managed schema snapshot is supplemental: restore into a compatible platform or use reviewed migrations.',
                      'Platform-managed roles and extensions must exist at the recovery destination.']}
        encrypt_stream(io.BytesIO(json.dumps(manifest, ensure_ascii=False).encode()), folder / 'manifest.json.age',
                       base / 'bin/age', config['recipient'])
        result = verify(folder, base)
        write_json(folder / 'COMPLETE.json', {**result, 'created_at': stamp,
                   'storage_objects': len(inventory['objects']), 'automatic_deletion': False})
        final = destination / stamp
        folder.rename(final)
        return {**result, 'backup': str(final), 'storage_objects': len(inventory['objects'])}
    finally:
        # This removes only the empty coordination lock, never a backup or source object.
        lock.rmdir()


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['check', 'configure', 'run', 'verify'])
    parser.add_argument('backup_directory', nargs='?')
    args = parser.parse_args()
    try:
        if args.action == 'configure':
            configure()
            return
        if args.action == 'check':
            result = preflight()
        elif args.action == 'run':
            result = run_backup()
        else:
            if not args.backup_directory:
                raise BackupError('Indica a pasta do conjunto a verificar.')
            result = verify(Path(args.backup_directory))
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except BackupError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
    except Exception:
        print('Operação interrompida. Nenhum novo conjunto deve ser considerado completo sem COMPLETE.json.', file=sys.stderr)
        raise SystemExit(1)


if __name__ == '__main__':
    main()
