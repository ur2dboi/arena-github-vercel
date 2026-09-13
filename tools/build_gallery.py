#!/usr/bin/env python3
"""
Build (or rebuild) the gallery on the home page — photos and short videos.

    python3 tools/build_gallery.py [source-folder]

Put the shop's photos and clips in a folder — assets/raw/gallery/ by default —
and run this. It writes web-sized copies to assets/img/gallery/ (videos to
assets/video/) and rewrites the slide markup between the two markers in
index.html:

    <!-- gallery-slides:start -->  ...  <!-- gallery-slides:end -->

Order follows the filenames, so name them 001-…, 002-… to choose what comes
first. Captions come from captions.txt in the same folder, one line per file:

    001-photo.jpg | Wedding and engagement set

Without a captions line the filename is used. Photos are resized, videos are
re-encoded small enough for a phone, and every entry gets a poster/thumbnail
for the strip under the slideshow. Output names carry a short fingerprint of
the source file, so replacing a photo gives it a new address and visitors'
browsers cannot show them a stale picture.

Requires ffmpeg for video (photo-only builds do not). Sources are left
untouched; re-run as often as you like.
"""
import hashlib
import os
import re
import shutil
import subprocess
import sys
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets', 'raw', 'gallery')
IMG_OUT = os.path.join(ROOT, 'assets', 'img', 'gallery')
VID_OUT = os.path.join(ROOT, 'assets', 'video')
PAGE = os.path.join(ROOT, 'index.html')

PHOTO_EXT = ('.jpg', '.jpeg', '.png', '.webp')
VIDEO_EXT = ('.mp4', '.mov', '.m4v', '.webm')

MAX_W = 1440          # the photograph is never shown larger than this
QUALITY = 80
VIDEO_MAX_W = 720     # clips are watched on phones; 720 across is plenty
VIDEO_CRF = 26
THUMB = 180           # images for the strip under the slideshow

START = '<!-- gallery-slides:start -->'
END = '<!-- gallery-slides:end -->'


def sources():
    if not os.path.isdir(SRC):
        sys.exit('no such folder: %s\n'
                 'make it and drop the photos in, or pass a folder: '
                 'python3 tools/build_gallery.py /path/to/photos' % SRC)
    files = sorted(f for f in os.listdir(SRC)
                   if f.lower().endswith(PHOTO_EXT + VIDEO_EXT))
    if not files:
        sys.exit('no images or videos in %s (looking for %s)'
                 % (SRC, ', '.join(PHOTO_EXT + VIDEO_EXT)))
    return files


def captions():
    path = os.path.join(SRC, 'captions.txt')
    caps = {}
    if os.path.isfile(path):
        for line in open(path, encoding='utf-8'):
            if '|' in line:
                name, cap = line.split('|', 1)
                caps[name.strip()] = cap.strip()
    return caps


def fingerprint(path):
    h = hashlib.sha1()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()[:6]


def default_caption(name):
    return re.sub(r'[-_]+', ' ', os.path.splitext(re.sub(r'^\d+[-_ ]*', '', name))[0]).strip().title()


def prep_photo(src_path):
    im = ImageOps.exif_transpose(Image.open(src_path))
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


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def video_info(path):
    out = run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
               '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path]).stdout.strip()
    try:
        w, h = (int(x) for x in out.split(',')[:2])
    except ValueError:
        w, h = 0, 0
    dur = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
               '-of', 'csv=p=0', path]).stdout.strip()
    try:
        dur = float(dur)
    except ValueError:
        dur = 0.0
    return w, h, dur


