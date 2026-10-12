"""Offline tests: no socket, GitHub request or secret."""
import io
import json
import unittest
from unittest.mock import patch
import server


class ServerTests(unittest.TestCase):
    def test_private_only(self):
        for visibility in ['private', 'public', 'org', None]:
            with patch.object(server, 'codespace_name', return_value='synthetic'), patch.object(server, 'gh', return_value=json.dumps([{'sourcePort': 8765, 'visibility': visibility}])):
                self.assertEqual(server.private_port(), visibility == 'private')

    def test_unknown_denied(self):
        for result in ['[]', '{}', 'null', 'bad-json', '[{"sourcePort":8765,"visibility":"private"},{"sourcePort":8765,"visibility":"public"}]']:
            with patch.object(server, 'codespace_name', return_value='synthetic'), patch.object(server, 'gh', return_value=result):
                self.assertFalse(server.private_port())
        with patch.object(server, 'codespace_name', side_effect=RuntimeError('synthetic')):
            self.assertFalse(server.private_port())

    def test_requests(self):
        for path, private, expected in [('/', True, 200), ('/core.mjs', True, 200), ('/page.mjs', True, 200), ('/style.css', True, 200), ('/?password=synthetic', True, 404), ('/README.md', True, 404), ('/../core.mjs', True, 404), ('/', False, 503)]:
            h = object.__new__(server.Handler)
            h.path = path
            h.wfile = io.BytesIO()
            statuses, headers = [], {}
            h.send_response = statuses.append
            h.send_header = lambda k, v: headers.update({k: v})
            h.end_headers = lambda: None
            with patch.object(server, 'private_port', return_value=private):
                h.do_GET()
            self.assertEqual(statuses, [expected])
            if expected == 200:
                self.assertEqual(headers['Cache-Control'], 'no-store')
                self.assertIn('connect-src https://ilmhjsrxhnishnbocrnm.supabase.co;', headers['Content-Security-Policy'])

    def test_post_refused(self):
        h = object.__new__(server.Handler)
        statuses = []
        h.send_response = statuses.append
        h.send_header = lambda *a: None
        h.end_headers = lambda: None
        h.do_POST()
        self.assertEqual(statuses, [405])

    def test_startup_fail_closed_without_listening(self):
        with patch.object(server, 'codespace_name', return_value='synthetic'), patch.object(server, 'gh', return_value=''), patch.object(server, 'private_port', return_value=False), patch.object(server, 'HTTPServer') as http, patch('builtins.print'):
            self.assertEqual(server.main(), 1)
            http.assert_not_called()

    def test_no_codespace_no_start(self):
        with patch.dict('os.environ', {}, clear=True):
            self.assertRaises(RuntimeError, server.codespace_name)


if __name__ == '__main__':
    unittest.main()
