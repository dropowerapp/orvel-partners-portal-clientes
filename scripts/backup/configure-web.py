#!/usr/bin/env python3
"""One-use credential form, bound only to this Mac's loopback interface."""
import html
import hmac
from http.server import BaseHTTPRequestHandler, HTTPServer
import importlib.util
import json
import os
from pathlib import Path
import secrets
import time
import urllib.parse

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('orvel-backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


def save_submission(base, config, headers, expected_origin, token, body):
    """Reject cross-origin/CSRF requests before reading any supplied credentials."""
    if (headers.get('Host') != expected_origin.removeprefix('http://') or
            headers.get('Origin') != expected_origin or
            headers.get('Sec-Fetch-Site', 'same-origin') != 'same-origin' or
            headers.get('Content-Type', '').split(';')[0] != 'application/x-www-form-urlencoded'):
        raise backup.BackupError('Origem do pedido inválida. Usa o formulário aberto neste Mac.')
    if len(body) > 16384:
        raise backup.BackupError('Pedido demasiado grande.')
    try:
        fields = urllib.parse.parse_qs(body.decode('utf-8'), keep_blank_values=True,
                                      strict_parsing=True, max_num_fields=3)
    except (ValueError, UnicodeError):
        raise backup.BackupError('Formulário inválido.') from None
    if set(fields) != {'csrf', 'password', 'key'} or any(len(v) != 1 for v in fields.values()):
        raise backup.BackupError('Preenche os dois campos do formulário.')
    if not hmac.compare_digest(fields['csrf'][0], token):
        raise backup.BackupError('Formulário expirado ou inválido.')
    password, key = fields['password'][0], fields['key'][0].strip()
    if not password or len(password) > 1024 or not backup.service_key_valid(key, config['project_ref']):
        raise backup.BackupError('Preenche a password e uma chave Secret key válida deste projeto.')
    uri = backup.database_url_with_password(config['database_endpoint'], password, config['project_ref'])
    path = base / 'credentials.json'
    # Exclusive create is race-safe, also when an older Terminal form remains open.
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        raise backup.BackupError('O acesso já está guardado. Não foi substituído.') from None
    with os.fdopen(fd, 'w') as stream:
        json.dump({'database_url': uri, 'storage_key': key}, stream)


def page(token, message='', success=False):
    content = '<h1>Acesso guardado</h1><p>Já podes voltar ao chat. Vou validar a ligação e executar o primeiro backup.</p>' if success else f'''
    <span class="tag">CONFIGURAÇÃO LOCAL · ORVEL</span>
    <h1>Preparar o backup</h1>
    <p>Preenche estes dois campos. Os valores ficam guardados apenas neste Mac, para criar a cópia cifrada.</p>
    <form method="post" autocomplete="off">
      <input type="hidden" name="csrf" value="{html.escape(token, quote=True)}">
      <label for="password">1. Password da base de dados</label>
      <p class="hint">A nova password que acabaste de definir no Supabase.</p>
      <input id="password" name="password" type="password" required maxlength="1024" autocomplete="off" spellcheck="false" autofocus>
      <label for="key">2. Secret key do projeto</label>
      <p class="hint">Supabase → API Keys → Secret keys → default → ícone de copiar.</p>
      <input id="key" name="key" type="password" required maxlength="8192" autocomplete="off" spellcheck="false">
      <button type="submit">Guardar acesso neste Mac</button>
    </form>
    <p class="note">Projeto: orvel-portal-producao. Este formulário não altera passwords nem apaga documentos.</p>'''
    return f'''<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Backup Orvel — configuração local</title><style>
    *{{box-sizing:border-box}}body{{margin:0;background:#f4f5f7;color:#14243b;font:17px/1.55 -apple-system,BlinkMacSystemFont,sans-serif}}
    main{{max-width:620px;margin:6vh auto;background:white;border:1px solid #e2e6eb;border-radius:18px;padding:40px}}
    h1{{font-size:32px;line-height:1.2;margin:16px 0}}.tag{{font-size:12px;letter-spacing:.1em;color:#64748b}}p{{color:#526176}}
    label{{display:block;font-weight:650;margin-top:26px}}.hint{{font-size:14px;margin:4px 0 10px}}
    input:not([type=hidden]){{width:100%;font:20px system-ui;padding:14px;border:1px solid #a7b3c3;border-radius:8px}}
    input:focus{{outline:3px solid #c8d8f1;border-color:#29446a}}button{{width:100%;background:#142c50;color:white;border:0;border-radius:8px;padding:16px;font:600 16px system-ui;margin-top:28px;cursor:pointer}}
    .note{{font-size:13px;margin-top:24px}}.error{{padding:12px;background:#fff2ef;color:#933927;border-radius:8px}}
    @media(max-width:640px){{main{{margin:16px;padding:26px}}}}</style>
    <main>{'<p class="error">'+html.escape(message)+'</p>' if message else ''}{content}</main></html>'''.encode('utf-8')


def make_server(base=backup.BASE):
    config = backup.load_config(base)
    if (base / 'credentials.json').exists():
        raise backup.BackupError('O acesso já está guardado; o formulário não foi iniciado.')
    backup.database_url_with_password(config['database_endpoint'], 'validation-only', config['project_ref'])
    token = secrets.token_urlsafe(32)
    route = '/' + secrets.token_urlsafe(32)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass  # Never log paths, request bodies or credentials.

        def reply(self, status, payload):
            self.send_response(status)
            for name, value in {
                'Content-Type': 'text/html; charset=utf-8', 'Content-Length': str(len(payload)),
                # no-referrer makes browsers send Origin:null on ordinary form POSTs.
                # same-origin preserves Origin here without sharing a referrer externally.
                'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin',
                'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff',
                'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
            }.items():
                self.send_header(name, value)
            self.end_headers()
            self.wfile.write(payload)

        def do_GET(self):
            if self.path != route or self.headers.get('Host') != self.server.origin.removeprefix('http://'):
                self.reply(404, b'Not found')
                return
            self.reply(200, page(token))

        def do_POST(self):
            if self.path != route:
                self.reply(404, b'Not found')
                return
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 16384:
                    raise backup.BackupError('Pedido demasiado grande ou vazio.')
                save_submission(base, config, self.headers, self.server.origin, token, self.rfile.read(length))
            except backup.BackupError as error:
                self.reply(400, page(token, str(error)))
                return
            except Exception:
                self.reply(400, page(token, 'Não foi possível guardar. Volta ao chat sem enviar os valores.'))
                return
            self.server.saved = True
            self.reply(200, page(token, success=True))

    server = HTTPServer(('127.0.0.1', 0), Handler)
    server.timeout = 1
    server.saved = False
    server.origin = f'http://127.0.0.1:{server.server_port}'
    server.form_url = server.origin + route
    return server


if __name__ == '__main__':
    os.umask(0o077)
    try:
        server = make_server()
        print(json.dumps({'local_form_url': server.form_url}), flush=True)
        deadline = time.monotonic() + 1800
        with server:
            while not server.saved and time.monotonic() < deadline:
                server.handle_request()
        print(json.dumps({'credentials_saved': server.saved, 'local_form_closed': True}), flush=True)
    except backup.BackupError as error:
        print(str(error), flush=True)
        raise SystemExit(1)
