"""Dựng banner đầu thư 1200x400 (hiển thị 600x200 trên thư) cho LAMVI (T-56).

Nền: ảnh CC0 public/images/scene/lanterns-night-1280.webp (xem CREDITS.md) phủ chàm đêm, giống ảnh og:image.
Bảng màu theo docs/knowledge/design-rules.md §2.1. Ảnh không chứa thông tin nào quan trọng: thư luôn có
chữ thật bên dưới và `alt` cho người chặn ảnh.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1200, 400

DIEP_LIGHT = (251, 247, 239)
HOE_LIGHT = (226, 198, 143)
SON = (163, 50, 31)
CHAM_DEEP = (26, 39, 53)

# Font có đủ dấu tiếng Việt; thử Noto trước (giống og:image), rồi tới Liberation/DejaVu
SERIF_BOLD = [
    "/usr/share/fonts/truetype/noto/NotoSerif-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
]
SANS = [
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def font(paths, size):
    for p in paths:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    raise SystemExit("Không tìm thấy font nào có đủ dấu tiếng Việt")


def cover(img, w, h):
    scale = max(w / img.width, h / img.height)
    resized = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    left = (resized.width - w) // 2
    top = (resized.height - h) // 2
    return resized.crop((left, top, left + w, top + h))


def main():
    src = ROOT / "public/images/scene/lanterns-night-1280.webp"
    base = cover(Image.open(src).convert("RGB"), W, H).filter(ImageFilter.GaussianBlur(2))
    canvas = Image.alpha_composite(base.convert("RGBA"), Image.new("RGBA", (W, H), CHAM_DEEP + (196,)))

    # Quầng sáng ấm như ánh đèn giấy dó
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((260, 40, 940, 380), fill=HOE_LIGHT + (52,))
    canvas = Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(90)))

    d = ImageDraw.Draw(canvas)
    # Khung viền đôi mảnh (design-rules §3)
    d.rectangle((28, 28, W - 29, H - 29), outline=HOE_LIGHT + (120,), width=2)
    d.rectangle((38, 38, W - 39, H - 39), outline=HOE_LIGHT + (60,), width=1)

    d.text((W // 2, 112), "ĐÈN GIẤY DÓ THỦ CÔNG", font=font(SANS, 24), fill=HOE_LIGHT + (235,), anchor="mm")
    d.text((W // 2, 206), "LAMVI", font=font(SERIF_BOLD, 118), fill=DIEP_LIGHT, anchor="mm")
    # Ấn son: thanh nhỏ dưới chữ, theo ngôn ngữ thị giác của web
    d.rectangle((W // 2 - 30, 278, W // 2 + 30, 284), fill=SON + (255,))
    d.text((W // 2, 322), "Mỗi chiếc đèn mang một lời chúc", font=font(SANS, 26), fill=DIEP_LIGHT + (225,), anchor="mm")

    out = ROOT / "public/images/mail/banner.jpg"
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out, "JPEG", quality=84, optimize=True, progressive=True)
    print(f"Đã ghi {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
