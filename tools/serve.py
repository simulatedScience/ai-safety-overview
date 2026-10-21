"""Local dev server that disables caching, so edits to JS modules and data show up on reload.

Usage: python tools/serve.py [port]   (default 8000)
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(("", port), partial(NoCacheHandler, directory=str(ROOT)))
    print(f"Serving {ROOT} at http://localhost:{port}")
    server.serve_forever()