def prep_video(src_path, out_path):
    """Re-encode to something a phone on mobile data can load."""
    w, h, dur = video_info(src_path)
    if not w:
        return None
    scale = "scale='min(%d,iw)':-2" % VIDEO_MAX_W
    r = run(['ffmpeg', '-v', 'error', '-y', '-i', src_path,
             '-vf', scale, '-c:v', 'libx264', '-preset', 'slow', '-crf', str(VIDEO_CRF),
             '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
             '-c:a', 'aac', '-b:a', '96k', out_path])
    if r.returncode or not os.path.getsize(out_path):
        r = run(['ffmpeg', '-v', 'error', '-y', '-i', src_path, '-c:v', 'libx264',
                 '-crf', str(VIDEO_CRF), '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                 '-c:a', 'aac', '-b:a', '96k', '-strict', '-2', out_path])
    if r.returncode:
        print('    ! could not re-encode: ' + r.stderr.strip()[:110])
        return None
    pw, ph, _ = video_info(out_path)
    return (pw or w), (ph or h), dur


def poster_of(src_video, out_path, at):
    run(['ffmpeg', '-v', 'error', '-y', '-ss', '%.2f' % at, '-i', src_video,
         '-frames:v', '1', '-q:v', '3', out_path])
    return os.path.isfile(out_path) and os.path.getsize(out_path) > 0


def thumb(src_img, out_path):
    im = ImageOps.exif_transpose(Image.open(src_img)).convert('RGB')
    side = min(im.size)
    im = im.crop(((im.width - side) // 2, (im.height - side) // 2,
                  (im.width + side) // 2, (im.height + side) // 2))
    im = im.resize((THUMB, THUMB), Image.LANCZOS)
    im.save(out_path, 'JPEG', quality=72, optimize=True)


def clear(folder, prefixes):
    if not os.path.isdir(folder):
        return
    for f in os.listdir(folder):
        if any(f.startswith(p) for p in prefixes) and f.lower().endswith(('.jpg', '.mp4')):
            os.remove(os.path.join(folder, f))


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def main():
    files = sources()
    caps = captions()
    need_video = any(f.lower().endswith(VIDEO_EXT) for f in files)
    if need_video and not (shutil.which('ffmpeg') and shutil.which('ffprobe')):
        sys.exit('this folder holds videos and ffmpeg is not installed.\n'
                 '  macOS: brew install ffmpeg    Windows: winget install Gyan.FFmpeg\n'
                 '  Debian/Ubuntu: sudo apt install ffmpeg')
    os.makedirs(IMG_OUT, exist_ok=True)
    os.makedirs(VID_OUT, exist_ok=True)
    clear(IMG_OUT, ('g-', 't-'))
    clear(VID_OUT, ('v-',))

    slides = []
    total = 0
    skipped = []
    for n, name in enumerate(files, 1):
        src_path = os.path.join(SRC, name)
        cap = caps.get(name) or default_caption(name)
        tag = fingerprint(src_path)
        is_video = name.lower().endswith(VIDEO_EXT)
        img_name = 'g-%02d-%s.jpg' % (n, tag)
        thumb_name = 't-%02d-%s.jpg' % (n, tag)
        out_img = os.path.join(IMG_OUT, img_name)
        out_thumb = os.path.join(IMG_OUT, thumb_name)

        if is_video:
            vid_name = 'v-%02d-%s.mp4' % (n, tag)
            out_vid = os.path.join(VID_OUT, vid_name)
            got = prep_video(src_path, out_vid)
            if not got:
                skipped.append(name)
                continue
            w, h, dur = got
            at = min(1.0, dur / 2) if dur else 0
            raw_poster = out_img + '.raw.jpg'
            if not poster_of(src_path, raw_poster, at):
                skipped.append(name)
                os.remove(out_vid)
                continue
            prep_photo(raw_poster).save(out_img, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
            os.remove(raw_poster)
            thumb(out_img, out_thumb)
            size = os.path.getsize(out_vid) + os.path.getsize(out_img)
            total += size
            media = ('<video class="slide-media" controls playsinline preload="none"\n'
                     '                 poster="assets/img/gallery/%s" width="%d" height="%d"\n'
                     '                 data-duration="%.1f" aria-label="%s (video)">\n'
                     '            <source src="assets/video/%s" type="video/mp4">\n'
                     '          </video>' % (img_name, w, h, dur, esc(cap), vid_name))
            print('  %-24s -> %s  %4dx%-5d %4.0fs  %5d KB' % (name[:24], vid_name, w, h, dur, size // 1024))
            label = 'Video: %s' % cap
        else:
            im = prep_photo(src_path)
            im.save(out_img, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
            thumb(out_img, out_thumb)
            size = os.path.getsize(out_img)
            total += size
            loading = 'eager" fetchpriority="high' if n == 1 else 'lazy'
            media = ('<img class="slide-media" src="assets/img/gallery/%s" alt="%s"\n'
                     '               width="%d" height="%d" loading="%s" decoding="async" draggable="false">'
                     % (img_name, esc(cap), im.width, im.height, loading))
            print('  %-24s -> %-22s %4dx%-5d        %5d KB' % (name[:24], img_name, im.width, im.height, size // 1024))
            label = cap

        slides.append(
            '        <figure class="slide%s" role="group" aria-roledescription="%s" aria-label="%d of %d"\n'
            '                data-kind="%s" data-thumb="assets/img/gallery/%s" data-caption="%s">\n'
            '          %s\n'
            '          <figcaption>%s</figcaption>\n'
            '        </figure>'
            % (' slide-video' if is_video else '', 'video' if is_video else 'photo',
               n, len(files) - len(skipped), 'video' if is_video else 'photo',
               thumb_name, esc(cap), media, esc(label)))

    if not slides:
        sys.exit('nothing could be built')

    block = START + '\n' + '\n'.join(slides) + '\n        ' + END
    page = open(PAGE, encoding='utf-8').read()
    if START not in page or END not in page:
        sys.exit('could not find the %s / %s markers in index.html' % (START, END))
    page = re.sub(re.escape(START) + r'.*?' + re.escape(END), lambda m: block, page, flags=re.S)
    open(PAGE, 'w', encoding='utf-8').write(page)

    if skipped:
        print('\n  skipped (unreadable): ' + ', '.join(skipped))
    vids = sum(1 for s in slides if 'slide-video' in s)
    print('\n  %d slides (%d photos, %d videos), %d KB, written to assets/img/gallery/, '
          'assets/video/ and index.html' % (len(slides), len(slides) - vids, vids, total // 1024))


if __name__ == '__main__':
    main()
