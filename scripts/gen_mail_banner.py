"""Dựng banner đầu thư 1200x400 (hiển thị 600x200 trên thư) cho LAMVI (T-56, T-111).

Bên phải: năm chiếc đèn của catalog (ảnh tách nền public/images/lamps/*-cutout.webp, cùng ảnh thẻ sản phẩm) xếp một hàng,
nét và đúng màu thật. Bên trái: chữ LAMVI. Nền Deep Brown, viền caramel theo docs/knowledge/design-rules.md §2.1
(không dùng chàm đêm hay đỏ son). Ảnh không chứa thông tin quan trọng: thư luôn có chữ thật bên dưới và `alt`.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1200, 400

DIEP_LIGHT = (251, 247, 239)
HOE_LIGHT = (226, 198, 143)
SON = (139, 94, 60)
CHAM_DEEP = (43, 22, 7)
LAMPS = ["thu-hoach", "tu-linh", "phuc-loc-song-toan", "tam-duong-khai-thai", "lon-dan"]

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
    canvas = Image.new("RGBA", (W, H), CHAM_DEEP + (255,))

    # Quầng sáng ấm phía sau hàng đèn
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((560, 40, 1180, 400), fill=HOE_LIGHT + (60,))
    canvas = Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(70)))

    d = ImageDraw.Draw(canvas)
    # Khung viền đôi mảnh (design-rules §3)
    d.rectangle((28, 28, W - 29, H - 29), outline=HOE_LIGHT + (120,), width=2)
    d.rectangle((38, 38, W - 39, H - 39), outline=HOE_LIGHT + (60,), width=1)

    # Hàng năm đèn catalog, đứng chung một đường nền
    lamp_h, x, base = 250, 586, 364
    for slug in LAMPS:
        lamp = Image.open(ROOT / f"public/images/lamps/{slug}-cutout.webp").convert("RGBA")
        w = round(lamp.width * lamp_h / lamp.height)
        lamp = lamp.resize((w, lamp_h), Image.LANCZOS)
        canvas.alpha_composite(lamp, (x, base - lamp_h))
        x += w + 4

    d = ImageDraw.Draw(canvas)
    d.text((84, 128), "ĐÈN GIẤY DÓ THỦ CÔNG", font=font(SANS, 22), fill=HOE_LIGHT + (235,), anchor="lm")
    d.text((84, 214), "LAMVI", font=font(SERIF_BOLD, 104), fill=DIEP_LIGHT, anchor="lm")
    # Ấn nâu be: thanh nhỏ dưới chữ, theo ngôn ngữ thị giác của web
    d.rectangle((86, 280, 146, 286), fill=SON + (255,))
    d.text((84, 322), "Mỗi chiếc đèn mang một lời chúc", font=font(SANS, 24), fill=DIEP_LIGHT + (225,), anchor="lm")

    out = ROOT / "public/images/mail/banner.jpg"
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out, "JPEG", quality=84, optimize=True, progressive=True)
    print(f"Đã ghi {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
