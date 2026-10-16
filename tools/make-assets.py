"""Generates the alarm sound and the app icons.

    python3 tools/make-assets.py

Writes docs/assets/alarm.wav, docs/icons/*.png, docs/brother/icons/*.png
and the Android app's copies of the sound and icons.
GitHub Actions runs this on every build (pip install pillow first).
"""
import math
import os
import shutil
import struct
import wave

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
ANDROID_RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

TEAL = (11, 122, 112)
TEAL_2 = (19, 163, 148)
# Drop Time+ (the brother's app): dark navy with a glowing teal-to-indigo drop.
NAVY = (8, 13, 28)
NAVY_2 = (34, 30, 88)
GLOW_A = (94, 234, 212)
GLOW_B = (129, 140, 248)


def chime(path):
    """The alarm: a clear three-note bell (E5, G#5, B5) played twice, ~2.6 s, loops well.

    Kept in the 600 Hz - 3 kHz range that phone speakers play loudly and older ears
    still hear well, with a slow fade and gentle soft-clipping so it stays loud.
    """
    rate = 22050
    length = 2.6
    n = int(rate * length)
    buf = [0.0] * n
    notes = [(0.00, 659.25), (0.18, 830.61), (0.36, 987.77), (1.20, 659.25), (1.38, 830.61), (1.56, 987.77)]
    for start, freq in notes:
        s0 = int(start * rate)
        for i in range(s0, n):
            t = (i - s0) / rate
            env = math.exp(-t * 2.4) * min(1.0, t / 0.004)
            # The envelope starts at 0 (a 4 ms fade-in), so only stop once the note has really faded.
            if t > 0.01 and env < 1e-3:
                break
            v = (math.sin(2 * math.pi * freq * t)
                 + 0.45 * math.sin(2 * math.pi * freq * 2.0 * t) * math.exp(-t * 2)
                 + 0.20 * math.sin(2 * math.pi * freq * 3.01 * t) * math.exp(-t * 4))
            buf[i] += v * env
    peak = max(abs(x) for x in buf)
    if peak < 1e-3:
        raise SystemExit("the alarm sound came out silent")
    drive = 2.2
    out = [math.tanh(drive * x / peak) / math.tanh(drive) * 0.94 for x in buf]
    # Fade the very end so the loop has no click.
    fade = int(0.05 * rate)
    for i in range(fade):
        out[n - 1 - i] *= i / fade
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1.0, min(1.0, x)) * 32767)) for x in out))


def drop_polygon(cx, cy, r, steps=180):
    """Water drop: a circle at the bottom with a point on top."""
    d = 2.1 * r
    phi = math.pi / 2 - math.asin(r / d)  # tangent angle measured from straight up
    pts = [(cx, cy - d)]
    for k in range(steps + 1):
        a = phi + (2 * math.pi - 2 * phi) * k / steps
        pts.append((cx + r * math.sin(a), cy - r * math.cos(a)))
    return pts


def gradient(S, a, b, diagonal=True):
    grad = Image.new("RGBA", (S, S))
    px = grad.load()
    for y in range(S):
        for x in range(S):
            t = (x + y) / (2 * S) if diagonal else y / S
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
    return grad


def icon(size, rounded=True, scale_content=1.0, style="classic"):
    if style == "modern":
        return modern_icon(size, rounded, scale_content)
    ss = 4
    S = size * ss
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    # Diagonal gradient background.
    grad = gradient(S, TEAL, TEAL_2)
    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    if rounded:
        md.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
    else:
        md.rectangle([0, 0, S - 1, S - 1], fill=255)
    img.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(img)
    r = S * 0.19 * scale_content
    cx, cy = S / 2, S * 0.56 + (1 - scale_content) * S * 0.02
    d.polygon(drop_polygon(cx, cy, r), fill=(255, 255, 255, 255))
    # Small clock inside the drop.
    cr = r * 0.56
    w = max(2, int(r * 0.13))
    d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], outline=TEAL + (255,), width=w)
    d.line([cx, cy, cx, cy - cr * 0.62], fill=TEAL + (255,), width=w)
    d.line([cx, cy, cx + cr * 0.5, cy + cr * 0.28], fill=TEAL + (255,), width=w)
    d.ellipse([cx - w * 0.7, cy - w * 0.7, cx + w * 0.7, cy + w * 0.7], fill=TEAL + (255,))
    return img.resize((size, size), Image.LANCZOS)


