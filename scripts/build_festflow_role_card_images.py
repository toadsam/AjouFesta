from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = (
    ROOT
    / "docs"
    / "assets"
    / "presentation"
    / "role-card-images"
)

CANVAS = (1500, 1000)
SCREEN = (382, 820)
PHONE_BORDER = 22
PHONE_RADIUS = 54
SCREEN_RADIUS = 34


def load_font(size, bold=False):
    candidates = [
        Path("C:/Windows/Fonts/malgunbd.ttf") if bold else Path("C:/Windows/Fonts/malgun.ttf"),
        Path("C:/Windows/Fonts/segoeuib.ttf") if bold else Path("C:/Windows/Fonts/segoeui.ttf"),
    ]
    for font_path in candidates:
        if font_path.exists():
            return ImageFont.truetype(str(font_path), size=size)
    return ImageFont.load_default()


def cover_crop(im, size, focus=(0.5, 0.5)):
    im = im.convert("RGB")
    src_w, src_h = im.size
    dst_w, dst_h = size
    scale = max(dst_w / src_w, dst_h / src_h)
    new_size = (round(src_w * scale), round(src_h * scale))
    resized = im.resize(new_size, Image.Resampling.LANCZOS)
    max_x = resized.width - dst_w
    max_y = resized.height - dst_h
    left = round(max_x * focus[0])
    top = round(max_y * focus[1])
    return resized.crop((left, top, left + dst_w, top + dst_h))


