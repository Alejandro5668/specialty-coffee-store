"""Draws the coffee images: flat beans on a color chosen for each origin.

Run from the repository root:  python3 frontend/scripts/generate-coffee-images.py
Needs Pillow. Writes frontend/public/images/coffees/<slug>.webp (800 x 600, lossy).
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw

WIDTH, HEIGHT, SCALE = 800, 600, 3  # drawn 3x larger and shrunk, so the edges are smooth
OUT = Path(__file__).resolve().parent.parent / "public" / "images" / "coffees"

# slug: (field color, lighter disc behind the beans)
COFFEES = {
    "huila-washed": ("#6FB3AE", "#8CC7C2"),
    "narino-honey": ("#E0A236", "#EBB95C"),
    "cauca-natural": ("#B23A5B", "#C85E7B"),
    "sierra-nevada": ("#3F6F8F", "#5E8DAB"),
    "tolima-anaerobic": ("#E2683C", "#EC875F"),
    "antioquia-decaf": ("#8A9A66", "#A3B282"),
}
BEAN, CREASE, SHINE = "#2B1A10", "#150B06", "#46301F"


def bean(draw, cx, cy, length, angle):
    """One bean: an ellipse, a curved crease along its length and a soft highlight."""
    w, h = length, length * 0.68
    c, s = math.cos(angle), math.sin(angle)

    def point(x, y):
        return (cx + x * c - y * s, cy + x * s + y * c)

    outline = [point(w / 2 * math.cos(t), h / 2 * math.sin(t)) for t in [i * math.pi / 90 for i in range(180)]]
    draw.polygon(outline, fill=BEAN)
    shine = [point(w / 3 * math.cos(t) - w * 0.08, h / 4 * math.sin(t) - h * 0.14) for t in [i * math.pi / 60 for i in range(120)]]
    draw.polygon(shine, fill=SHINE)
    crease = [point(x, math.sin(x / w * math.pi * 2) * h * 0.09) for x in [(-0.46 + 0.92 * i / 40) * w for i in range(41)]]
    draw.line(crease, fill=CREASE, width=max(2, int(length * 0.055)), joint="curve")


def draw_coffee(slug, field, disc):
    rng = random.Random(slug)  # the same slug always gives the same picture
    image = Image.new("RGB", (WIDTH * SCALE, HEIGHT * SCALE), field)
    draw = ImageDraw.Draw(image)
    big = WIDTH * SCALE
    cx, cy = rng.uniform(0.3, 0.7) * big, rng.uniform(0.35, 0.6) * HEIGHT * SCALE
    radius = rng.uniform(0.28, 0.36) * big
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=disc)
    for _ in range(rng.randint(4, 6)):  # a few large beans, some running off the edge
        length = rng.uniform(0.26, 0.42) * big
        bean(draw, rng.uniform(0.08, 0.92) * big, rng.uniform(0.1, 0.9) * HEIGHT * SCALE, length, rng.uniform(0, math.pi))
    return image.resize((WIDTH, HEIGHT), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for slug, (field, disc) in COFFEES.items():
        path = OUT / f"{slug}.webp"
        draw_coffee(slug, field, disc).save(path, "WEBP", quality=80, method=6)
        print(f"{path.name}: {path.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
