"""Download AI-generated sheets, key out magenta, find each sprite, save to assets/.
Driven by art/sources.json. Runs in GitHub Actions (needs internet, Pillow, numpy, scipy).

Entry fields: id, url, grid [cols, rows], dir, names (row-major, '' to skip), size (max px),
key (default true; false = plain image tiles such as backgrounds), inset (px trimmed off tiles)."""
import json, os, urllib.request
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = json.load(open(os.path.join(ROOT, 'art', 'sources.json')))
os.makedirs(os.path.join(ROOT, 'art', 'raw'), exist_ok=True)

def key_magenta(img):
    a = np.asarray(img.convert('RGBA')).astype(np.float32)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    mag = np.minimum(r, b) - g                       # how magenta a pixel is
    alpha = np.clip(1 - (mag - 50) / 110, 0, 1)      # 50 -> opaque, 160+ -> transparent
    alpha = np.where((r > 110) & (b > 110), alpha, 1.0)
    # de-spill: pull magenta tint out of semi-transparent edge pixels
    spill = (alpha < 1) & (alpha > 0)
    r = np.where(spill, np.minimum(r, g + 35), r)
    b = np.where(spill, np.minimum(b, g + 35), b)
    out = np.stack([r, g, b, al * alpha], -1).clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

for entry in spec:
    raw_name = os.path.join(ROOT, 'art', 'raw', entry['id'] + '.png')
    if not os.path.exists(raw_name):
        print('download', entry['id'])
        req = urllib.request.Request(entry['url'], headers={'User-Agent': 'Mozilla/5.0'})
        open(raw_name, 'wb').write(urllib.request.urlopen(req).read())
    sheet = Image.open(raw_name).convert('RGBA')
    cols, rows = entry.get('grid', [1, 1])
    W, H = sheet.size
    cw, ch = W / cols, H / rows
    out_dir = os.path.join(ROOT, 'assets', entry['dir'])
    os.makedirs(out_dir, exist_ok=True)
    size = entry.get('size', 256)
    names = entry['names']

    if not entry.get('key', True):
        inset = entry.get('inset', 8)
        for i, name in enumerate(names):
            if not name: continue
            cx, cy = i % cols, i // cols
            tile = sheet.crop((int(cx * cw) + inset, int(cy * ch) + inset, int((cx + 1) * cw) - inset, int((cy + 1) * ch) - inset)).convert('RGB')
            tile.thumbnail((size, size), Image.LANCZOS)
            tile.save(os.path.join(out_dir, name + '.webp'), 'WEBP', quality=82, method=6)
            print('wrote', entry['dir'], name, tile.size)
        continue

    keyed = key_magenta(sheet)
    alpha = np.asarray(keyed)[..., 3] > 60
    cells = {}
    for i in range(cols * rows):
        cx, cy = i % cols, i // cols
        x0, y0, x1, y1 = int(cx * cw), int(cy * ch), int((cx + 1) * cw), int((cy + 1) * ch)
        sub = alpha[y0:y1, x0:x1]
        labels, n = ndimage.label(ndimage.binary_dilation(sub, iterations=4))
        if not n: continue
        areas = ndimage.sum(sub, labels, range(1, n + 1))
        keep = [k + 1 for k in range(n) if areas[k] > max(areas) * 0.03]
        m = np.isin(labels, keep) & sub
        ys, xs = np.where(m)
        cells[i] = (x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1)
    for i, name in enumerate(names):
        if not name: continue
        box = cells.get(i)
        if not box:
            cx, cy = i % cols, i // cols
            box = (int(cx * cw), int(cy * ch), int((cx + 1) * cw), int((cy + 1) * ch))
            print('WARN no sprite found for', name)
        pad = 4
        tile = keyed.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(W, box[2] + pad), min(H, box[3] + pad)))
        tile.thumbnail((size, size), Image.LANCZOS)
        tile.save(os.path.join(out_dir, name + '.webp'), 'WEBP', quality=88, method=6)
        print('wrote', entry['dir'], name, tile.size)