def fit_top(im, size):
    im = im.convert("RGB")
    src_w, src_h = im.size
    dst_w, dst_h = size
    scale = max(dst_w / src_w, dst_h / src_h)
    resized = im.resize((round(src_w * scale), round(src_h * scale)), Image.Resampling.LANCZOS)
    left = max(0, (resized.width - dst_w) // 2)
    return resized.crop((left, 0, left + dst_w, dst_h))


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def tint(im, color, alpha):
    overlay = Image.new("RGB", im.size, color)
    return Image.blend(im, overlay, alpha)


def make_background(src, palette):
    bg = cover_crop(src, CANVAS, focus=palette["focus"])
    bg = bg.filter(ImageFilter.GaussianBlur(24))
    bg = tint(bg, palette["tint"], palette["tint_alpha"])

    overlay = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for y in range(CANVAS[1]):
        a = int(60 + 125 * (y / CANVAS[1]))
        draw.line([(0, y), (CANVAS[0], y)], fill=(palette["shade"][0], palette["shade"][1], palette["shade"][2], a))
    for x in range(0, CANVAS[0], 56):
        draw.line([(x, 0), (x, CANVAS[1])], fill=palette["grid"])
    for y in range(0, CANVAS[1], 56):
        draw.line([(0, y), (CANVAS[0], y)], fill=palette["grid"])

    glow = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((340, 170, 1160, 950), fill=palette["glow"])
    glow = glow.filter(ImageFilter.GaussianBlur(90))

    bg = bg.convert("RGBA")
    bg.alpha_composite(glow)
    bg.alpha_composite(overlay)
    return bg


def crop_source(path, mode):
    im = Image.open(ROOT / path).convert("RGB")
    if mode == "staff":
        return im.crop((424, 0, 856, 930))
    if mode == "admin":
        return im.crop((0, 0, im.width, 960))
    return im


def phone_composite(screen_src, palette):
    phone_w = SCREEN[0] + PHONE_BORDER * 2
    phone_h = SCREEN[1] + PHONE_BORDER * 2

    shadow = Image.new("RGBA", (phone_w + 120, phone_h + 120), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((60, 58, 60 + phone_w, 58 + phone_h), radius=PHONE_RADIUS, fill=(0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(34))

    phone = Image.new("RGBA", (phone_w, phone_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(phone)
    draw.rounded_rectangle((0, 0, phone_w - 1, phone_h - 1), radius=PHONE_RADIUS, fill=palette["phone"])
    draw.rounded_rectangle((4, 4, phone_w - 5, phone_h - 5), radius=PHONE_RADIUS - 4, outline=palette["rim"], width=3)

    screen = fit_top(screen_src, SCREEN)
    mask = rounded_mask(SCREEN, SCREEN_RADIUS)
    phone.paste(screen.convert("RGBA"), (PHONE_BORDER, PHONE_BORDER), mask)

    notch_w, notch_h = 112, 20
    notch_x = (phone_w - notch_w) // 2
    draw.rounded_rectangle((notch_x, 17, notch_x + notch_w, 17 + notch_h), radius=10, fill=(10, 14, 24, 235))
    draw.rounded_rectangle(
        (PHONE_BORDER, PHONE_BORDER, PHONE_BORDER + SCREEN[0], PHONE_BORDER + SCREEN[1]),
        radius=SCREEN_RADIUS,
        outline=palette["screen_outline"],
        width=2,
    )

    holder = Image.new("RGBA", shadow.size, (0, 0, 0, 0))
    holder.alpha_composite(shadow)
    holder.alpha_composite(phone, (60, 40))
    return holder


def draw_caption(canvas, label, sublabel, palette):
    draw = ImageDraw.Draw(canvas)
    font_big = load_font(42, bold=True)
    font_small = load_font(24)
    x, y = 96, 100
    draw.rounded_rectangle((x, y, x + 260, y + 58), radius=18, fill=palette["badge"])
    draw.text((x + 28, y + 12), label, fill=(255, 255, 255, 245), font=font_big)
    draw.text((x + 2, y + 82), sublabel, fill=(230, 240, 255, 185), font=font_small)


def make_card(name, source_path, mode, label, sublabel, palette, show_caption=True, centered=False):
    src = crop_source(source_path, mode)
    bg = make_background(src, palette)
    phone = phone_composite(src, palette)

    x = (CANVAS[0] - phone.width) // 2 + (0 if centered else palette["phone_dx"])
    y = 38 + palette["phone_dy"]
    bg.alpha_composite(phone, (x, y))

    if show_caption:
        draw_caption(bg, label, sublabel, palette)
    out_path = OUT_DIR / f"{name}_mobile_card.png"
    bg.convert("RGB").save(out_path, quality=95)
    return out_path


def make_contact_sheet(paths, filename):
    thumb_w, thumb_h = 500, 333
    label_h = 52
    sheet = Image.new("RGB", (thumb_w * len(paths), thumb_h + label_h), (245, 248, 252))
    draw = ImageDraw.Draw(sheet)
    font = load_font(22, bold=True)
    for i, path in enumerate(paths):
        im = Image.open(path).resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(im, (i * thumb_w, 0))
        draw.text((i * thumb_w + 22, thumb_h + 14), path.stem, fill=(24, 34, 54), font=font)
    out = OUT_DIR / filename
    sheet.save(out, quality=95)
    return out


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    palettes = {
        "visitor": {
            "focus": (0.52, 0.2),
            "tint": (5, 12, 30),
            "tint_alpha": 0.72,
            "shade": (1, 7, 20),
            "grid": (106, 164, 255, 12),
            "glow": (80, 150, 255, 70),
            "phone": (10, 14, 24, 255),
            "rim": (92, 126, 170, 180),
            "screen_outline": (132, 177, 245, 130),
            "badge": (55, 128, 255, 225),
            "phone_dx": 60,
            "phone_dy": 0,
        },
        "staff": {
            "focus": (0.5, 0.08),
            "tint": (2, 18, 35),
            "tint_alpha": 0.36,
            "shade": (1, 8, 18),
            "grid": (47, 225, 255, 24),
            "glow": (0, 220, 210, 82),
            "phone": (6, 13, 28, 255),
            "rim": (35, 228, 245, 170),
            "screen_outline": (56, 230, 255, 150),
            "badge": (0, 170, 200, 225),
            "phone_dx": 42,
            "phone_dy": 0,
        },
        "admin": {
            "focus": (0.5, 0.06),
            "tint": (3, 18, 28),
            "tint_alpha": 0.68,
            "shade": (2, 10, 18),
            "grid": (125, 255, 204, 12),
            "glow": (82, 232, 186, 76),
            "phone": (8, 15, 24, 255),
            "rim": (93, 210, 190, 155),
            "screen_outline": (118, 244, 211, 125),
            "badge": (23, 156, 126, 225),
            "phone_dx": 52,
            "phone_dy": 0,
        },
    }
    outputs = [
        make_card(
            "visitor",
            Path("docs") / "assets" / "qa-screenshots" / "home-mobile.png",
            "visitor",
            "VISITOR",
            "Festival guide / map / booth discovery",
            palettes["visitor"],
        ),
        make_card(
            "staff",
            Path("docs") / "assets" / "screenshots" / "previews" / "preview-stage-map.png",
            "staff",
            "STAFF",
            "Live stage capacity / field status",
            palettes["staff"],
        ),
        make_card(
            "admin",
            Path("docs") / "assets" / "screenshots" / "admin" / "admin-final-mobile.png",
            "admin",
            "ADMIN",
            "Control dashboard / AI Match operation",
            palettes["admin"],
        ),
    ]
    clean_outputs = [
        make_card(
            "visitor_clean",
            Path("docs") / "assets" / "qa-screenshots" / "home-mobile.png",
            "visitor",
            "VISITOR",
            "Festival guide / map / booth discovery",
            palettes["visitor"],
            show_caption=False,
            centered=True,
        ),
        make_card(
            "staff_clean",
            Path("docs") / "assets" / "screenshots" / "previews" / "preview-stage-map.png",
            "staff",
            "STAFF",
            "Live stage capacity / field status",
            palettes["staff"],
            show_caption=False,
            centered=True,
        ),
        make_card(
            "admin_clean",
            Path("docs") / "assets" / "screenshots" / "admin" / "admin-final-mobile.png",
            "admin",
            "ADMIN",
            "Control dashboard / AI Match operation",
            palettes["admin"],
            show_caption=False,
            centered=True,
        ),
    ]
    contact = make_contact_sheet(outputs, "role_mobile_card_contact_sheet.png")
    clean_contact = make_contact_sheet(clean_outputs, "role_mobile_card_clean_contact_sheet.png")
    for path in outputs + clean_outputs + [contact, clean_contact]:
        print(path)


if __name__ == "__main__":
    main()
