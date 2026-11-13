from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder

try:
    from xgboost import XGBClassifier
except Exception:  # pragma: no cover - keeps the script usable without optional dependency.
    XGBClassifier = None


LABEL_ORDER = ["LOW", "NORMAL", "BUSY", "VERY_BUSY"]
CATEGORICAL_FEATURES = ["zone_type", "artist_popularity"]
NUMERIC_FEATURES = [
    "scenario_day",
    "hour",
    "is_peak_time",
    "artist_popularity_score",
    "stage_capacity",
    "expected_stage_crowd",
    "stage_load_ratio",
    "is_night_booth",
    "event_soon",
    "minutes_to_next_event",
    "gps_count_nearby",
    "gps_delta_5m",
    "gps_delta_15m",
    "reservation_count",
    "reservation_delta_15m",
    "checked_in_count",
    "checked_in_delta_15m",
    "available_seats",
    "wait_minutes",
    "wait_delta_15m",
    "remaining_stock",
    "event_count_context",
]
FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
TARGET = "target_congestion"


def make_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("numeric", "passthrough", NUMERIC_FEATURES),
            ("category", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ],
        verbose_feature_names_out=False,
    )


def write_comparison(rows: list[dict[str, str | float]], output_dir: Path) -> None:
    path = output_dir / "model_comparison.csv"
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=["model", "accuracy", "macro_f1", "notes"])
        writer.writeheader()
        writer.writerows(rows)


def write_confusion_matrix(model_name: str, y_true: pd.Series, y_pred: list[str], output_dir: Path) -> None:
    matrix = confusion_matrix(y_true, y_pred, labels=LABEL_ORDER)
    path = output_dir / f"confusion_matrix_{model_name}.csv"
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["actual\\predicted", *LABEL_ORDER])
        for label, values in zip(LABEL_ORDER, matrix):
            writer.writerow([label, *values.tolist()])


def write_feature_importance(model_name: str, feature_names: list[str], importances, output_dir: Path) -> None:
    rows = sorted(
        (
            {"feature": feature, "importance": float(importance)}
            for feature, importance in zip(feature_names, importances)
        ),
        key=lambda row: row["importance"],
        reverse=True,
    )
    path = output_dir / f"feature_importance_{model_name}.csv"
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=["feature", "importance"])
        writer.writeheader()
        writer.writerows(rows)


def build_training_profile(df: pd.DataFrame) -> dict:
    numeric_profile = {}
    for feature in NUMERIC_FEATURES:
        series = pd.to_numeric(df[feature], errors="coerce").dropna()
        numeric_profile[feature] = {
            "mean": round(float(series.mean()), 4),
            "std": round(float(series.std(ddof=0)), 4),
            "p05": round(float(series.quantile(0.05)), 4),
            "p95": round(float(series.quantile(0.95)), 4),
            "min": round(float(series.min()), 4),
            "max": round(float(series.max()), 4),
        }

    categorical_profile = {
        feature: sorted(str(value) for value in df[feature].dropna().unique())
        for feature in CATEGORICAL_FEATURES
    }
    return {
        "numeric": numeric_profile,
        "categorical": categorical_profile,
        "drift_policy": {
            "normal_max_score": 0.15,
            "caution_max_score": 0.35,
        },
    }


