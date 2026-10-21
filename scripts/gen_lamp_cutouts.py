"""Tách nền 5 mẫu đèn từ ảnh poster fanpage (public/images/lamps/*.jpg) → public/images/lamps/<tên>-cutout.webp (nền trong).
Dùng cho hero/lookbook để giữ hiệu ứng (quầng sáng, đung đưa) — D-107.

Chạy (cần rembg, KHÔNG nằm trong dependencies của dự án):
  python3 -m venv /tmp/rb && /tmp/rb/bin/pip install "rembg[cpu]" pillow numpy && /tmp/rb/bin/python scripts/gen_lamp_cutouts.py

Cách làm: rembg (isnet-general-use) tách chao đèn sáng; phần đế gỗ tối trùng màu nền nên không tách được →
lấy lại điểm ảnh gốc của đế, cắt bằng mặt nạ bầu dục bo. Biên được co 2px + làm mềm để bỏ quầng tối của nền.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "public/images/lamps"
NAMES = ["thu-hoach", "tu-linh", "phuc-loc-song-toan", "tam-duong-khai-thai", "lon-dan"]
SS = 3  # siêu mẫu cho mặt nạ đế
BOX0 = (110, 170, 510, 618)  # vùng chứa đèn trên poster 618×618 (toạ độ gốc; nhân K theo cỡ ảnh thực)
sess = new_session("isnet-general-use")
OUT_H = 1000  # chiều cao tối đa bản tách nền (px); ảnh nguồn càng lớn biên càng sắc


def cutout(name: str) -> Image.Image:
    src = Image.open(DIR / f"{name}.jpg").convert("RGB")
    k = src.width / 618  # hệ số cỡ so với ảnh 618 gốc (ảnh nâng cấp 824 px → 1,333)
    crop = src.crop(tuple(round(v * k) for v in BOX0))
    cut = remove(crop, session=sess)
    a = np.array(cut.split()[-1])
    rgb = np.array(crop).astype(float)
    luma = 0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2]
    bright = (a > 128) & (luma > 105)
    rows = np.where(bright.sum(1) > 25)[0]
    cols = np.where(bright.sum(0) > 25)[0]
    y0, y1, x0, x1 = rows.min(), rows.max(), cols.min(), cols.max()
    w, h = x1 - x0, y1 - y0
    arr = np.array(cut).copy()
    arr[y1 + round(2 * k) :, :, 3] = 0
    arr[: max(y0 - round(3 * k), 0), :, 3] = 0
    arr[:, : max(x0 - round(3 * k), 0), 3] = 0
    arr[:, x1 + round(4 * k) :, 3] = 0
    al = Image.fromarray(arr[..., 3]).filter(ImageFilter.MinFilter(2 * round(2.5 * k) + 1)).filter(ImageFilter.GaussianBlur(0.9 * k))
    arr[..., 3] = np.clip((np.array(al).astype(float) - 40) * 1.25, 0, 255).astype("uint8")
    shade = Image.fromarray(arr)

    bh = int(0.19 * h)
    bx0, bx1 = x0 - int(0.07 * w), x1 + int(0.07 * w)
    by0, by1 = y1 - int(0.015 * h), min(crop.height - 2, y1 + bh)
    m = Image.new("L", ((bx1 - bx0) * SS, (by1 - by0) * SS), 0)
    d = ImageDraw.Draw(m)
    w2, h2 = m.size
    d.rounded_rectangle((0, int(h2 * 0.12), w2 - 1, h2 - 1), radius=int(h2 * 0.5), fill=255)
    d.ellipse((int(w2 * 0.02), 0, int(w2 * 0.98), int(h2 * 0.40)), fill=255)
    m = m.resize((bx1 - bx0, by1 - by0), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.8 * k))
    base = crop.crop((bx0, by0, bx1, by1)).convert("RGBA")
    base.putalpha(m)

    canvas = Image.new("RGBA", crop.size, (0, 0, 0, 0))
    canvas.alpha_composite(base, (bx0, by0))
    canvas.alpha_composite(shade)
    bb = canvas.getbbox()
    pad = round(6 * k)
    canvas = canvas.crop((max(bb[0] - pad, 0), max(bb[1] - pad, 0), min(bb[2] + pad, canvas.width), min(bb[3] + pad, canvas.height)))
    f = OUT_H / canvas.height  # đưa về chiều cao OUT_H (phóng hoặc thu bằng Lanczos)
    return canvas.resize((round(canvas.width * f), OUT_H), Image.LANCZOS)


for n in NAMES:
    out = cutout(n)
    out.save(DIR / f"{n}-cutout.webp", quality=90, method=6)
    print(n, out.size)
