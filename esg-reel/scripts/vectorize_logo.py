#!/usr/bin/env python3
"""Vectorise the site's own 285x30 raster logo so it stays sharp at video scale.
Traces the anti-aliased alpha of scene/assets/site/esg/img/images__logo.png
(upsampled 16x, Lanczos) with potrace; colour = mean of opaque pixels."""
import numpy as np, potrace
from PIL import Image

SRC = "scene/assets/site/esg/img/images__logo.png"
S = 16
im = Image.open(SRC).convert("RGBA")
a = np.asarray(im).astype(float)
opaque = a[..., 3] > 250
rgb = a[opaque][:, :3].mean(0).round().astype(int)
color = "#%02x%02x%02x" % tuple(rgb)
w, h = im.size
alpha = Image.fromarray(a[..., 3].astype(np.uint8)).resize((w * S, h * S), Image.LANCZOS)
P = 4 * S  # pad so glyphs touching the image edge close cleanly
bm = np.pad(np.asarray(alpha) > 127, P)
# potracer marks pixels that are False as ink, hence the inversion
bm = ~bm
path = potrace.Bitmap(bm).trace(turdsize=20, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,
                                 alphamax=1.0, opticurve=True, opttolerance=0.2)
d = []
for curve in path:
    sp = curve.start_point
    d.append(f"M{(sp.x - P) / S:.3f},{(sp.y - P) / S:.3f}")
    for seg in curve.segments:
        if seg.is_corner:
            d.append(f"L{(seg.c.x - P) / S:.3f},{(seg.c.y - P) / S:.3f}L{(seg.end_point.x - P) / S:.3f},{(seg.end_point.y - P) / S:.3f}")
        else:
            d.append(f"C{(seg.c1.x - P) / S:.3f},{(seg.c1.y - P) / S:.3f} {(seg.c2.x - P) / S:.3f},{(seg.c2.y - P) / S:.3f} {(seg.end_point.x - P) / S:.3f},{(seg.end_point.y - P) / S:.3f}")
    d.append("Z")
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
       f'<path fill="{color}" fill-rule="evenodd" d="{"".join(d)}"/></svg>')
open("scene/assets/brand/logo.svg", "w").write(svg)
open("scene/assets/brand/logo-white.svg", "w").write(svg.replace(color, "#ffffff"))
print("colour", color, "curves", len(path), "bytes", len(svg))