def write_training_profile(profile: dict, output_dir: Path) -> None:
    models_dir = output_dir / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    (models_dir / "congestion_training_profile.json").write_text(
        json.dumps(profile, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def write_random_forest_model(rf_pipeline: Pipeline, training_profile: dict, output_dir: Path) -> None:
    models_dir = output_dir / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "model_type": "RandomForest",
        "pipeline": rf_pipeline,
        "features": FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "target": TARGET,
        "labels": LABEL_ORDER,
        "training_profile": training_profile,
    }
    joblib.dump(payload, models_dir / "random_forest_congestion_model.pkl")
    write_portable_random_forest_model(rf_pipeline, training_profile, models_dir)


def write_portable_random_forest_model(rf_pipeline: Pipeline, training_profile: dict, models_dir: Path) -> None:
    preprocessor = rf_pipeline.named_steps["preprocess"]
    model = rf_pipeline.named_steps["model"]
    encoder = preprocessor.named_transformers_["category"]
    categorical_values = {
        feature: [str(value) for value in values]
        for feature, values in zip(CATEGORICAL_FEATURES, encoder.categories_)
    }
    trees = []
    for estimator in model.estimators_:
        tree = estimator.tree_
        trees.append({
            "children_left": tree.children_left.tolist(),
            "children_right": tree.children_right.tolist(),
            "feature": tree.feature.tolist(),
            "threshold": [float(value) for value in tree.threshold.tolist()],
            "value": tree.value[:, 0, :].tolist(),
        })
    payload = {
        "model_type": "RandomForest",
        "features": FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "categorical_values": categorical_values,
        "transformed_features": preprocessor.get_feature_names_out().tolist(),
        "labels": [str(label) for label in model.classes_],
        "training_profile": training_profile,
        "trees": trees,
    }
    (models_dir / "random_forest_congestion_model.json").write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def metric_row(model_name: str, y_true: pd.Series, y_pred: list[str], notes: str) -> dict[str, str | float]:
    return {
        "model": model_name,
        "accuracy": round(accuracy_score(y_true, y_pred), 4),
        "macro_f1": round(f1_score(y_true, y_pred, labels=LABEL_ORDER, average="macro"), 4),
        "notes": notes,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Train congestion classifiers and compare with rule baseline.")
    parser.add_argument("--dataset", type=Path, default=Path("exports/ml/congestion_training_dataset.csv"))
    parser.add_argument("--output-dir", type=Path, default=Path("exports/ml"))
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(args.dataset)
    missing = [column for column in FEATURES + [TARGET, "rule_based_level"] if column not in df.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")
    training_profile = build_training_profile(df)
    write_training_profile(training_profile, args.output_dir)

    x = df[FEATURES]
    y = df[TARGET]
    x_train, x_test, y_train, y_test, train_idx, test_idx = train_test_split(
        x,
        y,
        df.index,
        test_size=0.25,
        random_state=args.seed,
        stratify=y,
    )

    comparison_rows: list[dict[str, str | float]] = []

    rule_pred = df.loc[test_idx, "rule_based_level"].tolist()
    comparison_rows.append(metric_row("rule_based_baseline", y_test, rule_pred, "Current weighted heuristic style baseline."))
    write_confusion_matrix("rule_based_baseline", y_test, rule_pred, args.output_dir)

    rf_pipeline = Pipeline(
        steps=[
            ("preprocess", make_preprocessor()),
            (
                "model",
                RandomForestClassifier(
                    n_estimators=350,
                    max_depth=12,
                    min_samples_leaf=3,
                    class_weight="balanced",
                    random_state=args.seed,
                    n_jobs=-1,
                ),
            ),
        ]
    )
    rf_pipeline.fit(x_train, y_train)
    rf_pred = rf_pipeline.predict(x_test).tolist()
    comparison_rows.append(metric_row("random_forest", y_test, rf_pred, "Tree ensemble trained on simulated operating patterns."))
    write_confusion_matrix("random_forest", y_test, rf_pred, args.output_dir)
    rf_feature_names = rf_pipeline.named_steps["preprocess"].get_feature_names_out().tolist()
    write_feature_importance(
        "random_forest",
        rf_feature_names,
        rf_pipeline.named_steps["model"].feature_importances_,
        args.output_dir,
    )
    write_random_forest_model(rf_pipeline, training_profile, args.output_dir)

    xgb_pred: list[str] | None = None
    if XGBClassifier is not None:
        label_encoder = LabelEncoder()
        label_encoder.fit(LABEL_ORDER)
        y_train_encoded = label_encoder.transform(y_train)

        xgb_pipeline = Pipeline(
            steps=[
                ("preprocess", make_preprocessor()),
                (
                    "model",
                    XGBClassifier(
                        n_estimators=260,
                        max_depth=4,
                        learning_rate=0.06,
                        subsample=0.9,
                        colsample_bytree=0.9,
                        objective="multi:softmax",
                        eval_metric="mlogloss",
                        random_state=args.seed,
                    ),
                ),
            ]
        )
        xgb_pipeline.fit(x_train, y_train_encoded)
        xgb_encoded = xgb_pipeline.predict(x_test)
        xgb_pred = label_encoder.inverse_transform(xgb_encoded).tolist()
        comparison_rows.append(metric_row("xgboost", y_test, xgb_pred, "Gradient boosting comparison model."))
        write_confusion_matrix("xgboost", y_test, xgb_pred, args.output_dir)
        xgb_feature_names = xgb_pipeline.named_steps["preprocess"].get_feature_names_out().tolist()
        write_feature_importance(
            "xgboost",
            xgb_feature_names,
            xgb_pipeline.named_steps["model"].feature_importances_,
            args.output_dir,
        )
    else:
        comparison_rows.append(
            {
                "model": "xgboost",
                "accuracy": "",
                "macro_f1": "",
                "notes": "Skipped because xgboost is not installed.",
            }
        )

    write_comparison(comparison_rows, args.output_dir)

    samples = df.loc[test_idx, FEATURES + ["rule_based_level", TARGET]].copy()
    samples["random_forest_prediction"] = rf_pred
    if xgb_pred is not None:
        samples["xgboost_prediction"] = xgb_pred
    samples.sort_values(["hour", "zone_type"]).head(80).to_csv(
        args.output_dir / "prediction_samples.csv",
        index=False,
        encoding="utf-8-sig",
    )

    print("Model comparison")
    for row in comparison_rows:
        print(row)
    print(f"Outputs written to {args.output_dir}")


if __name__ == "__main__":
    main()
