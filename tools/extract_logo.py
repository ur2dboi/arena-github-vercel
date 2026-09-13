#!/usr/bin/env python3
"""
Extract the HUXLEY lockup from the cream paper mockup into a transparent PNG.

The source is a photo-style mockup: textured cream paper with a soft vignette and
embossed metallic-gold lettering. Strategy:
  1. Build a SMOOTH background map (block percentile + bilinear upsample) so paper
     texture and vignette are ignored.
  2. Mark pixels that are (a) darker than that background, or (b) colour-saturated
     (the gold), which cream paper never is.
  3. Drop small blobs (texture speckle), fill letter interiors, soften edges.
"""
import sys
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage

SRC = 'assets/logo/huxley-logo-original.jpg'
P = dict(dark_lo=40.0, dark_hi=100.0,      # "darker than bg" ramp
         sat_lo=0.22, sat_hi=0.40,        # "gold" saturation ramp
         min_area=18, block=24, pct=72, gamma=1.25)

def log(*a): print(*a, flush=True)

def background_map(gray, block, pct):
    """Smooth background estimate: percentile of each block, then bilinear upsample."""
    h, w = gray.shape
    gy, gx = int(np.ceil(h / block)), int(np.ceil(w / block))
    small = np.zeros((gy, gx), np.float32)
    for j in range(gy):
        for i in range(gx):
            b = gray[j*block:(j+1)*block, i*block:(i+1)*block]
            if b.size:
                small[j, i] = np.percentile(b, pct)
    bg = np.asarray(Image.fromarray(small.astype(np.uint8)).resize((w, h), Image.BICUBIC), np.float32)
    return ndimage.gaussian_filter(bg, 6.0)

def main():
    im = Image.open(SRC).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    gray = a.mean(2)
    mx, mn = a.max(2), a.min(2)
    sat = np.where(mx > 1, (mx - mn) / np.maximum(mx, 1.0), 0.0)

    bg = background_map(gray, P['block'], P['pct'])
    dark = bg - gray
    log('dark  p50/p90/p99:', np.percentile(dark, [50, 90, 99]).round(1))
    log('sat   p50/p90/p99:', np.percentile(sat,  [50, 90, 99]).round(3))

    a_dark = np.clip((dark - P['dark_lo']) / (P['dark_hi'] - P['dark_lo']), 0, 1)
    a_sat  = np.clip((sat - P['sat_lo']) / (P['sat_hi'] - P['sat_lo']), 0, 1)
    alpha = np.maximum(a_dark, a_sat)

    # drop speckle: keep only sizeable connected blobs
    alpha = alpha ** P['gamma']
    mask = ndimage.binary_closing(alpha > 0.25, structure=np.ones((3, 3)), iterations=1)
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    keep = np.zeros_like(mask)
    for i, s in enumerate(sizes, start=1):
        if s >= P['min_area']:
            keep |= (lab == i)
    log('blobs:', n, '| kept:', int((sizes >= P['min_area']).sum()), '| coverage', round(float(keep.mean()), 3))

    alpha = np.where(keep, alpha, 0.0)

    # seal the thin specular highlights inside each stroke, then fill letter interiors
    disk = lambda r: (lambda y, x: x*x + y*y <= r*r)(*np.ogrid[-r:r+1, -r:r+1])
    closed = ndimage.binary_closing(keep, structure=disk(3), iterations=1)
    filled = ndimage.binary_fill_holes(closed).astype(np.float32)
    filled = np.clip(ndimage.gaussian_filter(filled, 0.8), 0, 1)
    alpha = np.maximum(alpha, filled * 0.92)
    alpha = np.clip(ndimage.gaussian_filter(alpha, 0.6), 0, 1)

    # un-premultiply against the background so gold stays gold on any backdrop
    A = alpha[..., None]
    fg = np.where(A > 0.05, (a - (1 - A) * bg[..., None]) / np.maximum(A, 1e-3), a)
    fg = np.clip(fg, 0, 255)

    out = Image.fromarray(np.dstack([fg, alpha * 255]).astype('uint8'), 'RGBA')
    ys, xs = np.where(alpha > 0.06)
    pad = 10
    out = out.crop((max(0, xs.min() - pad), max(0, ys.min() - pad),
                    min(out.width, xs.max() + pad), min(out.height, ys.max() + pad)))
    out.save('assets/logo/huxley-logo-transparent.png', 'PNG', optimize=True)
    web = out.resize((840, round(out.height * 840 / out.width)), Image.LANCZOS)
    web.save('assets/img/logo-lockup.png', 'PNG', optimize=True)
    log('saved', out.size, '->', web.size)

    # preview sheet on cream / beige / dark
    def strip(bghex):
        f = Image.new('RGB', (900, 300), bghex)
        lw = 740; lh = round(web.height * lw / web.width)
        l = web.resize((lw, lh), Image.LANCZOS)
        f.paste(l, ((900 - lw) // 2, (300 - lh) // 2), l)
        return f
    sheet = Image.new('RGB', (900, 940), 'white')
    for i, c in enumerate(['#FBF6EA', '#E7D8BA', '#2C2820']):
        sheet.paste(strip(c), (0, i * 310))
    sheet.save('assets/logo/_check.png')

if __name__ == '__main__':
    main()
