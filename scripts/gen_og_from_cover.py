"""Dựng ảnh chia sẻ mặc định 1200×630 từ ảnh bìa fanpage chính thức (G-116).
Chạy: npm run gen:og  (cần python3 + Pillow). Ảnh bìa đã cắt bỏ dải thông tin liên hệ chưa xác nhận (G-115).
"""
from pathlib import Path
from PIL import Image, ImageFilter

root = Path(__file__).resolve().parent.parent
cover = Image.open(root / "public/images/brand/cover-960x460.jpg").convert("RGB")
bg = cover.resize((1200, 630), Image.LANCZOS).filter(ImageFilter.GaussianBlur(18))
fg = cover.resize((1200, 575), Image.LANCZOS)
bg.paste(fg, (0, (630 - 575) // 2))
bg.save(root / "public/images/og/default.png", optimize=True)
print("Đã ghi public/images/og/default.png", bg.size)
