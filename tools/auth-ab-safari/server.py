"""Static-only server: private Codespace port required, never handles Auth data."""
import json
import os
import re
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = 8765
FILES = {'/': 'index.html', '/core.mjs': 'core.mjs', '/page.mjs': 'page.mjs', '/style.css': 'style.css'}
CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src https://ilmhjsrxhnishnbocrnm.supabase.co; img-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; worker-src 'none'"


def codespace_name():
    name = os.environ.get('CODESPACE_NAME', '')
    if os.environ.get('CODESPACES') != 'true' or not re.fullmatch(r'[a-zA-Z0-9-]{1,128}', name):
        raise RuntimeError('Codespace richiesto')
    return name


def gh(*args):
    env = dict(os.environ)
    env.pop('GH_DEBUG', None)
    result = subprocess.run(['gh', *args], capture_output=True, text=True, timeout=15, env=env)
    if result.returncode:
        raise RuntimeError('Verifica porta non disponibile')
    return result.stdout


def private_port():
    try:
        rows = json.loads(gh('codespace', 'ports', '-c', codespace_name(), '--json', 'sourcePort,visibility'))
        if not isinstance(rows, list):
            return False
        matches = [r for r in rows if isinstance(r, dict) and str(r.get('sourcePort')) == str(PORT)]
        return len(matches) == 1 and matches[0].get('visibility') == 'private'
    except Exception:
        return False


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        # Recheck ACL for every static request: unavailable/ambiguous => refuse.
        if not private_port():
            self.send_response(503)
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        if self.path not in FILES:
            self.send_response(404)
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        data = (ROOT / FILES[self.path]).read_bytes()
        self.send_response(200)
        self.send_header('Content-Security-Policy', CSP)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        self.send_header('Content-Type', 'text/html; charset=utf-8' if self.path == '/' else 'text/css' if self.path.endswith('.css') else 'text/javascript')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        self.send_response(405)
        self.send_header('Content-Length', '0')
        self.end_headers()


def main():
    try:
        name = codespace_name()
        # Only a privacy restriction, never public/org, never Auth credentials.
        gh('codespace', 'ports', 'visibility', f'{PORT}:private', '-c', name)
        if not private_port():
            raise RuntimeError('Porta non privata')
        httpd = HTTPServer(('127.0.0.1', PORT), Handler)
    except Exception:
        print('Avvio rifiutato. Aggiungi la porta 8765 nel pannello Porte, impostala Privata e verifica accesso gh al tuo Codespace.')
        return 1
    stop = threading.Event()

    def monitor():
        while not stop.wait(10):
            if not private_port():
                httpd.shutdown()
                return

    thread = threading.Thread(target=monitor, daemon=True)
    thread.start()
    print('Porta 8765 privata verificata. Apri dal pannello Porte. Nessun login automatico.')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        httpd.server_close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
