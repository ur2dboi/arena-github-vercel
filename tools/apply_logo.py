#!/usr/bin/env python3
"""Swap the site's placeholder mark for the real HUXLEY logo, and align the star motif."""
import re, sys

p = 'index.html'
s = open(p).read()
orig = s
n = lambda old: s.count(old)

def sub(old, new, expect=1):
    global s
    c = s.count(old)
    if c != expect:
        print(f'!! expected {expect} match(es), found {c} for: {old[:70]!r}')
        sys.exit(1)
    s = s.replace(old, new)

# ---------- 1. head: favicons, share card, meta ----------
sub("""<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path fill='%23B78830' d='M50 12l9 29 29 9-29 9-9 29-9-29-29-9 29-9z'/></svg>">""",
"""<link rel="icon" type="image/png" sizes="32x32" href="assets/logo/favicon-32.png">
<link rel="icon" type="image/png" sizes="64x64" href="assets/logo/favicon-64.png">
<link rel="icon" type="image/png" sizes="512x512" href="assets/logo/favicon-512.png">
<link rel="apple-touch-icon" href="assets/logo/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:title" content="Huxley Jewelry Creations — Handcrafted Silver &amp; Gold Jewelry">
<meta property="og:description" content="Fully customized silver and gold jewelry — wedding and engagement rings, pendants, college rings, earrings, bangles, bracelets and chains. Handcrafted to order, shipped nationwide.">
<!-- Once the site is live, change this to the full web address, e.g. https://yourdomain.com/assets/logo/og-image.jpg -->
<meta property="og:image" content="assets/logo/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">""")

# ---------- 2. header + footer: real logo image ----------
mark_header = re.search(r'<a href="#top" class="brand".*?</a>', s, re.S).group(0)
sub(mark_header, """<a href="#top" class="brand" aria-label="Huxley Jewelry Creations home">
      <img class="brand-logo" src="assets/img/logo-lockup.png" alt="Huxley Jewelry Creations" width="840" height="261">
    </a>""")

mark_footer = re.search(r'<a href="#top" class="brand" style="margin-bottom:16px">.*?</a>', s, re.S).group(0)
sub(mark_footer, """<a href="#top" class="brand" style="margin-bottom:18px" aria-label="Huxley Jewelry Creations home">
          <img class="brand-logo brand-logo--footer" src="assets/img/logo-lockup.png" alt="Huxley Jewelry Creations" width="840" height="261">
        </a>""")

# ---------- 3. brand / logo CSS ----------
sub(""".brand .mark{width:38px;height:38px;flex:none}""",
""".brand .mark{width:38px;height:38px;flex:none}
.brand-logo{height:52px;width:auto;display:block}
.brand-logo--footer{height:64px}""")

# ---------- 4. card links + nested star icons in chips and buttons ----------
sub(""".card .more{margin-top:18px;font-size:.62rem;letter-spacing:.24em;text-transform:uppercase;color:var(--gold);display:flex;align-items:center;gap:8px}""",
""".card .more{margin-top:18px;font-size:.62rem;letter-spacing:.24em;text-transform:uppercase;color:var(--gold);display:inline-flex;align-items:center;gap:8px}""")
sub(""".list-dots li{font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2);border:1px solid var(--gold-line-2);border-radius:100px;padding:5px 12px}""",
""".list-dots li{display:inline-flex;align-items:center;gap:7px;font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2);border:1px solid var(--gold-line-2);border-radius:100px;padding:5px 12px}
.list-dots .star{width:11px;height:11px}
.band h2 .star{width:30px;height:30px;display:inline-block;vertical-align:-4px;margin:0 6px}""")

for label in ['Made to order', 'Talk to us']:
    s = s.replace('<span class="more">' + label, '<a class="more" href="#contact">' + label)
sub("""<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>""",
    """<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>""", expect=6)

# hero + cta-band ghost buttons get the logo's sparkle instead of a tick
s = s.replace("""        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7.2h2.5l.4-2.9h-2.9V9.1c0-.8.2-1.4 1.5-1.4h1.5V5.1c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.1H8.2v2.9H11V21h2.5Z"/></svg>""",
              """        <i class="star" data-star aria-hidden="true"></i>""")
# the two hero .btn-ghost buttons (Request a custom piece / View the collections) — no svg there.

# CTA band heading: swap the italic split for a gold-rule + star lockup
sub("""    <h2>Have a piece in mind? <em style="font-style:italic;font-weight:300">Let's make it.</em></h2>""",
"""    <h2>Have a piece in mind?</h2>
    <div class="divider"><span></span><i class="star" data-star></i><span></span></div>""")

# ---------- 5. JS star icon -> the logo's 4-point sparkle ----------
old_star = re.search(r"const STAR = '.*?';", s, re.S).group(0)
sub(old_star, """const STAR = '<svg viewBox="0 0 100 100" aria-hidden="true"><path fill="currentColor" d="M50 2.12C54.83 44.49 54.83 45.17 92 50 54.83 54.83 54.83 55.51 50 97.88 45.17 55.51 45.17 54.83 8 50 45.17 45.17 45.17 44.49 50 2.12Z"/></svg>';""")

open(p, 'w').write(s)
print('edits applied;', len(orig), '->', len(s), 'bytes')
print('logo refs:', s.count('logo-lockup.png'), '| sparkle stars:', s.count('data-star'), '| cta arrows:', s.count('class="more"'))
