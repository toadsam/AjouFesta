from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


LABEL_ORDER = ["LOW", "NORMAL", "BUSY", "VERY_BUSY"]


def save_model_comparison(output_dir: Path, figures_dir: Path) -> None:
    comparison = pd.read_csv(output_dir / "model_comparison.csv")
    comparison = comparison.dropna(subset=["accuracy", "macro_f1"])

    fig, ax = plt.subplots(figsize=(8, 4.8))
    x = range(len(comparison))
    width = 0.36
    ax.bar([i - width / 2 for i in x], comparison["accuracy"], width=width, label="Accuracy", color="#2f80ed")
    ax.bar([i + width / 2 for i in x], comparison["macro_f1"], width=width, label="Macro F1", color="#27ae60")
    ax.set_xticks(list(x))
    ax.set_xticklabels(comparison["model"], rotation=15, ha="right")
    ax.set_ylim(0, 1)
    ax.set_title("Rule-based vs ML Model Performance")
    ax.set_ylabel("Score")
    ax.legend()
    ax.grid(axis="y", alpha=0.25)
    fig.tight_layout()
    fig.savefig(figures_dir / "model_performance_comparison.png", dpi=180)
    plt.close(fig)


def save_label_distribution(output_dir: Path, figures_dir: Path) -> None:
    dataset = pd.read_csv(output_dir / "congestion_training_dataset.csv")
    counts = dataset["target_congestion"].value_counts().reindex(LABEL_ORDER, fill_value=0)

    fig, ax = plt.subplots(figsize=(7, 4.5))
    ax.bar(counts.index, counts.values, color=["#6fcf97", "#56ccf2", "#f2c94c", "#eb5757"])
    ax.set_title("Training Dataset Congestion Label Distribution")
    ax.set_xlabel("Congestion Label")
    ax.set_ylabel("Rows")
    ax.grid(axis="y", alpha=0.25)
    for index, value in enumerate(counts.values):
        ax.text(index, value + max(counts.values) * 0.015, str(value), ha="center", va="bottom")
    fig.tight_layout()
    fig.savefig(figures_dir / "label_distribution.png", dpi=180)
    plt.close(fig)


def save_feature_importance(output_dir: Path, figures_dir: Path, model_name: str) -> None:
    path = output_dir / f"feature_importance_{model_name}.csv"
    if not path.exists():
        return

    importance = pd.read_csv(path).head(10).sort_values("importance")
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.barh(importance["feature"], importance["importance"], color="#0b5cad")
    ax.set_title(f"{model_name.replace('_', ' ').title()} Top Feature Importance")
    ax.set_xlabel("Importance")
    ax.grid(axis="x", alpha=0.25)
    fig.tight_layout()
    fig.savefig(figures_dir / f"feature_importance_{model_name}.png", dpi=180)
    plt.close(fig)


def save_confusion_matrix(output_dir: Path, figures_dir: Path, model_name: str) -> None:
    path = output_dir / f"confusion_matrix_{model_name}.csv"
    if not path.exists():
        return

    matrix = pd.read_csv(path, index_col=0).reindex(index=LABEL_ORDER, columns=LABEL_ORDER, fill_value=0)
    fig, ax = plt.subplots(figsize=(6, 5))
    image = ax.imshow(matrix.values, cmap="Blues")
    ax.set_title(f"{model_name.replace('_', ' ').title()} Confusion Matrix")
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    ax.set_xticks(range(len(LABEL_ORDER)))
    ax.set_yticks(range(len(LABEL_ORDER)))
    ax.set_xticklabels(LABEL_ORDER, rotation=35, ha="right")
    ax.set_yticklabels(LABEL_ORDER)
    for row in range(len(LABEL_ORDER)):
        for col in range(len(LABEL_ORDER)):
            ax.text(col, row, int(matrix.iloc[row, col]), ha="center", va="center", color="#111111")
    fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(figures_dir / f"confusion_matrix_{model_name}.png", dpi=180)
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description="Create graphs for FestFlow congestion ML results.")
    parser.add_argument("--output-dir", type=Path, default=Path("exports/ml"))
    parser.add_argument("--figures-dir", type=Path, default=Path("exports/ml/figures"))
    args = parser.parse_args()

    args.figures_dir.mkdir(parents=True, exist_ok=True)
    save_model_comparison(args.output_dir, args.figures_dir)
    save_label_distribution(args.output_dir, args.figures_dir)
    for model_name in ["random_forest", "xgboost"]:
        save_feature_importance(args.output_dir, args.figures_dir, model_name)
    for model_name in ["rule_based_baseline", "random_forest", "xgboost"]:
        save_confusion_matrix(args.output_dir, args.figures_dir, model_name)

    print(f"Graphs written to {args.figures_dir}")


if __name__ == "__main__":
    main()
