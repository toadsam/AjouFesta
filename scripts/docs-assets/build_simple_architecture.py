from __future__ import annotations

import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "assets" / "diagrams" / "simple-architecture"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1600, 900
FONT_REG = Path(r"C:\Windows\Fonts\malgun.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\malgunbd.ttf")


def font(size: int, bold: bool = False):
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REG), size)


F = {
    "kicker": font(21, True),
    "title": font(48, True),
    "body": font(24),
    "body_b": font(24, True),
    "small": font(18),
    "small_b": font(18, True),
    "tiny": font(14),
    "label": font(16, True),
}

COL = {
    "ink": (15, 23, 42),
    "muted": (71, 85, 105),
    "paper": (248, 250, 252),
    "white": (255, 255, 255),
    "line": (203, 213, 225),
    "blue": (37, 99, 235),
    "sky": (14, 165, 233),
    "green": (22, 163, 74),
    "orange": (234, 88, 12),
    "pink": (219, 39, 119),
    "violet": (124, 58, 237),
    "panel": (239, 246, 255),
    "mint": (240, 253, 244),
    "cream": (255, 247, 237),
    "rose": (253, 242, 248),
    "violet_bg": (245, 243, 255),
}


def canvas():
    img = Image.new("RGBA", (W, H), COL["paper"] + (255,))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        c = (
            int(255 * (1 - t) + 239 * t),
            int(255 * (1 - t) + 246 * t),
            int(255 * (1 - t) + 255 * t),
        )
        d.line((0, y, W, y), fill=c)
    return img


def tb(draw, text, fnt):
    return draw.textbbox((0, 0), text, font=fnt)


def wrap(draw, text: str, fnt, width: int):
    lines = []
    for raw in text.split("\n"):
        cur = ""
        for word in raw.split(" "):
            trial = word if not cur else cur + " " + word
            if tb(draw, trial, fnt)[2] <= width:
                cur = trial
            else:
                if cur:
                    lines.append(cur)
                cur = word
        if cur:
            lines.append(cur)
    return lines


def draw_text(draw, xy, text, fnt, fill=COL["ink"], max_w=None, gap=5):
    x, y = xy
    lines = text.split("\n") if max_w is None else wrap(draw, text, fnt, max_w)
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        b = tb(draw, line, fnt)
        y += b[3] - b[1] + gap
    return y


def center(draw, box, text, fnt, fill=COL["ink"], max_w=None, gap=4):
    x1, y1, x2, y2 = box
    lines = text.split("\n") if max_w is None else wrap(draw, text, fnt, max_w)
    heights = [tb(draw, line, fnt)[3] - tb(draw, line, fnt)[1] for line in lines]
    total = sum(heights) + gap * (len(lines) - 1)
    y = y1 + (y2 - y1 - total) / 2
    for line, h in zip(lines, heights):
        b = tb(draw, line, fnt)
        x = x1 + (x2 - x1 - (b[2] - b[0])) / 2
        draw.text((x, y), line, font=fnt, fill=fill)
        y += h + gap


