from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import pandas as pd


DEFAULT_MODEL_PATH = Path("exports/ml/models/random_forest_congestion_model.pkl")


def read_payload(input_arg: str | None, input_file: Path | None) -> dict:
    if input_arg:
        return json.loads(input_arg)
    if input_file:
        return json.loads(input_file.read_text(encoding="utf-8"))
    raw = sys.stdin.read().strip()
    if not raw:
        raise ValueError("No prediction input JSON was provided.")
    return json.loads(raw)


def normalize_row(payload: dict, features: list[str]) -> dict:
    row = payload.get("features", payload)
    return {feature: row.get(feature, 0) for feature in features}


def drift_check(row: dict, model_payload: dict) -> dict:
    profile = model_payload.get("training_profile") or {}
    numeric_profile = profile.get("numeric") or {}
    categorical_profile = profile.get("categorical") or {}
    policy = profile.get("drift_policy") or {}
    normal_max = float(policy.get("normal_max_score", 0.15))
    caution_max = float(policy.get("caution_max_score", 0.35))

    checks = 0
    drift_points = 0.0
    warnings = []

    for feature, stats in numeric_profile.items():
        if feature not in row:
            continue
        try:
            value = float(row[feature])
        except (TypeError, ValueError):
            continue
        checks += 1
        p05 = float(stats.get("p05", value))
        p95 = float(stats.get("p95", value))
        min_value = float(stats.get("min", p05))
        max_value = float(stats.get("max", p95))
        if value < min_value or value > max_value:
            drift_points += 1.0
            warnings.append(f"{feature}={value:g} is outside training range [{min_value:g}, {max_value:g}]")
        elif value < p05 or value > p95:
            drift_points += 0.45
            warnings.append(f"{feature}={value:g} is outside typical training band [{p05:g}, {p95:g}]")

    for feature, allowed_values in categorical_profile.items():
        if feature not in row:
            continue
        checks += 1
        value = str(row[feature])
        if value not in allowed_values:
            drift_points += 1.0
            warnings.append(f"{feature}={value} was not seen during training")

    score = round(drift_points / max(1, checks), 4)
    if score <= normal_max:
        status = "NORMAL"
    elif score <= caution_max:
        status = "CAUTION"
    else:
        status = "WARNING"
    return {
        "driftStatus": status,
        "driftScore": score,
        "driftWarnings": warnings[:4],
    }


def predict_one(pipeline, model_payload: dict, row: dict) -> dict:
    frame = pd.DataFrame([row], columns=model_payload["features"])
    prediction = str(pipeline.predict(frame)[0])

    confidence = None
    probabilities = {}
    if hasattr(pipeline, "predict_proba"):
        classes = [str(item) for item in pipeline.classes_]
        values = pipeline.predict_proba(frame)[0]
        probabilities = {label: round(float(value), 4) for label, value in zip(classes, values)}
        confidence = max(probabilities.values()) if probabilities else None

    return {
        "modelType": model_payload.get("model_type", "RandomForest"),
        "predictedLevel": prediction,
        "confidence": confidence,
        "probabilities": probabilities,
        **drift_check(row, model_payload),
    }


def predict_many(pipeline, model_payload: dict, items: list[dict]) -> list[dict]:
    features = model_payload["features"]
    rows = [normalize_row(item, features) for item in items]
    frame = pd.DataFrame(rows, columns=features)
    predictions = [str(value) for value in pipeline.predict(frame)]

    probabilities_by_row = []
    if hasattr(pipeline, "predict_proba"):
        classes = [str(item) for item in pipeline.classes_]
        probability_matrix = pipeline.predict_proba(frame)
        probabilities_by_row = [
            {label: round(float(value), 4) for label, value in zip(classes, row)}
            for row in probability_matrix
        ]

    results = []
    for index, item in enumerate(items):
        probabilities = probabilities_by_row[index] if probabilities_by_row else {}
        results.append({
            "predictedLevel": predictions[index],
            "confidence": max(probabilities.values()) if probabilities else None,
            "id": item.get("id"),
            **drift_check(rows[index], model_payload),
        })
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Predict FestFlow congestion with the saved RandomForest model.")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL_PATH)
    parser.add_argument("--input-json", default=None)
    parser.add_argument("--input-file", type=Path, default=None)
    parser.add_argument("--output-file", type=Path, default=None)
    args = parser.parse_args()

    model_payload = joblib.load(args.model)
    features = model_payload["features"]
    pipeline = model_payload["pipeline"]

    payload = read_payload(args.input_json, args.input_file)
    if isinstance(payload.get("items"), list):
        result = {
            "predictions": predict_many(pipeline, model_payload, payload["items"]),
        }
    else:
        result = predict_one(pipeline, model_payload, normalize_row(payload, features))
        result["modelPath"] = str(args.model)
    output = json.dumps(result, ensure_ascii=False)
    if args.output_file:
        args.output_file.parent.mkdir(parents=True, exist_ok=True)
        args.output_file.write_text(output, encoding="utf-8")
    else:
        print(output)


if __name__ == "__main__":
    main()
