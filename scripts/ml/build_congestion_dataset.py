from __future__ import annotations

import argparse
import csv
import math
import random
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path


LABELS = ["LOW", "NORMAL", "BUSY", "VERY_BUSY"]
ZONE_TYPES = ["STAGE", "PUB", "FOOD", "EXPERIENCE", "GOODS", "SAFETY"]
POPULARITY_VALUES = ["LOW", "MEDIUM", "HIGH"]


def parse_int(value: str | None, default: int = 0) -> int:
    try:
        if value is None or value == "":
            return default
        return max(0, int(float(value)))
    except ValueError:
        return default


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def label_from_score(score: float) -> str:
    if score >= 75:
        return "VERY_BUSY"
    if score >= 55:
        return "BUSY"
    if score >= 30:
        return "NORMAL"
    return "LOW"


def rule_based_level(row: dict[str, int | float | str]) -> str:
    gps = int(row["gps_count_nearby"])
    reservations = int(row["reservation_count"])
    checked_in = int(row["checked_in_count"])
    wait = int(row["wait_minutes"])
    stock = int(row["remaining_stock"])
    seats = int(row["available_seats"])
    event_soon = int(row["event_soon"])

    score = 0
    score += min(30, gps * 2.2)
    score += min(20, wait / 2)
    score += min(20, reservations * 4)
    score += min(10, checked_in * 3)
    if seats <= 0 and reservations > 0:
        score += 10
    elif seats <= 3 and reservations > 0:
        score += 6
    if stock <= 0:
        score += 14
    elif stock <= 10:
        score += 8
    if event_soon:
        score += 6
    return label_from_score(max(0, min(100, score)))


def target_congestion(row: dict[str, int | float | str], rng: random.Random) -> str:
    zone = str(row["zone_type"])
    hour = int(row["hour"])
    popularity = str(row["artist_popularity"])
    peak = int(row["is_peak_time"])
    crowd = int(row["expected_stage_crowd"])
    capacity = int(row["stage_capacity"])
    wait = int(row["wait_minutes"])
    reservations = int(row["reservation_count"])
    checked_in = int(row["checked_in_count"])
    stock = int(row["remaining_stock"])
    gps = int(row["gps_count_nearby"])
    night = int(row["is_night_booth"])

    score = 0.0
    score += min(28, gps * 1.8)
    score += min(18, wait * 0.45)
    score += min(16, reservations * 3.0)
    score += min(8, checked_in * 2.0)
    score += 10 if stock <= 10 else 0

    stage_ratio = crowd / max(1, capacity)
    if zone == "STAGE":
        score += stage_ratio * 48
        if peak:
            score += 10
        if popularity == "HIGH":
            score += 16
        elif popularity == "MEDIUM":
            score += 7
    elif zone in {"PUB", "FOOD"}:
        score += night * 15
        score += 10 if hour >= 20 else 0
        if peak and popularity == "LOW":
            score += 18
        elif peak and popularity == "MEDIUM":
            score += 9
        elif peak and popularity == "HIGH":
            score -= 6
    elif zone == "EXPERIENCE":
        score += 12 if 13 <= hour <= 17 else 4
        score += 8 if peak and popularity != "HIGH" else 0
    elif zone == "GOODS":
        score += 9 if 16 <= hour <= 21 else 2
    else:
        score += 7 if peak else 1

    score += rng.gauss(0, 5.5)
    return label_from_score(max(0, min(100, score)))


def popularity_for_day(day: int, hour: int, rng: random.Random) -> str:
    # Weekend-like scenarios and a few fixed headline days create stronger stage demand.
    if day in {3, 7, 11, 14} and 18 <= hour <= 22:
        return "HIGH"
    if 18 <= hour <= 22:
        return rng.choices(POPULARITY_VALUES, weights=[0.35, 0.4, 0.25], k=1)[0]
    return rng.choices(POPULARITY_VALUES, weights=[0.5, 0.35, 0.15], k=1)[0]


