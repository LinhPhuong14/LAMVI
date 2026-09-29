"""Dựng ảnh og:image 1200x630 cho LAMVI (G-23).

Nền: ảnh CC0 public/images/scene/lanterns-night-1280.webp (xem CREDITS.md).
Bảng màu theo docs/knowledge/design-rules.md §2.1.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1200, 630

DIEP_LIGHT = (251, 247, 239)
HOE_LIGHT = (226, 198, 143)
SON = (163, 50, 31)
CHAM_DEEP = (26, 39, 53)

SERIF_BOLD = "/usr/share/fonts/truetype/noto/NotoSerif-Bold.ttf"
SANS = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"


def cover(img: Image.Image, w: int, h: int) -> Image.Image:
    """Cắt ảnh theo tỉ lệ khung (giống CSS object-fit: cover)."""
    scale = max(w / img.width, h / img.height)
    resized = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    left = (resized.width - w) // 2
    top = (resized.height - h) // 2
    return resized.crop((left, top, left + w, top + h))


def main() -> None:
    src = ROOT / "public/images/scene/lanterns-night-1280.webp"
    base = cover(Image.open(src).convert("RGB"), W, H)
    # Làm mềm nền để chữ nổi lên, phủ lớp chàm đêm
    base = base.filter(ImageFilter.GaussianBlur(2))
    overlay = Image.new("RGBA", (W, H), CHAM_DEEP + (188,))
    canvas = Image.alpha_composite(base.convert("RGBA"), overlay)

    # Quầng sáng ấm phía sau chữ (như ánh đèn giấy dó)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((150, 120, 1050, 560), fill=HOE_LIGHT + (46,))
    canvas = Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(120)))

    d = ImageDraw.Draw(canvas)
    # Khung viền đôi (design-rules §3: nét mảnh, khung viền đôi)
    d.rectangle((40, 40, W - 41, H - 41), outline=HOE_LIGHT + (110,), width=2)
    d.rectangle((52, 52, W - 53, H - 53), outline=HOE_LIGHT + (60,), width=1)

    wordmark = ImageFont.truetype(SERIF_BOLD, 132)
    tagline = ImageFont.truetype(SANS, 34)
    eyebrow = ImageFont.truetype(SANS, 26)

    d.text((W // 2, 232), "LAMVI", font=wordmark, fill=DIEP_LIGHT, anchor="mm")
    # Ấn triện son: một chấm vuông nhỏ dưới chữ, theo ngôn ngữ thị giác của web
    d.rectangle((W // 2 - 26, 306, W // 2 + 26, 312), fill=SON + (255,))
    d.text((W // 2, 150), "GIẤY DÓ THỦ CÔNG · LÀNG NGHỀ TRĂM NĂM", font=eyebrow,
           fill=HOE_LIGHT + (235,), anchor="mm")
    d.text((W // 2, 372), "Đèn giấy dó thủ công làm quà tặng", font=tagline,
           fill=DIEP_LIGHT + (240,), anchor="mm")
    d.text((W // 2, 424), "kèm lời chúc gắn mã QR và video hành trình làm đèn", font=tagline,
           fill=DIEP_LIGHT + (215,), anchor="mm")

    out = ROOT / "public/images/og/default.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out, "PNG", optimize=True)
    print(f"Đã ghi {out} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
