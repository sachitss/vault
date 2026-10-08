"""Render assets/icon.svg into every icon the apps and installers need.

Outputs (assets/icons/): PNGs 16–1024, maskable 512 (safe-zone padded, navy
background), apple-touch-icon 180 (opaque), favicon.ico and app.ico
(Windows, multi-size) and AppIcon.icns (macOS, written by hand because
Pillow cannot save ICNS).

Requires: playwright (chromium) and Pillow. Icons are committed, so this
only needs re-running when icon.svg changes.
"""
import asyncio, io, pathlib, struct
from PIL import Image
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'icons'
NAVY = (22, 38, 61, 255)


async def render(svg: str, size: int) -> Image.Image:
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': size, 'height': size}, device_scale_factor=1)
        await pg.set_content(f'<html><body style="margin:0;background:transparent">'
                             f'<div style="width:{size}px;height:{size}px">{svg.replace("<svg ", f"<svg width=\"{size}\" height=\"{size}\" ", 1)}</div></body></html>')
        png = await pg.screenshot(omit_background=True, clip={'x': 0, 'y': 0, 'width': size, 'height': size})
        await b.close()
    return Image.open(io.BytesIO(png)).convert('RGBA')


def icns(images: dict) -> bytes:
    """Minimal ICNS: PNG payloads under the modern type codes."""
    codes = {16: b'icp4', 32: b'icp5', 64: b'icp6', 128: b'ic07', 256: b'ic08', 512: b'ic09', 1024: b'ic10'}
    body = b''
    for size, code in codes.items():
        buf = io.BytesIO(); images[size].save(buf, 'PNG')
        data = buf.getvalue(); body += code + struct.pack('>I', len(data) + 8) + data
    return b'icns' + struct.pack('>I', len(body) + 8) + body


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    svg = (ROOT / 'assets' / 'icon.svg').read_text(encoding='utf-8')
    master = asyncio.run(render(svg, 1024))
    sizes = [16, 32, 48, 64, 128, 180, 192, 256, 512, 1024]
    imgs = {s: master.resize((s, s), Image.LANCZOS) for s in sizes}
    for s in [16, 32, 48, 64, 128, 192, 256, 512, 1024]:
        imgs[s].save(OUT / f'icon-{s}.png', optimize=True)
    # maskable: content inside the 80 % safe zone on a solid background
    m = Image.new('RGBA', (512, 512), NAVY); inner = master.resize((380, 380), Image.LANCZOS); m.alpha_composite(inner, (66, 66))
    m.save(OUT / 'icon-maskable-512.png', optimize=True)
    # apple-touch: opaque, iOS rounds the corners itself
    a = Image.new('RGBA', (180, 180), NAVY); a.alpha_composite(master.resize((150, 150), Image.LANCZOS), (15, 15))
    a.convert('RGB').save(OUT / 'apple-touch-icon.png', optimize=True)
    imgs[32].save(OUT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
    imgs[256].save(OUT / 'app.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    (OUT / 'AppIcon.icns').write_bytes(icns(imgs))
    print('icons written to', OUT)


if __name__ == '__main__':
    main()