def build_rows(source_dir: Path, target_rows: int, seed: int) -> list[dict[str, int | float | str]]:
    rng = random.Random(seed)
    booths = read_csv(source_dir / "booths.csv")
    reservations = read_csv(source_dir / "booth_reservations.csv")
    gps_logs = read_csv(source_dir / "gps_logs.csv")
    events = read_csv(source_dir / "events.csv")

    reservation_count_by_booth = Counter(parse_int(row.get("booth_id")) for row in reservations)
    checked_in_by_booth = Counter(
        parse_int(row.get("booth_id")) for row in reservations if row.get("status") == "CHECKED_IN"
    )
    gps_base = max(5, min(80, math.ceil(len(gps_logs) / max(1, len(booths) * 4))))
    event_count = max(1, len(events))

    booth_ids_by_zone: dict[str, list[int]] = defaultdict(list)
    for index, booth in enumerate(booths, start=1):
        display_order = parse_int(booth.get("display_order"), index)
        estimated_wait = parse_int(booth.get("estimated_wait_minutes"))
        reservation_enabled = str(booth.get("reservation_enabled", "")).lower() == "true"
        if display_order in {41, 42} or estimated_wait >= 60:
            zone = "STAGE"
        elif reservation_enabled and 18 <= display_order <= 35:
            zone = "PUB"
        elif display_order % 5 in {0, 2}:
            zone = "FOOD"
        elif display_order % 5 == 1:
            zone = "EXPERIENCE"
        elif display_order % 5 == 3:
            zone = "GOODS"
        else:
            zone = "SAFETY"
        booth_ids_by_zone[zone].append(parse_int(booth.get("id"), index))

    for zone in ZONE_TYPES:
        booth_ids_by_zone.setdefault(zone, [0])

    rows: list[dict[str, int | float | str]] = []
    day = 1
    while len(rows) < target_rows:
        for hour in range(10, 25):
            popularity = popularity_for_day(day, hour, rng)
            is_peak = int(18 <= hour <= 22)
            capacity = 4000

            if popularity == "HIGH" and is_peak:
                stage_crowd = rng.randint(2600, 4200)
            elif popularity == "MEDIUM" and is_peak:
                stage_crowd = rng.randint(1400, 3000)
            elif is_peak:
                stage_crowd = rng.randint(450, 1600)
            else:
                stage_crowd = rng.randint(120, 1100)

            for zone in ZONE_TYPES:
                if len(rows) >= target_rows:
                    break

                booth_id = rng.choice(booth_ids_by_zone[zone])
                is_night_booth = int(zone in {"PUB", "FOOD"} and hour >= 18)
                event_soon = int(zone == "STAGE" and is_peak)
                minutes_to_next_event = max(0, 18 * 60 - hour * 60) if hour < 18 else rng.choice([0, 10, 20, 30, 45])

                zone_factor = {
                    "STAGE": 1.7 if popularity == "HIGH" and is_peak else 1.0 if is_peak else 0.45,
                    "PUB": 1.35 if is_night_booth and popularity != "HIGH" else 0.9 if is_night_booth else 0.35,
                    "FOOD": 1.25 if is_night_booth and popularity != "HIGH" else 0.85 if is_night_booth else 0.45,
                    "EXPERIENCE": 0.75 if 12 <= hour <= 17 else 0.45,
                    "GOODS": 0.65 if 16 <= hour <= 21 else 0.35,
                    "SAFETY": 0.35 + (0.2 * is_peak),
                }[zone]

                gps_count = max(0, int(rng.gauss(gps_base * zone_factor, 7)))
                previous_gps_5m = max(0, int(rng.gauss(gps_count - (4 if is_peak else 1), 5)))
                previous_gps_15m = max(0, int(rng.gauss(gps_count - (8 if is_peak else 2), 7)))
                gps_delta_5m = gps_count - previous_gps_5m
                gps_delta_15m = gps_count - previous_gps_15m
                base_reservations = reservation_count_by_booth.get(booth_id, 0)
                reservation_count = max(
                    0,
                    int(
                        rng.gauss(
                            base_reservations + (8 if zone in {"PUB", "FOOD"} and is_night_booth else 2),
                            3,
                        )
                    ),
                )
                checked_in_count = min(reservation_count, max(0, int(rng.gauss(checked_in_by_booth.get(booth_id, 0) + reservation_count * 0.45, 2))))
                reservation_delta_15m = max(0, int(rng.gauss((3 if is_night_booth else 1) + reservation_count * 0.18, 2)))
                checked_in_delta_15m = max(0, int(rng.gauss(checked_in_count * 0.22, 1.5)))
                available_seats = max(0, int(rng.gauss(18 - reservation_count * 1.5, 4)))

                wait_base = {
                    "STAGE": 18,
                    "PUB": 16,
                    "FOOD": 13,
                    "EXPERIENCE": 8,
                    "GOODS": 7,
                    "SAFETY": 2,
                }[zone]
                wait_minutes = max(0, int(rng.gauss(wait_base + gps_count * 0.28 + reservation_count * 1.2, 7)))
                wait_delta_15m = int(rng.gauss(gps_delta_15m * 0.18 + reservation_delta_15m * 0.9 + (5 if event_soon else 0), 4))

                if zone in {"PUB", "FOOD", "GOODS"}:
                    remaining_stock = max(0, int(rng.gauss(95 - hour * 2.3 - reservation_count * 2.2, 18)))
                else:
                    remaining_stock = max(0, int(rng.gauss(120 - hour, 25)))

                row: dict[str, int | float | str] = {
                    "scenario_day": day,
                    "hour": hour,
                    "is_peak_time": is_peak,
                    "zone_type": zone,
                    "booth_id": booth_id,
                    "artist_popularity": popularity,
                    "artist_popularity_score": {"LOW": 1, "MEDIUM": 2, "HIGH": 3}[popularity],
                    "stage_capacity": capacity,
                    "expected_stage_crowd": stage_crowd,
                    "stage_load_ratio": round(stage_crowd / capacity, 3),
                    "is_night_booth": is_night_booth,
                    "event_soon": event_soon,
                    "minutes_to_next_event": minutes_to_next_event,
                    "gps_count_nearby": gps_count,
                    "gps_delta_5m": gps_delta_5m,
                    "gps_delta_15m": gps_delta_15m,
                    "reservation_count": reservation_count,
                    "reservation_delta_15m": reservation_delta_15m,
                    "checked_in_count": checked_in_count,
                    "checked_in_delta_15m": checked_in_delta_15m,
                    "available_seats": available_seats,
                    "wait_minutes": wait_minutes,
                    "wait_delta_15m": wait_delta_15m,
                    "remaining_stock": remaining_stock,
                    "event_count_context": event_count,
                    "data_source": "HYBRID_SIMULATED",
                }
                row["rule_based_level"] = rule_based_level(row)
                row["target_congestion"] = target_congestion(row, rng)
                rows.append(row)
        day += 1

    return rows


def write_rows(rows: list[dict[str, int | float | str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fields = list(rows[0].keys())
    with output_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a simulated congestion ML dataset for FestFlow.")
    parser.add_argument("--source-dir", type=Path, default=Path("exports/current-db-csv"))
    parser.add_argument("--output", type=Path, default=Path("exports/ml/congestion_training_dataset.csv"))
    parser.add_argument("--rows", type=int, default=2520)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rows = build_rows(args.source_dir, args.rows, args.seed)
    write_rows(rows, args.output)
    counts = Counter(row["target_congestion"] for row in rows)
    print(f"Generated {len(rows)} rows at {args.output}")
    print("Target distribution:", dict(counts))
    print("Generated at:", datetime.now().isoformat(timespec="seconds"))


if __name__ == "__main__":
    main()
