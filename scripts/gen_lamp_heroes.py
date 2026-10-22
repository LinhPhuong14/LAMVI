"""Dựng ảnh chính 1200×1200 cho 5 mẫu đèn (public/images/lamps/<tên>.jpg) — không còn chữ poster bị méo.

Vì sao: poster fanpage chỉ có thumbnail 206 px; chữ in trên poster (tên đèn, câu giới thiệu) khi nâng cấp bằng AI bị vẽ lại
thành ký tự méo. Ảnh chính mới = bản tách nền sắc nét (`<tên>-cutout.webp`) đặt lên nền ấm lấy từ chính poster gốc,
làm nhoè hẳn (chữ biến mất, giữ tông màu), thêm quầng sáng và bóng đổ dưới đế.

Chạy: python3 scripts/gen_lamp_heroes.py <thư mục chứa poster gốc 618 px> (cần Pillow, numpy).
Poster gốc không nằm trong repo; bản dựng sẵn đã có ở public/images/lamps/. Khi có ảnh chụp thật full HD thì thay luôn.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "public/images/lamps"
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else DIR
NAMES = ["thu-hoach", "tu-linh", "phuc-loc-song-toan", "tam-duong-khai-thai", "lon-dan"]
N = 1200


def hero(name: str) -> Image.Image:
    poster = Image.open(SRC / f"{name}.jpg").convert("RGB")
    # nền: poster phóng + nhoè mạnh → mất chữ, còn tông màu; làm sáng nhẹ phía sau đèn
    bg = poster.resize((N, N), Image.LANCZOS).filter(ImageFilter.GaussianBlur(46))
    arr = np.asarray(bg).astype(float)
    yy, xx = np.mgrid[0:N, 0:N]
    d = np.sqrt(((xx - N / 2) / (N * 0.55)) ** 2 + ((yy - N * 0.5) / (N * 0.6)) ** 2)
    vignette = np.clip(1.0 - 0.38 * np.clip(d - 0.35, 0, 1) ** 1.3, 0.55, 1)
    glow = np.exp(-((xx - N / 2) ** 2 + (yy - N * 0.48) ** 2) / (2 * (N * 0.2) ** 2))
    arr = arr * vignette[..., None] + glow[..., None] * np.array([70, 48, 20])
    img = Image.fromarray(np.clip(arr, 0, 255).astype("uint8")).convert("RGBA")

    cut = Image.open(DIR / f"{name}-cutout.webp").convert("RGBA")
    h = int(N * 0.78)
    cut = cut.resize((round(cut.width * h / cut.height), h), Image.LANCZOS)
    x, y = (N - cut.width) // 2, int(N * 0.11)
    # bóng đổ dưới đế
    sh = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((x - 10, y + h - 26, x + cut.width + 10, y + h + 30), fill=(0, 0, 0, 120))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(22)))
    img.alpha_composite(cut, (x, y))
    return img.convert("RGB")


for n in NAMES:
    out = hero(n)
    out.save(DIR / f"{n}.jpg", "JPEG", quality=88, optimize=True, progressive=True)
    print(n, out.size)
