#!/usr/bin/env python3
"""Restore SQL and file bytes only into the designated networkless, RAM-only test container.

This is a technical recovery test, not a complete Supabase/Auth/Edge Functions recovery.
No production credentials or network connection are used by this program.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('orvel-backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)
CONTAINER = 'orvel-restore-check-20261119'


def sql_statements(sql):
    """Split pg_dump DDL, respecting quoted strings, comments and dollar-quoted bodies."""
    result, start, i, quote, block = [], 0, 0, None, 0
    while i < len(sql):
        if block:
            if sql.startswith('/*', i): block += 1; i += 2
            elif sql.startswith('*/', i): block -= 1; i += 2
            else: i += 1
        elif quote:
            if sql.startswith(quote, i):
                if quote in ("'", '"') and sql.startswith(quote * 2, i): i += 2
                else: i += len(quote); quote = None
            elif quote == "'" and sql[i] == '\\': i += 2
            else: i += 1
        elif sql.startswith('--', i):
            end = sql.find('\n', i); i = len(sql) if end < 0 else end + 1
        elif sql.startswith('/*', i): block = 1; i += 2
        elif sql[i] in ("'", '"'): quote = sql[i]; i += 1
        elif sql[i] == '$' and re.match(r'\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$', sql[i:]):
            quote = re.match(r'\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$', sql[i:]).group(); i += len(quote)
        elif sql[i] == ';': result.append(sql[start:i+1]); start = i + 1; i += 1
        else: i += 1
    if sql[start:].strip(): result.append(sql[start:])
    if quote or block: raise backup.BackupError('DDL incompleto no conjunto.')
    return result


def copy_counts(sql):
    counts, table, count = {}, None, 0
    for line in sql.splitlines():
        if table:
            if line == r'\.': counts[table] = count; table = None
            else: count += 1
        elif line.startswith('COPY '):
            match = re.match(r'^COPY ("[a-z_][a-z0-9_]*"\."[a-z_][a-z0-9_]*") \(', line)
            if not match: raise backup.BackupError('Tabela COPY inesperada.')
            table, count = match[1], 0
    if table: raise backup.BackupError('COPY incompleto.')
    return counts


def main(folder):
    base, docker = backup.BASE, backup.docker_binary()
    backup.verify(folder, base)
    info = json.loads(subprocess.check_output([docker, 'inspect', CONTAINER]))[0]
    if (info['HostConfig']['NetworkMode'] != 'none' or not info['HostConfig']['ReadonlyRootfs'] or
            '/tmp' not in info['HostConfig']['Tmpfs'] or info['HostConfig'].get('PortBindings') or
            info['HostConfig']['LogConfig']['Type'] != 'none'):
        raise backup.BackupError('O destino de ensaio não cumpre o isolamento exigido.')

    def decrypt(name):
        p = subprocess.run([str(base/'bin/age'), '-d', '-i', str(base/'identity.agekey'), str(folder/name)],
                           capture_output=True, timeout=120)
        if p.returncode or len(p.stdout) > 64*1024*1024:
            raise backup.BackupError('Não foi possível descifrar uma parte do ensaio.')
        return p.stdout

    def sql_run(sql, phase):
        if phase in ('platform prerequisites', 'managed schema', 'application schema', 'managed policies'):
            sql = 'BEGIN;\n' + sql + '\nCOMMIT;'
        p = subprocess.run([docker, 'exec', '-i', CONTAINER, 'psql', '-X', '-h', '/tmp', '-U', 'postgres',
                            '-v', 'ON_ERROR_STOP=1', '-At'], input=sql.encode(), capture_output=True, timeout=120)
        if p.returncode:
            # Only schema-dependency messages are exposed; never rows, query text or CONTEXT.
            errors = p.stderr.decode(errors='replace')
            safe = re.findall(r'ERROR:\s+((?:schema|role|relation|function|type|extension) [^\n]{1,160}(?:does not exist|already exists|is not available))', errors)
            if phase in ('platform prerequisites', 'managed schema', 'application schema', 'managed policies'):
                safe = [line[:250] for line in errors.splitlines() if 'ERROR:' in line][:1]
            line = re.search(r'psql:<stdin>:(\d+):', errors)
            print(json.dumps({'failed_phase': phase, 'line': line.group(1) if line else None,
                              'dependency_error': safe[:1]}), flush=True)
            raise backup.BackupError('O ensaio parou ao primeiro erro SQL; não está concluído.')
        return p.stdout.decode()

    parts = {n:decrypt(n+'.sql.age').decode() for n in ['roles','schema','managed_schema','history_schema','history_data','data']}
    all_ddl = '\n'.join(parts[n] for n in ['roles','schema','managed_schema','history_schema'])
    roles = set(re.findall(r'OWNER TO "([a-z_][a-z0-9_]*)"', all_ddl))
    for statement in sql_statements(all_ddl):
        stripped = statement.strip()
        if stripped.startswith('GRANT ') or stripped.startswith('ALTER DEFAULT PRIVILEGES '):
            match = re.search(r' TO (.+?)(?: WITH |;)', stripped, re.S)
            if match: roles.update(re.findall(r'"([a-z_][a-z0-9_]*)"', match[1]))
    roles.update(['anon','authenticated','service_role','authenticator','supabase_admin',
                  'supabase_auth_admin','supabase_storage_admin'])
    roles.discard('postgres')
    setup = ''.join('CREATE ROLE "'+r+'" NOLOGIN'+(' BYPASSRLS' if r in ['service_role','supabase_admin'] else '')+';\n' for r in sorted(roles))
    setup += 'CREATE SCHEMA extensions; CREATE SCHEMA vault;\n'
    for publication in sorted(set(re.findall(r'ALTER PUBLICATION "([a-z_][a-z0-9_]*)"', all_ddl))):
        setup += 'CREATE PUBLICATION "'+publication+'";\n'
    setup += '\n'.join(re.findall(r'^CREATE EXTENSION[^;]*;', parts['schema'], re.M))
    sql_run(setup, 'platform prerequisites')
    managed, policies = [], []
    for statement in sql_statements(parts['managed_schema']):
        (policies if statement.strip().startswith('CREATE POLICY ') else managed).append(statement)
    sql_run('\n'.join(managed), 'managed schema')
    sql_run(parts['roles']+'\n'+parts['schema']+'\n'+parts['history_schema'], 'application schema')
    sql_run('\n'.join(policies), 'managed policies')
    sql_run('BEGIN; SET session_replication_role = replica;\n'+parts['data']+'\n'+parts['history_data']+'\nCOMMIT;', 'data')
    counts = {**copy_counts(parts['data']), **copy_counts(parts['history_data'])}
    actual = sql_run('\n'.join('SELECT count(*) FROM '+name+';' for name in counts), 'row counts').splitlines()
    if [int(n) for n in actual] != list(counts.values()):
        raise backup.BackupError('As contagens recuperadas não correspondem ao conjunto.')
    security = sql_run("SELECT count(*) FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity;\nSELECT count(*) FROM pg_policies WHERE schemaname='storage';", 'security metadata').splitlines()
    if security[0] != '0' or int(security[1]) != len(policies):
        raise backup.BackupError('RLS/políticas não correspondem ao conjunto.')
    manifest = backup.decrypt_manifest(folder, base)
    restored = 0
    for entry in manifest['entries']:
        if 'object' not in entry: continue
        content = decrypt(entry['file'])
        target = '/tmp/restored-object-'+str(restored)
        p = subprocess.run([docker,'exec','-i',CONTAINER,'sh','-c','cat > '+target],input=content,capture_output=True,timeout=60)
        if p.returncode: raise backup.BackupError('Falhou a reposição em memória de um ficheiro.')
        check = subprocess.check_output([docker,'exec',CONTAINER,'sha256sum',target],timeout=30).decode().split()[0]
        if check != entry['sha256'] or len(content) != entry['bytes']:
            raise backup.BackupError('O ficheiro recuperado não corresponde ao conjunto.')
        restored += 1
    result = {'backup':str(folder),'database_restore_test_completed':True,'tables_checked':len(counts),
              'rows_checked':sum(counts.values()),'storage_files_restored':restored,'storage_hashes_verified':True,
              'public_tables_without_rls':int(security[0]),'storage_policies_restored':int(security[1]),
              'network':'none','data_location':'temporary RAM filesystem',
              'platform_roles':'local prerequisites; platform role attributes not fully validated',
              'full_application_restore_test_completed':False,'automatic_deletion':False}
    reports = base/'reports'; reports.mkdir(mode=0o700,exist_ok=True)
    backup.write_json(reports/(folder.name+'-restore.json'),result)
    print(json.dumps(result,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    os.umask(0o077)
    try: main(Path(sys.argv[1]))
    except backup.BackupError as error:
        print(str(error),file=sys.stderr); raise SystemExit(1)
