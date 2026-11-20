#!/usr/bin/env python3
"""Daily local backup entry point. Never prune copies or disclose child errors.

With "offsite_destination" in the config (an iCloud Drive folder), every complete encrypted set
is also copied there, checked file by file against the original. Nothing is ever deleted."""
import argparse
from datetime import datetime, timezone
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import sys
import hashlib
import uuid

spec = importlib.util.spec_from_file_location('orvel_backup', Path(__file__).with_name('orvel-backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)
GIB = 1024 ** 3
FRESH_HOURS = 20


def latest_complete(destination):
    candidates = []
    for folder in destination.iterdir():
        if folder.is_symlink() or not folder.is_dir() or not re.fullmatch(r'\d{8}T\d{6}Z-[a-f0-9]{8}', folder.name):
            continue
        marker = folder / 'COMPLETE.json'
        if not marker.is_file() or marker.is_symlink():
            continue
        data = json.loads(backup.private_file(marker).read_text())
        if data.get('integrity_verified') is not True or data.get('automatic_deletion') is not False:
            raise backup.BackupError('Marcador de conclusão inválido; rever a cópia local.')
        created = datetime.strptime(folder.name[:16], '%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc)
        candidates.append((created, folder))
    return max(candidates, default=(None, None), key=lambda item: item[0])


SET_NAME = re.compile(r'\d{8}T\d{6}Z-[a-f0-9]{8}')


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def set_files(folder):
    files = {}
    for item in folder.iterdir():
        if item.is_symlink() or not item.is_file():
            raise backup.BackupError('Conteúdo inesperado numa cópia.')
        files[item.name] = item
    return files


def mirror_offsite(destination, offsite):
    """Copy complete encrypted sets to the off-Mac folder. Never deletes; re-checks existing copies."""
    offsite = Path(offsite)
    if offsite.is_symlink():
        raise backup.BackupError('Destino externo inválido.')
    offsite.mkdir(mode=0o700, parents=True, exist_ok=True)
    offsite.chmod(0o700)
    copied = verified = 0
    for folder in sorted(destination.iterdir()):
        if folder.is_symlink() or not folder.is_dir() or not SET_NAME.fullmatch(folder.name):
            continue
        if not (folder / 'COMPLETE.json').is_file():
            continue  # conjuntos parciais nunca saem do Mac
        source = set_files(folder)
        target = offsite / folder.name
        if target.exists():
            if target.is_symlink() or not target.is_dir():
                raise backup.BackupError('Destino externo inválido.')
            existing = set_files(target)
            if set(existing) != set(source) or any(sha256(existing[n]) != sha256(source[n]) for n in source):
                raise backup.BackupError('Cópia externa diferente da original.')
            verified += 1
            continue
        staging = offsite / ('.partial-' + folder.name + '-' + uuid.uuid4().hex[:8])
        staging.mkdir(mode=0o700)
        for name, path in source.items():
            copy = staging / name
            shutil.copyfile(path, copy)
            copy.chmod(0o600)
            if sha256(copy) != sha256(path):
                raise backup.BackupError('Cópia externa corrompida.')
        staging.rename(target)
        copied += 1
    return {'copied': copied, 'verified': verified}


def save_report(base, report):
    directory = base / 'reports'
    if directory.is_symlink():
        raise backup.BackupError('Pasta de relatórios inválida.')
    directory.mkdir(mode=0o700, exist_ok=True)
    if directory.stat().st_uid != os.getuid() or directory.stat().st_mode & 0o077:
        raise backup.BackupError('A pasta de relatórios deve ser privada.')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
    backup.write_json(directory / (stamp + '-daily.json'), report)


def execute(base=backup.BASE, now=None, inspect_only=False):
    now = now or datetime.now(timezone.utc)
    report = {'checked_at': now.isoformat(), 'automatic_deletion': False,
              'status': 'failed', 'error_code': 'backup_check_failed'}
    try:
        config = backup.load_config(base)
        destination = Path(config['destination'])
        created, previous = latest_complete(destination)
        age_hours = (now - created).total_seconds() / 3600 if created else None
        if age_hours is not None and age_hours < -1:
            raise backup.BackupError('Data da cópia no futuro; confirmar o relógio.')
        free = shutil.disk_usage(destination).free
        previous_size = sum(p.stat().st_size for p in previous.iterdir() if p.is_file()) if previous else 0
        minimum_free = max(2 * GIB, previous_size * 3)
        report.update({'free_bytes': free, 'last_complete': previous.name if previous else None,
                       'age_hours': round(age_hours, 2) if age_hours is not None else None,
                       'schedule_configured': bool(config.get('schedule_enabled')),
                       'warnings': []})
        if free < 10 * GIB:
            report['warnings'].append('low_disk_space_no_copies_deleted')
        if inspect_only:
            report.update(status='current' if age_hours is not None and age_hours < 36 else 'stale',
                          error_code=None, integrity_checked_this_run=False)
        elif previous and age_hours < FRESH_HOURS:
            backup.verify(previous, base)
            report.update(status='verified_recent_copy', error_code=None,
                          integrity_checked_this_run=True, created_new_copy=False)
        elif free < minimum_free:
            report.update(error_code='insufficient_disk_space_no_copies_deleted')
        else:
            result = backup.run_backup(base)
            report.update(status='completed', error_code=None, created_new_copy=True,
                          last_complete=Path(result['backup']).name, age_hours=0,
                          integrity_checked_this_run=True,
                          files_verified=result['files_verified'], storage_objects=result['storage_objects'])
        offsite = config.get('offsite_destination')
        if offsite and not inspect_only and report['status'] in ('verified_recent_copy', 'completed'):
            try:
                result = mirror_offsite(destination, offsite)
                report.update(offsite_status='ok', offsite_copied=result['copied'], offsite_verified=result['verified'])
            except Exception:
                report.update(status='failed', error_code='offsite_copy_failed', offsite_status='failed')
    except Exception:
        # Unexpected errors may include connection strings. Never print/persist exception text.
        report.update(status='failed', error_code='backup_check_failed')
    if not inspect_only:
        try:
            save_report(base, report)
        except Exception:
            report.update(status='failed', error_code='private_report_write_failed')
    return report


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['run', 'status'])
    args = parser.parse_args()
    report = execute(inspect_only=args.action == 'status')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if report['status'] in ('failed', 'stale'):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
