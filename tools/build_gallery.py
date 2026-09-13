#!/usr/bin/env python3
"""
Build (or rebuild) the photo gallery on the home page.

    python3 tools/build_gallery.py [source-folder]

Put the shop's photos in a folder — assets/raw/gallery/ by default — and run
this. It writes web-sized copies to assets/img/gallery/ and rewrites the
slide markup between the two markers in index.html:

    <!-- gallery-slides:start -->  ...  <!-- gallery-slides:end -->

Order is alphabetical by filename, so name them 01-…, 02-… if you want to
choose what comes first. Captions come from captions.txt in the same folder
(one line per photo, in the same order); without it the filename is used.

Sources are left untouched, so you can re-run this as often as you like.
"""
import os
import re
import sys
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets', 'raw', 'gallery')
OUT = os.path.join(ROOT, 'assets', 'img', 'gallery')
PAGE = os.path.join(ROOT, 'index.html')

MAX_W = 1600          # plenty for the largest screen the gallery is shown on
QUALITY = 82          # visually clean for photographs, still small
EXTS = ('.jpg', '.jpeg', '.png', '.webp')

START = '<!-- gallery-slides:start -->'
END = '<!-- gallery-slides:end -->'


def sources():
    if not os.path.isdir(SRC):
        sys.exit('no such folder: %s\n'
                 'make it and drop the photos in, or pass a folder: '
                 'python3 tools/build_gallery.py /path/to/photos' % SRC)
    files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(EXTS))
    if not files:
        sys.exit('no images in %s (looking for %s)' % (SRC, ', '.join(EXTS)))
    return files


def captions(n):
    path = os.path.join(SRC, 'captions.txt')
    if os.path.isfile(path):
        lines = [l.strip() for l in open(path, encoding='utf-8') if l.strip()]
        if len(lines) >= n:
            return lines[:n]
        print('  note: captions.txt has only %d line(s) for %d photos — '
              'falling back to filenames for the rest' % (len(lines), n))
        return lines + [None] * (n - len(lines))
    return [None] * n


def prep(src_path):
    im = Image.open(src_path)
    im = ImageOps.exif_transpose(im)          # phone photos carry rotation tags
    if im.mode in ('RGBA', 'LA', 'P'):
        bg = Image.new('RGB', im.size, (255, 255, 255))
        im = im.convert('RGBA')
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert('RGB')
    if im.width > MAX_W:
        im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
    return im


def main():
    files = sources()
    caps = captions(len(files))
    os.makedirs(OUT, exist_ok=True)

    # clear out the previous build so a shorter list does not leave strays
    for f in os.listdir(OUT):
        if f.startswith('g-') and f.lower().endswith(EXTS):
            os.remove(os.path.join(OUT, f))

    slides = []
    total = 0
    for n, name in enumerate(files, 1):
        im = prep(os.path.join(SRC, name))
        out_name = 'g-%02d.jpg' % n
        out_path = os.path.join(OUT, out_name)
        im.save(out_path, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
        size = os.path.getsize(out_path)
        total += size
        cap = caps[n - 1] or re.sub(r'[-_]+', ' ', os.path.splitext(name)[0]).strip().title()
        slides.append(
            '        <figure class="slide" role="group" aria-roledescription="slide" aria-label="%d of %d">\n'
            '          <img src="assets/img/gallery/%s" alt="%s" width="%d" height="%d" loading="lazy" decoding="async" draggable="false">\n'
            '          <figcaption>%s</figcaption>\n'
            '        </figure>' % (n, len(files), out_name, cap, im.width, im.height, cap))
        print('  %-28s -> %s  %4dx%-5d %5d KB' % (name[:28], out_name, im.width, im.height, size // 1024))

    block = START + '\n' + '\n'.join(slides) + '\n        ' + END
    page = open(PAGE, encoding='utf-8').read()
    if START not in page or END not in page:
        sys.exit('could not find the %s / %s markers in index.html' % (START, END))
    page = re.sub(re.escape(START) + r'.*?' + re.escape(END), block, page, flags=re.S)
    open(PAGE, 'w', encoding='utf-8').write(page)

    print('\n  %d photos, %d KB total, written to assets/img/gallery/ and index.html' % (len(files), total // 1024))


if __name__ == '__main__':
    main()