def modern_icon(size, rounded=True, scale_content=1.0):
    ss = 4
    S = size * ss
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    if rounded:
        md.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
    else:
        md.rectangle([0, 0, S - 1, S - 1], fill=255)
    img.paste(gradient(S, NAVY, NAVY_2), (0, 0), mask)

    r = S * 0.19 * scale_content
    cx, cy = S / 2, S * 0.56 + (1 - scale_content) * S * 0.02
    poly = drop_polygon(cx, cy, r)
    # Soft glow behind the drop.
    glow = Image.new("L", (S, S), 0)
    ImageDraw.Draw(glow).polygon(drop_polygon(cx, cy, r * 1.08), fill=150)
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.06))
    img.paste(Image.new("RGBA", (S, S), GLOW_A + (255,)), (0, 0), Image.composite(glow, Image.new("L", (S, S), 0), mask))
    # Drop filled with a teal-to-indigo gradient.
    drop_mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(drop_mask).polygon(poly, fill=255)
    img.paste(gradient(S, GLOW_A, GLOW_B, diagonal=False), (0, 0), drop_mask)
    # Dark clock inside, and a small "+".
    d = ImageDraw.Draw(img)
    cr = r * 0.56
    w = max(2, int(r * 0.13))
    d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], outline=NAVY + (255,), width=w)
    d.line([cx, cy, cx, cy - cr * 0.62], fill=NAVY + (255,), width=w)
    d.line([cx, cy, cx + cr * 0.5, cy + cr * 0.28], fill=NAVY + (255,), width=w)
    d.ellipse([cx - w * 0.7, cy - w * 0.7, cx + w * 0.7, cy + w * 0.7], fill=NAVY + (255,))
    px_, py_ = cx + r * 1.05, cy - r * 1.55
    arm = r * 0.36
    d.line([px_ - arm, py_, px_ + arm, py_], fill=(255, 255, 255, 255), width=w)
    d.line([px_, py_ - arm, px_, py_ + arm], fill=(255, 255, 255, 255), width=w)
    return img.resize((size, size), Image.LANCZOS)


def web_icons(folder, style):
    os.makedirs(folder, exist_ok=True)
    icon(192, style=style).save(os.path.join(folder, "icon-192.png"))
    icon(512, style=style).save(os.path.join(folder, "icon-512.png"))
    icon(512, rounded=False, scale_content=0.82, style=style).save(os.path.join(folder, "maskable-512.png"))
    icon(180, rounded=False, style=style).save(os.path.join(folder, "apple-touch-icon.png"))
    icon(64, style=style).save(os.path.join(folder, "favicon-64.png"))


def android_icons(res, style):
    for folder, px in [("mipmap-mdpi", 48), ("mipmap-hdpi", 72), ("mipmap-xhdpi", 96), ("mipmap-xxhdpi", 144), ("mipmap-xxxhdpi", 192)]:
        out = os.path.join(res, folder)
        os.makedirs(out, exist_ok=True)
        img = icon(px, style=style)
        img.save(os.path.join(out, "ic_launcher.png"))
        img.save(os.path.join(out, "ic_launcher_round.png"))


def main():
    os.makedirs(os.path.join(DOCS, "assets"), exist_ok=True)
    os.makedirs(os.path.join(DOCS, "icons"), exist_ok=True)
    wav = os.path.join(DOCS, "assets", "alarm.wav")
    chime(wav)

    web_icons(os.path.join(DOCS, "icons"), "classic")
    web_icons(os.path.join(DOCS, "brother", "icons"), "modern")

    raw = os.path.join(ANDROID_RES, "raw")
    os.makedirs(raw, exist_ok=True)
    shutil.copy(wav, os.path.join(raw, "chime.wav"))
    android_icons(ANDROID_RES, "classic")
    print("assets written")


if __name__ == "__main__":
    main()
