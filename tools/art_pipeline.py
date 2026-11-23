"""Download AI-generated sheets, slice grids, key out magenta, trim, save to assets/.
Driven by art/sources.json. Runs in GitHub Actions (needs internet + Pillow)."""
import json, io, os, sys, urllib.request
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = json.load(open(os.path.join(ROOT, 'art', 'sources.json')))
os.makedirs(os.path.join(ROOT, 'art', 'raw'), exist_ok=True)

def key_magenta(img):
    img = img.convert('RGBA')
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            # distance from magenta; pixels close to (255,0,255) become transparent
            mag = min(r, b) - g          # high when magenta-ish
            if mag > 150 and r > 150 and b > 150:
                px[x, y] = (0, 0, 0, 0)
            elif mag > 60 and r > 90 and b > 90:
                # soft edge + de-spill
                t = (mag - 60) / 90.0
                na = int(a * (1 - t))
                avg = g
                px[x, y] = (min(r, avg + 40), g, min(b, avg + 40), na)
    return img

def trim(img, pad=6):
    bbox = img.getbbox()
    if not bbox: return img
    l, t, r, b = bbox
    return img.crop((max(0, l - pad), max(0, t - pad), min(img.width, r + pad), min(img.height, b + pad)))

for entry in spec:
    url = entry['url']
    raw_name = os.path.join(ROOT, 'art', 'raw', entry['id'] + '.png')
    if not os.path.exists(raw_name):
        print('download', entry['id'])
        data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})).read()
        open(raw_name, 'wb').write(data)
    sheet = Image.open(raw_name).convert('RGBA')
    cols, rows = entry.get('grid', [1, 1])
    cw, ch = sheet.width / cols, sheet.height / rows
    out_dir = os.path.join(ROOT, 'assets', entry['dir'])
    os.makedirs(out_dir, exist_ok=True)
    for i, name in enumerate(entry['names']):
        if not name: continue
        cx, cy = i % cols, i // cols
        tile = sheet.crop((int(cx * cw), int(cy * ch), int((cx + 1) * cw), int((cy + 1) * ch)))
        if entry.get('key', True):
            tile = trim(key_magenta(tile))
        size = entry.get('size', 256)
        tile.thumbnail((size, size) if entry.get('key', True) else (size, size), Image.LANCZOS)
        dest = os.path.join(out_dir, name + '.webp')
        tile.save(dest, 'WEBP', quality=88, method=6)
        print('wrote', dest, tile.size)
