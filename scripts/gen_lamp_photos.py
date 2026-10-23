"""Dựng ảnh 5 mẫu đèn từ ẢNH CHỤP THẬT (nền đỏ, 1086×1448) do nhóm gửi → public/images/lamps/:
  <tên>.jpg          ảnh chính vuông (cắt quanh đèn, giữ nguyên ảnh chụp) — trang chi tiết, og, giỏ
  <tên>-cutout.webp  đèn tách nền trong suốt, cao 1000 px — hero, lookbook, thẻ sản phẩm (D-107)
Thay ảnh dựng lại bằng AI từ thumbnail fanpage 206 px (G-110).

Chạy (cần rembg, KHÔNG nằm trong dependencies của dự án):
  python3 -m venv /tmp/rb && /tmp/rb/bin/pip install "rembg[cpu]" pillow numpy
  /tmp/rb/bin/python -I scripts/gen_lamp_photos.py <thư-mục-ảnh-gốc> tu-linh=2.webp thu-hoach=4.webp …

Tách nền: rembg (isnet-general-use) lấy cả chao đèn và đế gỗ; dây điện bị cắt bỏ bằng cách chỉ giữ các cột nằm
trong bề rộng đế (dây đi ngang ra mép ảnh, thấp hơn chao).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/images/lamps"
OUT_H = 1000
sess = new_session("isnet-general-use")


def bbox(mask: np.ndarray):
    rows = np.where(mask.any(1))[0]
    cols = np.where(mask.any(0))[0]
    return rows.min(), rows.max(), cols.min(), cols.max()


def build(src_path: Path, name: str) -> None:
    src = Image.open(src_path).convert("RGB")
    cut = remove(src, session=sess)
    a = np.array(cut.split()[-1])
    solid = a > 128
    y0, y1, _, _ = bbox(solid)
    # Đế là phần rộng nhất ở 1/4 dưới của vật thể; chỉ giữ các cột trong bề rộng đó (bỏ dây điện)
    h = y1 - y0
    base_rows = solid[y0 + int(h * 0.82) : y1 + 1]
    widths = base_rows.sum(1)
    row = base_rows[int(np.argmax(widths))]
    cols = np.where(row)[0]
    # Đoạn liên tục dài nhất trong hàng đó = đế (dây điện là đoạn mảnh tách rời)
    runs = np.split(cols, np.where(np.diff(cols) > 3)[0] + 1)
    base = max(runs, key=len)
    # Dây cắm sát đế thì dính liền vào đoạn đế → đế đối xứng quanh tâm chao: lấy nửa rộng phía ngắn hơn
    chao = np.where(solid[y0 + int(h * 0.4)])[0]
    cx = (chao.min() + chao.max()) / 2
    half = min(cx - base.min(), base.max() - cx)
    bx0, bx1 = int(cx - half) - 6, int(cx + half) + 6
    a[:, :bx0] = 0
    a[:, bx1 + 1 :] = 0
    # Co biên 1px + làm mềm để bỏ viền đỏ của nền
    alpha = Image.fromarray(a).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    rgba = src.copy()
    rgba.putalpha(alpha)
    yy0, yy1, xx0, xx1 = bbox(np.array(alpha) > 8)
    obj = rgba.crop((xx0, yy0, xx1 + 1, yy1 + 1))
    # Đúng OUT_H (test imageQuality yêu cầu ≥ 1000 px): đèn nhỏ trong khung thì phóng nhẹ (thu-hoach 930 → 1000)
    if obj.height != OUT_H:
        obj = obj.resize((round(obj.width * OUT_H / obj.height), OUT_H), Image.LANCZOS)
    obj.save(OUT / f"{name}-cutout.webp", "WEBP", quality=88, method=6)

    # Ảnh chính: hình vuông cạnh = bề rộng ảnh, tâm theo chiều dọc của đèn (giữ nguyên ảnh chụp)
    side = src.width
    cy = (yy0 + yy1) // 2
    top = min(max(cy - side // 2, 0), src.height - side)
    sq = src.crop((0, top, side, top + side))
    sq.save(OUT / f"{name}.jpg", "JPEG", quality=86, optimize=True, progressive=True)
    print(name, "cutout", obj.size, "main", sq.size)


if __name__ == "__main__":
    srcdir = Path(sys.argv[1])
    for pair in sys.argv[2:]:
        name, file = pair.split("=", 1)
        build(srcdir / file, name)
