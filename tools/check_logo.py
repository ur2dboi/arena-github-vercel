#!/usr/bin/env python3
"""Guard the transparent logo against the two artefacts that keep coming back.

    python3 tools/check_logo.py      ->  PASS / FAIL

1. a haze: softened backdrop pixels left behind by the original key, which
   show as a grey plaque behind the lettering (worst in the footer, where the
   logo is drawn largest);
2. blow-out: soft edges turned near-white by a divide-by-alpha step.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

PATH = 'assets/img/logo-lockup.png'
failures = []

im = Image.open(PATH).convert('RGBA')
w, h = im.size
a = np.asarray(im).astype(np.float32)
alpha = a[:, :, 3] / 255.0
rgb = a[:, :, :3]

print(f'  {PATH}: {w}x{h}')

# --- 1. haze: alpha far away from any real ink --------------------------------
ink = Image.fromarray(((alpha > 0.6) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(15))
far = np.asarray(ink) == 0
far_alpha = alpha[far]
far_above = (far_alpha > 0.15).mean()
print(f'    mean alpha far from the lettering: {far_alpha.mean():.4f}  (want < 0.010)')
print(f'    far pixels above 0.15 alpha      : {100*far_above:.2f}%  (want < 0.50%)')
if far_alpha.mean() >= 0.010: failures.append('haze behind the lettering')
if far_above >= 0.005: failures.append('a plaque far from the ink')

# --- 2. blow-out: pale pixels that the artwork never had ----------------------
white = ((rgb.min(2) > 233) & (alpha > 0.08)).sum()
print(f'    near-white pixels on soft edges  : {white}  (want 0)')
if white > 40: failures.append('near-white fringing')

# --- 3. the lettering itself must be solid ------------------------------------
core = np.asarray(Image.fromarray(((alpha > 0.85) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))) > 128
print(f'    mean alpha inside a stroke       : {alpha[core].mean():.3f}  (want > 0.95)')
if alpha[core].mean() <= 0.95: failures.append('letters are see-through')

print()
if failures:
    print('  FAIL — ' + '; '.join(failures))
    sys.exit(1)
print('  PASS — the logo sits cleanly on cream')
