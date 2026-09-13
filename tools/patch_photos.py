#!/usr/bin/env python3
"""Tag the website's photos with slot ids and load the shop's own photos at runtime."""
import re, sys

p = 'index.html'
s = open(p).read()

# ---- 1. tag each <img> with the slot id the backend knows ----
SLOT_FOR = {
    'assets/img/hero.jpg': 'hero',
    'assets/img/rings.jpg': 'rings',
    'assets/img/college-ring.jpg': 'college',
    'assets/img/pendant.jpg': 'pendant',
    'assets/img/earrings.jpg': 'earrings',
    'assets/img/bangles.jpg': 'bangles',
    'assets/img/bracelets.jpg': 'bracelets',
    'assets/img/chains.jpg': 'chains',
    'assets/img/workshop-v2.jpg': 'workshop',
}
count = 0

def tag(m):
    global count
    t = m.group(0)
    if 'data-photo' in t:
        return t
    for f, slot in SLOT_FOR.items():
        if 'src="' + f + '"' in t:
            count += 1
            return t.replace('<img ', '<img data-photo="' + slot + '" ', 1)
    return t

s = re.sub(r'<img [^>]*>', tag, s)
print('images tagged:', count, '(workshop is tagged twice on purpose)')

# ---- 2. load the photos the shop uploaded, and swap them in ----
old = """  renderCal();
  fetchLive(true);
  setInterval(() => { if (!document.hidden) fetchLive(true); }, (APPT.refreshSec || 90) * 1000);
})();"""

new = """  /* ---------- photos managed from the admin portal ---------- */
  async function fetchPhotos() {
    if (!apiUrl()) return;
    try {
      const sep = apiUrl().indexOf('?') < 0 ? '?' : '&';
      const res = await fetch(apiUrl() + sep + 'action=photos', { method: 'GET', redirect: 'follow' });
      const out = await res.json();
      if (!out || out.ok !== true || !out.photos) return;
      function apply() {
        Object.keys(out.photos).forEach(function (slot) {
          const url = out.photos[slot];
          if (!url) return;
          document.querySelectorAll('img[data-photo="' + slot + '"]').forEach(function (img) {
            if (img.getAttribute('src') !== url) img.setAttribute('src', url);
          });
        });
      }
      apply();
      if (document.readyState !== 'complete') window.addEventListener('load', apply);
      if (liveNote) liveNote.setAttribute('data-photos', '1');
    } catch (err) {
      /* no backend or offline — the built-in photos stay in place */
    }
  }

  renderCal();
  fetchLive(true);
  fetchPhotos();
  setInterval(() => { if (!document.hidden) fetchLive(true); }, (APPT.refreshSec || 90) * 1000);
})();"""

if s.count(old) != 1:
    print('!! could not find the bootstrap block')
    sys.exit(1)
s = s.replace(old, new)
open(p, 'w').write(s)
print('photo loader added')
