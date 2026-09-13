#!/usr/bin/env python3
"""Build the favicon / app-icon set and the social share image from the logo's 4-point star."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

CREAM = (251, 246, 234)
GOLD_TOP, GOLD_BOT = (226, 192, 120), (150, 101, 24)

def bezier(p0, p1, p2, p3, n=90):
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2, p3 = map(np.array, (p0, p1, p2, p3))
    return (1-t)**3*p0 + 3*(1-t)**2*t*p1 + 3*(1-t)*t**2*p2 + t**3*p3

def sparkle_points(size, cx, cy, r, waist=0.115, stretch=1.14):
    """4-point concave star, like the logo's star mark."""
    P = np.array([
        bezier((cx, cy-r*stretch), (cx+r*waist, cy-r*waist*stretch), (cx+r*waist, cy-r*waist), (cx+r, cy)),
        bezier((cx+r, cy), (cx+r*waist, cy+r*waist), (cx+r*waist, cy+r*waist*stretch), (cx, cy+r*stretch)),
        bezier((cx, cy+r*stretch), (cx-r*waist, cy+r*waist*stretch), (cx-r*waist, cy+r*waist), (cx-r, cy)),
        bezier((cx-r, cy), (cx-r*waist, cy-r*waist), (cx-r*waist, cy-r*waist*stretch), (cx, cy-r*stretch)),
    ]).reshape(-1, 2)
    return [tuple(p) for p in P]

def gradient_star(size, r_frac=0.36):
    """RGBA image: metallic gold sparkle on transparent background."""
    S = size * 4                                     # supersample for clean edges
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).polygon(sparkle_points(S, S/2, S/2, S*r_frac), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)

    y = np.linspace(0, 1, size)[:, None] * np.ones((1, size))
    grad = np.zeros((size, size, 3), np.uint8)
    for c in range(3):
        grad[:, :, c] = (GOLD_TOP[c] + (GOLD_BOT[c]-GOLD_TOP[c]) * y).astype(np.uint8)
    # metallic sheen: brighten the upper-left edge
    xx = np.linspace(0, 1, size)[None, :] * np.ones((size, 1))
    sheen = np.clip(1.22 - 0.55*(xx + y)/2, 0.55, 1.25)
    grad = np.clip(grad * sheen[..., None], 0, 255).astype(np.uint8)

    out = np.dstack([grad, np.asarray(mask)])
    return Image.fromarray(out, 'RGBA')

def icon(px, path, disc=True):
    canvas = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    if disc:
        S = px * 4
        d = Image.new('L', (S, S), 0)
        pad = int(S * 0.015)
        ImageDraw.Draw(d).ellipse([pad, pad, S-pad, S-pad], fill=255)
        d = d.resize((px, px), Image.LANCZOS)
        layer = Image.new('RGBA', (px, px), CREAM + (255,))
        canvas = Image.composite(layer, canvas, d)
        ring = Image.new('RGBA', (px, px), (0, 0, 0, 0))
        S2 = px * 4
        rd = Image.new('L', (S2, S2), 0)
        ImageDraw.Draw(rd).ellipse([pad, pad, S2-pad, S2-pad], outline=255,
                                   width=max(2, int(S2*0.016)))
        rd = rd.resize((px, px), Image.LANCZOS)
        ring.paste((169, 118, 28, 190), (0, 0), rd)
        canvas = Image.alpha_composite(canvas, ring)
    st = gradient_star(px, r_frac=0.33 if disc else 0.45)
    canvas = Image.alpha_composite(canvas, st)
    canvas.save(path, 'PNG', optimize=True)
    return path

for px, f in [(512, 'assets/logo/favicon-512.png'),
              (180, 'assets/logo/apple-touch-icon.png'),
              (64,  'assets/logo/favicon-64.png'),
              (32,  'assets/logo/favicon-32.png')]:
    icon(px, f)
gradient_star(512, 0.46).save('assets/logo/huxley-star.png', 'PNG', optimize=True)
print('icons done')

# ---- social share image (1200x630): logo lockup centred on cream ----
W, H = 1200, 630
og = Image.new('RGB', (W, H), CREAM)
logo = Image.open('assets/logo/huxley-logo-transparent.png').convert('RGBA')
lw = 820
logo = logo.resize((lw, round(logo.height*lw/logo.width)), Image.LANCZOS)
og.paste(logo, ((W-lw)//2, (H-logo.height)//2), logo)
# soft vignette to keep it from looking flat
v = np.zeros((H, W, 3), np.float32)
yy, xx = np.mgrid[0:H, 0:W]
r = np.sqrt(((xx-W/2)/(W/2))**2 + ((yy-H/2)/(H/2))**2)
shade = np.clip(1 - 0.10*np.clip(r-0.35, 0, None)**1.6, 0.86, 1.0)
og = Image.fromarray(np.clip(np.asarray(og, np.float32)*shade[..., None], 0, 255).astype('uint8'))
og.save('assets/logo/og-image.jpg', 'JPEG', quality=88, optimize=True, progressive=True)
print('og image done', og.size)

# zoomed check of the 32px favicon
z = Image.open('assets/logo/favicon-32.png').resize((288, 288), Image.NEAREST)
sheet = Image.new('RGB', (330, 330), 'white'); sheet.paste(z, (21, 21), z)
sheet.save('assets/logo/_fav.png')
