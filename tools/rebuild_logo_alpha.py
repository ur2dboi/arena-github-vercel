#!/usr/bin/env python3
"""Rebuild the transparent logo lockup from the supplied artwork.

    python3 tools/rebuild_logo_alpha.py

The original logo is a photograph: gold lettering lit on a warm, uneven
ivory backdrop. Thresholding that backdrop away leaves a ghost of the
lighting behind the letters — a faint grey box, most visible in the footer
where the logo is drawn largest.

Measuring the artwork shows why a brightness threshold cannot work: the lit
faces of the gold are *brighter* than the backdrop. Colour, not brightness,
is the separator — the backdrop sits at saturation 0.11-0.14, the gold at
0.25 and up. So coverage comes from saturation (for the bright metal) plus
a darkness term (for the dark outlines), and the colour channel is left
untouched: the artwork's own soft edges are anti-aliased against ivory,
which is the colour the site actually paints behind it.

Output keeps the same on-page size as before: assets/img/logo-lockup.png
"""
import numpy as np
from PIL import Image

SRC = 'assets/logo/huxley-logo-original.jpg'
OUT = 'assets/img/logo-lockup.png'
TARGET_W = 840

A = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
h, w, _ = A.shape

mx, mn = A.max(2), A.min(2)
lum = 0.2126 * A[..., 0] + 0.7152 * A[..., 1] + 0.0722 * A[..., 2]
sat = (mx - mn) / np.maximum(mx, 1.0)

# --- 1. the backdrop, as a smooth surface --------------------------------------
backdrop = (lum > 185) & (sat < 0.16)
GY, GX = 20, 7
ys = np.linspace(0, h, GY + 1).astype(int)
xs = np.linspace(0, w, GX + 1).astype(int)
grid = np.zeros((GY, GX, 3), np.float32)
for i in range(GY):
    for j in range(GX):
        sl = (slice(ys[i], ys[i + 1]), slice(xs[j], xs[j + 1]))
        m = backdrop[sl]
        vals = A[sl][m] if m.sum() > 40 else A[sl].reshape(-1, 3)
        grid[i, j] = np.median(vals, axis=0)
bg = np.asarray(Image.fromarray(np.clip(grid, 0, 255).astype(np.uint8))
                .resize((w, h), Image.BICUBIC)).astype(np.float32)
bg_lum = 0.2126 * bg[..., 0] + 0.7152 * bg[..., 1] + 0.0722 * bg[..., 2]

# --- 2. coverage: saturation catches the gold, darkness catches the outlines ----
alpha_sat = np.clip((sat - 0.155) / 0.105, 0, 1)                 # 0.155 -> 0, 0.26 -> 1
alpha_dark = np.clip((bg_lum - lum - 25) / 65.0, 0, 1)           # only genuinely dark pixels
alpha = np.maximum(alpha_sat, alpha_dark)
alpha[alpha < 0.10] = 0                   # below this it is the photo's own glow, not the logo

# --- 3. crop to the lettering, then match the footprint the site already uses ----
# Two things must not change: the letters must render at the size they do today, and
# the file must not carry the photograph's generous margins (which would make the
# logo draw smaller in the header and footer). So the crop is tight, and the canvas
# is rebuilt to the proportions of the artwork it replaces: lockup height = 1.582 x
# the height of the capital H, in an 840-wide frame.
ys, xs = np.nonzero(alpha > 0.5)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
ink, cov = A[y0:y1, x0:x1], alpha[y0:y1, x0:x1]

strip = np.nonzero(cov[:, :max(1, int(cov.shape[1] * 0.12))] > 0.5)[0]
cap = strip.max() - strip.min() + 1
scale = 165.0 / cap                                # the previous artwork's cap height
ink_w, ink_h = round(ink.shape[1] * scale), round(ink.shape[0] * scale)
canvas_w, canvas_h = max(840, ink_w + 4), round(1.582 * 165)

col = Image.fromarray(np.clip(ink, 0, 255).astype(np.uint8)).resize((ink_w, ink_h), Image.LANCZOS)
cvg = Image.fromarray(np.clip(cov * 255, 0, 255).astype(np.uint8)).resize((ink_w, ink_h), Image.LANCZOS)

out = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
out.paste(Image.merge('RGBA', (*col.split(), cvg)), ((canvas_w - ink_w) // 2, (canvas_h - ink_h) // 2))
out.save(OUT, optimize=True)

a = np.asarray(out)[:, :, 3] / 255.0
ys2, xs2 = np.nonzero(a > 0.5)
cap2 = ys2.max() - ys2.min() + 1
print(f'  {OUT}: {out.size[0]}x{out.size[1]}, {round(len(open(OUT, "rb").read())/1024)} KB')
print(f'    H height {cap2}px of a {out.size[1]}px canvas (previous file: 165px of 261px)')
