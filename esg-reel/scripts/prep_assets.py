#!/usr/bin/env python3
"""Turn the scraped captures into video-ready assets (scene/assets/v/).

- pages/<name>.jpg   : full-page screenshot, 2400 px wide (1.25x CSS px)
- cards/<i>.png      : the five ESG-menu cards of the hub page at 2x
- sky.jpg            : the site's own hero background (sub_main1.jpg)
- logo-*.svg         : colour variants of the traced site logo
"""
import json
import os
import re

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
SITE = os.path.join(ROOT, "scene/assets/site")
OUT = os.path.join(ROOT, "scene/assets/v")
os.makedirs(os.path.join(OUT, "pages"), exist_ok=True)
os.makedirs(os.path.join(OUT, "cards"), exist_ok=True)
Image.MAX_IMAGE_PIXELS = None

boxes = json.load(open(os.path.join(SITE, "boxes.json")))
meta = {}
for name in ["esg", "strategy", "environment", "social", "governance", "library"]:
    im = Image.open(os.path.join(SITE, name, "full.png")).convert("RGB")
    W = 2400
    H = round(im.height * W / im.width)
    im.resize((W, H), Image.LANCZOS).save(os.path.join(OUT, "pages", f"{name}.jpg"), quality=92, subsampling=0)
    meta[name] = {"w": W, "h": H, "css_h": im.height / 2}

# hub cards at DPR 2 (+ a little room for the drop shadow)
hub = Image.open(os.path.join(SITE, "esg", "full.png")).convert("RGB")
for i, c in enumerate(boxes["esg"]["cards"]):
    x, y, w, h = c["box"]
    hub.crop((x * 2, y * 2, (x + w) * 2, (y + h) * 2)).save(os.path.join(OUT, "cards", f"{i}.png"))
meta["cards"] = [{"t": c["t"], "box": c["box"]} for c in boxes["esg"]["cards"]]

Image.open(os.path.join(SITE, "esg/img/images__sub_main1.jpg")).convert("RGB").save(os.path.join(OUT, "sky.jpg"), quality=95)

svg = open(os.path.join(ROOT, "scene/assets/brand/logo.svg")).read()
colour = re.search(r'fill="(#[0-9a-f]{6})"', svg).group(1)
for n, c in {"blue": colour, "white": "#ffffff", "red": "#ff2d55", "cyan": "#00e1ff"}.items():
    open(os.path.join(OUT, f"logo-{n}.svg"), "w").write(svg.replace(colour, c))
meta["logo_colour"] = colour
json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), indent=1, ensure_ascii=False)
print(json.dumps(meta, ensure_ascii=False)[:400])
