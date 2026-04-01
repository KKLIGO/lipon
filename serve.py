#!/usr/bin/env python3
import http.server, sys, os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
DIRECTORY = sys.argv[2] if len(sys.argv) > 2 else 'dist'

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.join(os.path.dirname(__file__), DIRECTORY), **kwargs)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    def log_message(self, *args): pass

with http.server.HTTPServer(('', PORT), NoCacheHandler) as httpd:
    httpd.serve_forever()
