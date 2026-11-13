from __future__ import annotations

import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "assets" / "diagrams" / "uml"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1600, 900

FONT_REG = Path(r"C:\Windows\Fonts\malgun.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\malgunbd.ttf")


def font(size: int, bold: bool = False):
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REG), size)


F = {
    "kicker": font(21, True),
    "title": font(46, True),
    "body": font(25),
    "body_b": font(25, True),
    "small": font(19),
    "small_b": font(19, True),
    "tiny": font(15),
    "uc": font(18, True),
    "seq": font(17, True),
}

COL = {
    "ink": (15, 23, 42),
    "muted": (71, 85, 105),
    "paper": (248, 250, 252),
    "white": (255, 255, 255),
    "line": (203, 213, 225),
    "blue": (37, 99, 235),
    "cyan": (14, 165, 233),
    "green": (22, 163, 74),
    "orange": (234, 88, 12),
    "pink": (219, 39, 119),
    "panel": (239, 246, 255),
    "mint": (240, 253, 244),
    "cream": (255, 247, 237),
    "rose": (253, 242, 248),
    "darkline": (100, 116, 139),
}


def new_canvas():
    img = Image.new("RGBA", (W, H), COL["paper"] + (255,))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / max(1, H - 1)
        r = int(255 * (1 - t) + 239 * t)
        g = int(255 * (1 - t) + 246 * t)
        b = int(255 * (1 - t) + 255 * t)
        d.line((0, y, W, y), fill=(r, g, b))
    return img


def bbox(draw, text, fnt):
    return draw.textbbox((0, 0), text, font=fnt)


def wrap(draw, text: str, fnt, max_w: int):
    result = []
    for raw in text.split("\n"):
        cur = ""
        for word in raw.split(" "):
            trial = word if not cur else cur + " " + word
            if bbox(draw, trial, fnt)[2] <= max_w:
                cur = trial
            else:
                if cur:
                    result.append(cur)
                cur = word
        if cur:
            result.append(cur)
    return result


def text(draw, xy, content, fnt, fill=COL["ink"], max_w=None, line_gap=6):
    x, y = xy
    lines = content.split("\n") if max_w is None else wrap(draw, content, fnt, max_w)
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        bb = bbox(draw, line, fnt)
        y += bb[3] - bb[1] + line_gap
    return y


def center_text(draw, box, content, fnt, fill=COL["ink"], max_w=None, line_gap=4):
    x1, y1, x2, y2 = box
    lines = content.split("\n") if max_w is None else wrap(draw, content, fnt, max_w)
    heights = [bbox(draw, line, fnt)[3] - bbox(draw, line, fnt)[1] for line in lines]
    total_h = sum(heights) + line_gap * (len(lines) - 1)
    y = y1 + (y2 - y1 - total_h) / 2
    for line, h in zip(lines, heights):
        bb = bbox(draw, line, fnt)
        x = x1 + (x2 - x1 - (bb[2] - bb[0])) / 2
        draw.text((x, y), line, font=fnt, fill=fill)
        y += h + line_gap


def header(draw, number: int, kind: str, title: str, subtitle: str):
    draw.text((70, 44), f"{number:02d}  {kind}", font=F["kicker"], fill=COL["blue"])
    draw.text((70, 82), title, font=F["title"], fill=COL["ink"])
    text(draw, (72, 145), subtitle, F["small"], COL["muted"], 1160, 6)
    draw.line((70, 204, 1530, 204), fill=(226, 232, 240), width=2)


def footer(draw, number: int):
    draw.line((70, 846, 1530, 846), fill=(226, 232, 240), width=1)
    draw.text((70, 860), "FestFlow core UML diagrams", font=F["tiny"], fill=(100, 116, 139))
    draw.text((1478, 860), f"{number:02d}/06", font=F["tiny"], fill=(100, 116, 139))


def shadow(img, box, radius=22):
    x1, y1, x2, y2 = box
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.rounded_rectangle((x1 + 5, y1 + 10, x2 + 5, y2 + 10), radius=radius, fill=(15, 23, 42, 28))
    layer = layer.filter(ImageFilter.GaussianBlur(10))
    img.alpha_composite(layer)