def round_box(draw, box, fill, outline, radius=22, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def shadow(img, box, radius=24):
    x1, y1, x2, y2 = box
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.rounded_rectangle((x1 + 5, y1 + 10, x2 + 5, y2 + 10), radius=radius, fill=(15, 23, 42, 30))
    layer = layer.filter(ImageFilter.GaussianBlur(10))
    img.alpha_composite(layer)


def arrow(draw, start, end, color=COL["blue"], width=4, text=None, text_pos=0.5, dashed=False):
    x1, y1 = start
    x2, y2 = end
    if dashed:
        dx, dy = x2 - x1, y2 - y1
        dist = math.hypot(dx, dy)
        ux, uy = dx / dist, dy / dist
        cur = 0
        while cur < dist:
            a = cur
            b = min(cur + 16, dist)
            draw.line((x1 + ux * a, y1 + uy * a, x1 + ux * b, y1 + uy * b), fill=color, width=width)
            cur += 28
    else:
        draw.line((x1, y1, x2, y2), fill=color, width=width)
    angle = math.atan2(y2 - y1, x2 - x1)
    head = 15
    p1 = (x2 - head * math.cos(angle - math.pi / 6), y2 - head * math.sin(angle - math.pi / 6))
    p2 = (x2 - head * math.cos(angle + math.pi / 6), y2 - head * math.sin(angle + math.pi / 6))
    draw.polygon([(x2, y2), p1, p2], fill=color)
    if text:
        tx = x1 + (x2 - x1) * text_pos
        ty = y1 + (y2 - y1) * text_pos
        b = tb(draw, text, F["label"])
        pad_x, pad_y = 10, 5
        draw.rounded_rectangle(
            (tx - (b[2] - b[0]) / 2 - pad_x, ty - 18, tx + (b[2] - b[0]) / 2 + pad_x, ty + 10),
            radius=999,
            fill=(255, 255, 255, 235),
            outline=(226, 232, 240),
        )
        draw.text((tx - (b[2] - b[0]) / 2, ty - 17), text, font=F["label"], fill=color)


def icon_person(draw, cx, cy, color):
    draw.ellipse((cx - 14, cy - 38, cx + 14, cy - 10), outline=color, width=3)
    draw.arc((cx - 36, cy - 6, cx + 36, cy + 58), 200, 340, fill=color, width=3)


def card(img, draw, box, title, body, fill, outline, accent):
    shadow(img, box, radius=24)
    round_box(draw, box, fill=fill, outline=outline, radius=24, width=2)
    draw.rectangle((box[0], box[1], box[0] + 8, box[3]), fill=accent)
    draw.text((box[0] + 28, box[1] + 22), title, font=F["body_b"], fill=COL["ink"])
    draw_text(draw, (box[0] + 28, box[1] + 64), body, F["small"], COL["muted"], box[2] - box[0] - 56, 5)


def header(draw):
    draw.text((70, 44), "TECH ARCHITECTURE", font=F["kicker"], fill=COL["blue"])
    draw.text((70, 84), "FestFlow 기술 아키텍처", font=F["title"], fill=COL["ink"])
    draw_text(
        draw,
        (72, 148),
        "사용자 화면에서 발생한 요청이 React PWA, Spring Boot API, 핵심 서비스, DB/AI/외부 연동으로 이어지는 구조입니다.",
        F["small"],
        COL["muted"],
        1200,
    )
    draw.line((70, 205, 1530, 205), fill=(226, 232, 240), width=2)


def build():
    img = canvas()
    draw = ImageDraw.Draw(img)
    header(draw)

    # Column headers
    columns = [
        (90, 250, 300, "사용자", COL["blue"]),
        (365, 250, 300, "Frontend", COL["sky"]),
        (640, 250, 300, "Backend API", COL["green"]),
        (915, 250, 300, "Core Services", COL["orange"]),
        (1190, 250, 300, "Data / AI / External", COL["pink"]),
    ]
    for x, y, w, label, color in columns:
        draw.rounded_rectangle((x, y - 50, x + w, y - 10), radius=999, fill=(255, 255, 255), outline=(226, 232, 240))
        center(draw, (x, y - 50, x + w, y - 10), label, F["label"], color)

    # Main columns
    card(
        img,
        draw,
        (90, 285, 390, 610),
        "사용자 그룹",
        "방문객\n스태프/운영자\n관리자",
        COL["white"],
        (191, 219, 254),
        COL["blue"],
    )
    icon_person(draw, 180, 495, COL["blue"])
    icon_person(draw, 240, 495, COL["green"])
    icon_person(draw, 300, 495, COL["orange"])

    card(
        img,
        draw,
        (365, 285, 665, 610),
        "React + Vite PWA",
        "Home / Map / Booth\nAI Match 화면\nAdmin / Ops 화면\napi.js API 호출",
        COL["panel"],
        (147, 197, 253),
        COL["sky"],
    )

    card(
        img,
        draw,
        (640, 285, 940, 610),
        "Spring Boot API",
        "Controller\nSecurity Filter\nJWT / X-OPS-KEY\n요청 검증",
        COL["mint"],
        (134, 239, 172),
        COL["green"],
    )

    card(
        img,
        draw,
        (915, 285, 1215, 610),
        "핵심 서비스 계층",
        "부스·공연·공지\n예약/분실물/분석\nAI Match Service\nStreamService(SSE)",
        COL["cream"],
        (253, 186, 116),
        COL["orange"],
    )

    card(
        img,
        draw,
        (1190, 285, 1490, 610),
        "저장소/외부 연동",
        "MySQL DB\n업로드 저장소\nOpenAI API\nSMS / 지도 타일",
        COL["rose"],
        (249, 168, 212),
        COL["pink"],
    )

    # Use clear row arrows below the boxes.
    y_main = 665
    arrow(draw, (210, y_main), (515, y_main), COL["blue"], text="화면 조작")
    arrow(draw, (515, y_main), (790, y_main), COL["blue"], text="HTTP API")
    arrow(draw, (790, y_main), (1065, y_main), COL["green"], text="비즈니스 로직")
    arrow(draw, (1065, y_main), (1340, y_main), COL["pink"], text="저장/AI/외부")

    # Realtime loop
    loop_y = 765
    round_box(draw, (115, 725, 1485, 822), fill=(255, 255, 255), outline=(203, 213, 225), radius=22, width=2)
    draw.text((145, 744), "실시간 반영 흐름", font=F["body_b"], fill=COL["green"])
    draw_text(
        draw,
        (145, 782),
        "관리자/운영자가 공지·공연·부스 상태를 변경하면 Service가 DB 저장 후 StreamService로 이벤트를 발행하고, 방문객 화면의 EventSource가 즉시 갱신합니다.",
        F["small"],
        COL["muted"],
        1010,
        5,
    )
    arrow(draw, (1120, 772), (1395, 772), COL["green"], text="SSE push")
    round_box(draw, (1395, 738, 1470, 807), fill=COL["mint"], outline=(134, 239, 172), radius=16, width=2)
    center(draw, (1395, 738, 1470, 807), "UI\n갱신", F["small_b"], COL["green"])

    # Key message
    draw.rounded_rectangle((70, 842, 1530, 872), radius=999, fill=(239, 246, 255), outline=(219, 234, 254))
    center(
        draw,
        (70, 842, 1530, 872),
        "핵심: 프론트는 사용자 입력과 표시를 담당하고, 백엔드는 검증·상태 변경·AI/DB 연동·실시간 이벤트 발행을 책임집니다.",
        F["label"],
        COL["blue"],
    )

    out = OUT / "festflow_simple_technical_architecture.png"
    img.convert("RGB").save(out)
    print(out)


if __name__ == "__main__":
    build()
