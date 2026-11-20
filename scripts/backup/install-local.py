#!/usr/bin/env python3
"""Install a private, unscheduled backup workspace on this Mac. No remote data read."""
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import urllib.request

TOOLS = [
    ('https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-darwin-arm64.tar.gz',
     'e2020b073c44f692685a24d6abc378817eb81ffaaf49fd0531ef8565f767f2f5', {'age', 'age-keygen'}),
    ('https://github.com/supabase/cli/releases/download/v2.122.0/supabase_darwin_arm64.tar.gz',
     'fe87a5f9781d5423dbd5ebba2d5a6e1a541d01754d14941c574952e5695eaab0', {'supabase'}),
]


def main():
    if os.uname().sysname != 'Darwin' or os.uname().machine != 'arm64':
        raise SystemExit('This installer is pinned to macOS arm64.')
    os.umask(0o077)
    base = Path.home() / 'Library/Application Support/OrvelBackup'
    dest = Path.home() / 'Orvel-Backups'
    for folder in [base, base / 'bin', dest]:
        if folder.is_symlink():
            raise SystemExit('Refusing a symbolic-link destination.')
        folder.mkdir(parents=True, exist_ok=True, mode=0o700)
        folder.chmod(0o700)
    receipts = []
    for url, checksum, names in TOOLS:
        with urllib.request.urlopen(url, timeout=90) as response:
            payload = response.read()
        if hashlib.sha256(payload).hexdigest() != checksum:
            raise SystemExit('Release archive checksum mismatch.')
        installed = set()
        with tarfile.open(fileobj=io.BytesIO(payload), mode='r:gz') as archive:
            for entry in archive:
                name = Path(entry.name).name
                if name not in names or not entry.isfile():
                    continue
                target = base / 'bin' / name
                if target.is_symlink():
                    raise SystemExit('Refusing a symbolic-link executable.')
                with target.open('wb') as stream:
                    shutil.copyfileobj(archive.extractfile(entry), stream)
                target.chmod(0o700)
                installed.add(name)
        if installed != names:
            raise SystemExit('Release archive is missing an expected executable.')
        receipts.append({'url': url, 'sha256': checksum, 'executables': sorted(installed)})

    identity = base / 'identity.agekey'
    if not identity.exists():
        subprocess.run([str(base / 'bin/age-keygen'), '-o', str(identity)],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if identity.is_symlink():
        raise SystemExit('Refusing a symbolic-link identity.')
    identity.chmod(0o600)
    recipient = subprocess.check_output([str(base / 'bin/age-keygen'), '-y', str(identity)], text=True).strip()
    source = Path(__file__).resolve().parents[2]
    config = base / 'config.json'
    if not config.exists():
        config.write_text(json.dumps({
            'project_ref': 'ilwkiruybzxplnhwcwrs',
            'destination': str(dest), 'recipient': recipient,
            'source_repository': str(source), 'schedule_enabled': False,
        }, indent=2) + '\n')
        config.chmod(0o600)
    (base / 'tool-receipts.json').write_text(json.dumps(receipts, indent=2) + '\n')
    for name in ['orvel-backup.py', 'configure-web.py', 'restore-check.py', 'daily-backup.py']:
        shutil.copyfile(Path(__file__).with_name(name), base / name)
        (base / name).chmod(0o700)
    command = base / 'Configurar acesso.command'
    command.write_text('#!/bin/zsh\nexec /usr/bin/python3 "${0:A:h}/orvel-backup.py" configure\n')
    command.chmod(0o700)
    (dest / 'LEIA-ME.txt').write_text(
        'ORVEL — BACKUP LOCAL PROVISÓRIO\n\n'
        'A preparação desta pasta não significa que exista uma cópia da produção.\n'
        'Apenas pastas com COMPLETE.json passaram a verificação de integridade.\n'
        'Não há limpeza automática nem agendamento ativo nesta preparação.\n'
        'A chave de recuperação está na pasta privada OrvelBackup em Library/Application Support.\n'
        'Guardar uma cópia da chave fora deste Mac é indispensável para recuperar após perda do equipamento.\n'
        'A recuperação completa num Supabase isolado ainda precisa de ensaio.\n')
    print(json.dumps({'destination': str(dest), 'configuration': str(base),
                      'tools_installed': True, 'scheduled': False, 'production_backup_created': False}))


if __name__ == '__main__':
    main()
