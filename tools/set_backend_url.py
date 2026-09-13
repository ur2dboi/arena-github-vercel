#!/usr/bin/env python3
"""Point the website and admin portal at a backend URL.

    python3 tools/set_backend_url.py 'https://script.google.com/macros/s/XXXX/exec'

Updates apiUrl in index.html and DEFAULT_URL in login.html and admin.html,
then reports what changed. Used whenever the Apps Script deployment gets a new URL.
"""
import re, sys

NEW = (sys.argv[1] if len(sys.argv) > 1 else '').strip()
if not re.match(r'^https://script\.google\.com/macros/s/[\w-]+/exec$', NEW):
    print('!! that does not look like an Apps Script Web App URL.')
    print('   It should look like https://script.google.com/macros/s/XXXX/exec')
    sys.exit(1)

changed = []
for path, pattern in [
    ('index.html', r"(  apiUrl\s*:\s*')[^']*(')"),
    ('admin.html', r"(const DEFAULT_URL = ')[^']*(';)"),
]:
    s = open(path).read()
    new_s, n = re.subn(pattern, lambda m: m.group(1) + NEW + m.group(2), s, count=1)
    if n == 1 and new_s != s:
        open(path, 'w').write(new_s)
        changed.append(path)
        print(f'  updated {path}')
    elif n == 1:
        print(f'  {path}: already pointing here')
    else:
        print(f'  !! could not find the setting in {path}')
        sys.exit(1)

print()
print('Now run:  git add -A && git commit -m "Point the site at the new backend URL" && git push')