def round_box(draw, box, fill=COL["white"], outline=COL["line"], radius=20, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def action(draw, box, label, fill=COL["white"], outline=COL["blue"]):
    round_box(draw, box, fill=fill, outline=outline, radius=20, width=2)
    center_text(draw, box, label, F["small_b"], COL["ink"], max_w=box[2] - box[0] - 34)


def ellipse(draw, box, label, fill=COL["white"], outline=COL["blue"]):
    draw.ellipse(box, fill=fill, outline=outline, width=3)
    center_text(draw, box, label, F["uc"], COL["ink"], max_w=box[2] - box[0] - 40)


def diamond(draw, cx, cy, w, h, label, fill=COL["white"], outline=COL["orange"]):
    pts = [(cx, cy - h // 2), (cx + w // 2, cy), (cx, cy + h // 2), (cx - w // 2, cy)]
    draw.polygon(pts, fill=fill, outline=outline)
    draw.line(pts + [pts[0]], fill=outline, width=2)
    center_text(draw, (cx - w // 2 + 15, cy - h // 2 + 10, cx + w // 2 - 15, cy + h // 2 - 10), label, F["tiny"], COL["ink"], max_w=w - 40)
    return pts


def arrow(draw, start, end, color=COL["blue"], width=3, dashed=False):
    x1, y1 = start
    x2, y2 = end
    if dashed:
        dx, dy = x2 - x1, y2 - y1
        dist = math.hypot(dx, dy)
        if dist == 0:
            return
        ux, uy = dx / dist, dy / dist
        cur = 0
        while cur < dist - 14:
            a = cur
            b = min(cur + 12, dist)
            draw.line((x1 + ux * a, y1 + uy * a, x1 + ux * b, y1 + uy * b), fill=color, width=width)
            cur += 22
    else:
        draw.line((x1, y1, x2, y2), fill=color, width=width)
    angle = math.atan2(y2 - y1, x2 - x1)
    head = 13
    p1 = (x2 - head * math.cos(angle - math.pi / 6), y2 - head * math.sin(angle - math.pi / 6))
    p2 = (x2 - head * math.cos(angle + math.pi / 6), y2 - head * math.sin(angle + math.pi / 6))
    draw.polygon([(x2, y2), p1, p2], fill=color)


def assoc(draw, start, end, color=(100, 116, 139), width=2):
    draw.line((start[0], start[1], end[0], end[1]), fill=color, width=width)


def stick_actor(draw, cx, cy, label, color=COL["ink"]):
    draw.ellipse((cx - 19, cy - 70, cx + 19, cy - 32), outline=color, width=3)
    draw.line((cx, cy - 32, cx, cy + 28), fill=color, width=3)
    draw.line((cx - 44, cy - 5, cx + 44, cy - 5), fill=color, width=3)
    draw.line((cx, cy + 28, cx - 38, cy + 82), fill=color, width=3)
    draw.line((cx, cy + 28, cx + 38, cy + 82), fill=color, width=3)
    center_text(draw, (cx - 100, cy + 96, cx + 100, cy + 150), label, F["small_b"], color, max_w=190)


def usecase_overview():
    img = new_canvas()
    d = ImageDraw.Draw(img)
    header(d, 1, "USE CASE", "전체 시스템 유스케이스", "핵심 Actor와 FestFlow가 제공하는 주요 기능만 추려 전체 범위를 보여줍니다.")

    shadow(img, (345, 245, 1260, 790), radius=28)
    round_box(d, (345, 245, 1260, 790), fill=(255, 255, 255), outline=(147, 197, 253), radius=28, width=3)
    d.text((380, 270), "FestFlow System", font=F["body_b"], fill=COL["blue"])

    actors = {
        "visitor": (150, 355, "방문객"),
        "staff": (150, 635, "스태프/\n운영자"),
        "admin": (1445, 355, "관리자"),
        "external": (1445, 635, "AI API/\n외부서비스"),
    }
    for x, y, label in actors.values():
        stick_actor(d, x, y, label)

    cases = {
        "booth": (420, 330, 650, 410, "부스/혼잡도\n조회"),
        "event": (690, 330, 920, 410, "공연/공지\n확인"),
        "chat": (965, 330, 1195, 410, "AI 챗봇\n질의"),
        "aimatch": (455, 485, 755, 570, "AI Match\n프로필 등록/신청"),
        "status": (830, 485, 1130, 570, "현장 상태/\n분실물 관리"),
        "admin": (455, 650, 755, 735, "부스·공연·공지\n관리"),
        "matchadmin": (830, 650, 1130, 735, "매칭 검수/\n상태 처리"),
    }
    fills = {
        "booth": COL["panel"],
        "event": COL["panel"],
        "chat": COL["rose"],
        "aimatch": COL["rose"],
        "status": COL["mint"],
        "admin": COL["cream"],
        "matchadmin": COL["cream"],
    }
    for k, box in cases.items():
        ellipse(d, box[:4], box[4], fill=fills[k], outline=COL["blue"] if k not in ("chat", "aimatch") else COL["pink"])

    # Associations: use-case diagrams conventionally use simple lines.
    for target in ["booth", "event", "aimatch"]:
        bx = cases[target]
        assoc(d, (230, 355), (bx[0], (bx[1] + bx[3]) // 2))
    for target in ["status"]:
        bx = cases[target]
        assoc(d, (230, 635), (bx[0], (bx[1] + bx[3]) // 2))
    for target in ["admin", "matchadmin", "status"]:
        bx = cases[target]
        assoc(d, (1360, 355), (bx[2], (bx[1] + bx[3]) // 2))
    for target in ["chat", "aimatch"]:
        bx = cases[target]
        assoc(d, (1360, 635), (bx[2], (bx[1] + bx[3]) // 2))

    text(d, (330, 807), "핵심 의도: 방문객 기능, 현장 운영 기능, 관리자 기능, AI 연동 기능을 한 시스템 경계 안에 배치합니다.", F["tiny"], COL["muted"], 900)
    footer(d, 1)
    return img


def activity_visitor():
    img = new_canvas()
    d = ImageDraw.Draw(img)
    header(d, 2, "ACTIVITY", "방문객 축제 정보 탐색 흐름", "방문객이 앱에 접속해 부스/공연/혼잡도 정보를 확인하고 필요하면 AI 챗봇이나 길찾기로 이어지는 흐름입니다.")

    x = 455
    y = 235
    draw_start_end(d, x, y, start=True)
    prev = (x, y + 20)

    flow = [
        (285, "모바일/PWA로 FestFlow 접속", COL["white"]),
        (375, "홈에서 공지·추천·운영 상태 확인", COL["panel"]),
        (465, "지도/검색/필터로 부스 또는 공연 탐색", COL["white"]),
    ]
    for yy, label, fill in flow:
        box = (x - 250, yy, x + 250, yy + 58)
        arrow(d, prev, (x, yy), COL["blue"], width=3)
        action(d, box, label, fill=fill)
        prev = (x, yy + 58)

    decision_cy = 585
    diamond(d, x, decision_cy, 320, 100, "추가 안내가\n필요한가?")
    arrow(d, prev, (x, decision_cy - 50), COL["blue"], width=3)
    # Yes branch
    arrow(d, (x + 160, decision_cy), (1030, decision_cy), COL["green"], width=3)
    action(d, (1030, 540, 1450, 620), "AI 챗봇에 질문\n예: 덜 붐비는 부스 추천", fill=COL["mint"], outline=COL["green"])
    arrow(d, (1240, 620), (1240, 690), COL["green"], width=3)
    action(d, (1030, 690, 1450, 770), "부스/공연/운영 정보를 바탕으로 응답 확인", fill=COL["white"], outline=COL["green"])
    arrow(d, (1030, 730), (760, 730), COL["green"], width=3)
    text(d, (835, 558), "예", F["small_b"], COL["green"])

    # No/main branch
    arrow(d, (x, decision_cy + 50), (x, 660), COL["blue"], width=3)
    text(d, (x - 60, 635), "아니오", F["tiny"], COL["muted"])
    action(d, (x - 250, 660, x + 250, 718), "부스 상세·혼잡도·위치 확인", fill=COL["white"])
    arrow(d, (x, 718), (x, 750), COL["blue"], width=3)
    action(d, (x - 250, 750, x + 250, 808), "길찾기/즐겨찾기/방문 결정", fill=COL["panel"])
    arrow(d, (x, 808), (x, 827), COL["blue"], width=3)
    draw_start_end(d, x, 827, start=False)

    footer(d, 2)
    return img


def draw_start_end(draw, cx, cy, start=True):
    if start:
        draw.ellipse((cx - 19, cy - 19, cx + 19, cy + 19), fill=COL["ink"])
    else:
        draw.ellipse((cx - 24, cy - 24, cx + 24, cy + 24), outline=COL["ink"], width=3)
        draw.ellipse((cx - 14, cy - 14, cx + 14, cy + 14), fill=COL["ink"])


def activity_aimatch():
    img = new_canvas()
    d = ImageDraw.Draw(img)
    header(d, 3, "ACTIVITY", "AI Match 신청 및 관리자 처리 흐름", "실제 축제에서 사용한 AI Match 흐름을 사용자 영역과 관리자 영역으로 나누어 보여줍니다.")

    # Swimlanes
    round_box(d, (70, 240, 760, 805), fill=(255, 255, 255), outline=(191, 219, 254), radius=22, width=2)
    round_box(d, (840, 240, 1530, 805), fill=(255, 255, 255), outline=(253, 186, 116), radius=22, width=2)
    d.text((95, 260), "사용자 흐름", font=F["body_b"], fill=COL["blue"])
    d.text((865, 260), "관리자 흐름", font=F["body_b"], fill=COL["orange"])

    user_x = 415
    admin_x = 1185
    y = 325
    draw_start_end(d, user_x, y, True)
    prev = (user_x, y + 20)
    user_actions = [
        "QR/링크로 AI Match 접속",
        "프로필 입력 및 사진 업로드",
        "AI 이미지/프로필 생성 확인",
        "등록자 목록에서 상대 선택",
        "데이트 신청 전송",
    ]
    y += 45
    for label in user_actions:
        action(d, (user_x - 235, y, user_x + 235, y + 62), label, fill=COL["panel"])
        arrow(d, prev, (user_x, y), COL["blue"], width=3)
        prev = (user_x, y + 62)
        y += 91

    # Hand off
    arrow(d, (650, 720), (935, 720), COL["orange"], width=4)
    center_text(d, (685, 680, 910, 715), "신청 데이터 저장", F["tiny"], COL["orange"], max_w=210)

    y2 = 325
    draw_start_end(d, admin_x, y2, True)
    prev2 = (admin_x, y2 + 20)
    admin_actions = [
        "관리자 로그인",
        "등록자/사진 검수",
        "신청 내역 확인",
        "성사/대기/실패 상태 처리",
        "관리자 메모 및 운영 기록 저장",
    ]
    y2 += 45
    for label in admin_actions:
        action(d, (admin_x - 245, y2, admin_x + 245, y2 + 62), label, fill=COL["cream"], outline=COL["orange"])
        arrow(d, prev2, (admin_x, y2), COL["orange"], width=3)
        prev2 = (admin_x, y2 + 62)
        y2 += 91
    draw_start_end(d, admin_x, y2 + 6, False)
    arrow(d, prev2, (admin_x, y2 - 18), COL["orange"], width=3)

    text(d, (125, 827), "핵심 의도: AI가 참여 경험을 만들고, 관리자는 검수와 상태 처리를 통해 실제 현장 운영 안정성을 확보합니다.", F["small_b"], COL["muted"], 1280)
    footer(d, 3)
    return img


def sequence_base(number, title, subtitle, participants):
    img = new_canvas()
    d = ImageDraw.Draw(img)
    header(d, number, "SEQUENCE", title, subtitle)
    top_y = 245
    bottom_y = 785
    xs = []
    n = len(participants)
    for i, p in enumerate(participants):
        x = 120 + i * ((W - 240) / (n - 1))
        xs.append(int(x))
        round_box(d, (int(x) - 92, top_y, int(x) + 92, top_y + 62), fill=COL["white"], outline=(147, 197, 253), radius=16, width=2)
        center_text(d, (int(x) - 82, top_y + 6, int(x) + 82, top_y + 56), p, F["seq"], COL["ink"], max_w=150)
        # dashed lifeline
        y = top_y + 62
        while y < bottom_y:
            d.line((int(x), y, int(x), min(y + 12, bottom_y)), fill=(148, 163, 184), width=2)
            y += 23
    return img, d, xs, top_y, bottom_y


def seq_message(draw, xs, idx_from, idx_to, y, label, color=COL["blue"], dashed=False, response=False):
    x1 = xs[idx_from]
    x2 = xs[idx_to]
    arrow(draw, (x1, y), (x2, y), color=color, width=3 if not dashed else 2, dashed=dashed)
    left, right = min(x1, x2), max(x1, x2)
    fnt = F["tiny"] if len(label) > 24 else F["seq"]
    lines = wrap(draw, label, fnt, max(170, right - left - 30))
    label_h = len(lines) * 18
    lx = (left + right) // 2 - 190
    ly = y - label_h - 10
    draw.rounded_rectangle((lx, ly, lx + 380, ly + label_h + 12), radius=8, fill=(255, 255, 255, 230), outline=(226, 232, 240))
    center_text(draw, (lx + 8, ly + 2, lx + 372, ly + label_h + 10), label, fnt, COL["ink"], max_w=350)


def sequence_booth():
    participants = ["방문객", "React App", "Booth API", "BoothService", "MySQL DB"]
    img, d, xs, _, _ = sequence_base(
        4,
        "부스/혼잡도 조회 시퀀스",
        "방문객이 부스 목록과 혼잡도 정보를 조회할 때 프론트엔드, API, Service, DB가 동작하는 순서입니다.",
        participants,
    )
    msgs = [
        (0, 1, "부스 목록/검색 요청"),
        (1, 2, "GET /api/booths"),
        (2, 3, "getAllBooths() 호출"),
        (3, 4, "Booth, Congestion 데이터 조회"),
        (4, 3, "조회 결과 반환", COL["green"], True),
        (3, 2, "DTO 변환 후 반환", COL["green"], True),
        (2, 1, "JSON 응답", COL["green"], True),
        (1, 0, "카드/지도/혼잡도 표시", COL["green"], True),
    ]
    y = 355
    for msg in msgs:
        color = msg[3] if len(msg) > 3 else COL["blue"]
        dashed = msg[4] if len(msg) > 4 else False
        seq_message(d, xs, msg[0], msg[1], y, msg[2], color, dashed)
        y += 58
    text(d, (88, 805), "핵심 포인트: 화면은 표시와 입력을 담당하고, 혼잡도/부스 데이터의 기준은 백엔드 Service와 DB가 담당합니다.", F["small_b"], COL["muted"], 1250)
    footer(d, 4)
    return img


def sequence_admin_sse():
    participants = ["관리자", "AdminPage", "Admin API", "Service", "DB", "StreamService", "방문객 EventSource"]
    img, d, xs, _, _ = sequence_base(
        5,
        "관리자 상태 변경과 SSE 실시간 반영 시퀀스",
        "관리자가 공지 또는 부스 상태를 수정하면 저장 후 SSE 이벤트가 발행되어 방문객 화면이 즉시 갱신됩니다.",
        participants,
    )
    msgs = [
        (0, 1, "공지/부스 상태 수정"),
        (1, 2, "POST/PUT /api/admin/..."),
        (2, 3, "권한 확인 및 저장 요청"),
        (3, 4, "변경 데이터 저장"),
        (4, 3, "저장 완료", COL["green"], True),
        (3, 5, "publishNotice/Booths 이벤트"),
        (5, 6, "SSE event 전송"),
        (6, 1, "방문객 화면 state 갱신", COL["green"], True),
    ]
    y = 350
    for msg in msgs:
        color = msg[3] if len(msg) > 3 else COL["blue"]
        dashed = msg[4] if len(msg) > 4 else False
        seq_message(d, xs, msg[0], msg[1], y, msg[2], color, dashed)
        y += 57
    text(d, (88, 805), "핵심 포인트: 관리자가 한 번 저장하면 방문객은 새로고침 없이 변경된 운영 정보를 받습니다.", F["small_b"], COL["muted"], 1250)
    footer(d, 5)
    return img


def sequence_aimatch():
    participants = ["사용자", "AiMatchPage", "AiMatch API", "AiMatchService", "OpenAI/Storage", "MySQL DB", "관리자"]
    img, d, xs, _, _ = sequence_base(
        6,
        "AI Match 등록·신청·관리자 처리 시퀀스",
        "실제 축제에서 사용한 AI Match의 핵심 흐름을 등록, 신청, 관리자 처리 단계로 묶어 표현합니다.",
        participants,
    )
    msgs = [
        (0, 1, "프로필/사진 등록"),
        (1, 2, "POST /api/ai-match/profiles"),
        (2, 3, "프로필 검증 및 저장 준비"),
        (3, 4, "AI 이미지 변환/파일 저장"),
        (3, 5, "Profile 저장"),
        (0, 1, "상대 선택 후 신청"),
        (1, 2, "POST /requests"),
        (3, 5, "Request 저장"),
        (6, 2, "관리자: 신청/매칭 상태 처리"),
        (2, 3, "상태 변경 요청"),
        (3, 5, "대기/완료/실패 상태 저장"),
    ]
    y = 338
    for i, msg in enumerate(msgs):
        color = COL["pink"] if i in (3, 8, 9, 10) else COL["blue"]
        seq_message(d, xs, msg[0], msg[1], y, msg[2], color, False)
        y += 43
    text(d, (88, 805), "핵심 포인트: AI는 사용자 참여 경험을 강화하고, 관리자는 검수와 상태 처리를 통해 현장 운영을 통제합니다.", F["small_b"], COL["muted"], 1280)
    footer(d, 6)
    return img


DIAGRAMS = [
    ("01_usecase_overview.png", usecase_overview),
    ("02_activity_visitor_info_flow.png", activity_visitor),
    ("03_activity_ai_match_flow.png", activity_aimatch),
    ("04_sequence_booth_congestion_lookup.png", sequence_booth),
    ("05_sequence_admin_sse_realtime.png", sequence_admin_sse),
    ("06_sequence_ai_match_end_to_end.png", sequence_aimatch),
]


def contact_sheet(paths):
    thumb_w, thumb_h = 480, 270
    gap_x, gap_y = 38, 54
    margin = 44
    sheet = Image.new("RGB", (2 * thumb_w + gap_x + margin * 2, 3 * (thumb_h + 32) + 2 * gap_y + margin * 2), (241, 245, 249))
    d = ImageDraw.Draw(sheet)
    titles = [
        "유스케이스: 전체 시스템",
        "액티비티: 방문객 정보 탐색",
        "액티비티: AI Match 신청/관리",
        "시퀀스: 부스/혼잡도 조회",
        "시퀀스: 관리자 변경 → SSE",
        "시퀀스: AI Match 전체 흐름",
    ]
    for i, path in enumerate(paths):
        r, c = divmod(i, 2)
        x = margin + c * (thumb_w + gap_x)
        y = margin + r * (thumb_h + 32 + gap_y)
        im = Image.open(path).convert("RGB").resize((thumb_w, thumb_h), Image.LANCZOS)
        sheet.paste(im, (x, y))
        d.rectangle((x, y, x + thumb_w, y + thumb_h), outline=(203, 213, 225), width=2)
        d.text((x, y + thumb_h + 9), f"{i + 1}. {titles[i]}", font=F["small"], fill=COL["ink"])
    out = OUT / "festflow_core_diagrams_contact_sheet.png"
    sheet.save(out)
    return out


def main():
    paths = []
    for name, make in DIAGRAMS:
        path = OUT / name
        make().convert("RGB").save(path)
        paths.append(path)
    sheet = contact_sheet(paths)
    print(sheet)
    for path in paths:
        print(path)


if __name__ == "__main__":
    main()
