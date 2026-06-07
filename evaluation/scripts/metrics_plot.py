import argparse
import re
import textwrap
from pathlib import Path

import matplotlib
import numpy as np
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap, to_rgb

matplotlib.use("Agg")
import matplotlib.pyplot as plt


SCRIPT_DIR = Path(__file__).resolve().parent
EVALUATION_DIR = SCRIPT_DIR.parent
RESULTS_DIR = EVALUATION_DIR / "evaluation_results"

DEFAULT_INPUT = RESULTS_DIR / "dataset_metrics.csv"
DEFAULT_CONFUSION_MATRIX = RESULTS_DIR / "confusion_matrix_ALL.csv"
DEFAULT_CONFUSION_MATRIX_DIR = RESULTS_DIR / "confusion_matrices"
DEFAULT_OUTPUT_DIR = RESULTS_DIR / "metrics_plots"


# =====================================================
# STYLE SETTINGS
# =====================================================

AVERAGE_LINE_COLOR = "#2F2F2F"  # dark gray
OVERALL_MEAN_COLOR = "#C44E52"  # red

CATEGORY_BASE_COLORS = {
    "education": "#B39DDB",  # pastel purple
    "employment": "#2E7D32",  # dark green
    "finance_and_consumer_behavior": "#1F4E79",  # dark blue
    "health_care": "#F28E2B",  # orange
    "law_and_criminal_justice": "#E78AC3",  # pink
    "out_of_context": "#B8860B",  # dark yellow
}

FALLBACK_CATEGORY_COLORS = [
    "#76B7B2",
    "#59A14F",
    "#EDC948",
    "#AF7AA1",
    "#FF9DA7",
    "#9C755F",
]

DATASET_LABEL_FONTSIZE = 30
VALUE_LABEL_FONTSIZE = 30
AXIS_LABEL_FONTSIZE = 30
TITLE_FONTSIZE = 32
GLOBAL_TITLE_FONTSIZE = 48
LEGEND_FONTSIZE = 30
TICK_LABEL_FONTSIZE = 25

BAR_HEIGHT = 0.52
OVERVIEW_BAR_WIDTH = 0.78
MAX_DATASET_LABEL_WIDTH = 36
MAX_CATEGORY_LABEL_WIDTH = 22

plt.rcParams.update({
    "font.family": "serif",
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.edgecolor": "0.25",
    "axes.linewidth": 0.8,
    "axes.titlesize": TITLE_FONTSIZE,
    "axes.labelsize": AXIS_LABEL_FONTSIZE,
    "xtick.labelsize": TICK_LABEL_FONTSIZE,
    "ytick.labelsize": DATASET_LABEL_FONTSIZE,
    "legend.fontsize": LEGEND_FONTSIZE,
    "pdf.fonttype": 42,
    "ps.fonttype": 42,
})


METRICS = [
    {
        "column": "mae_category",
        "title": "MAE Category",
        "xlabel": "MAE on Sensitivity Categories",
        "filename": "mae_category",
        "higher_is_better": False,
        "bounded_score": False,
    },
    {
        "column": "rmse_category",
        "title": "RMSE Category",
        "xlabel": "RMSE on Sensitivity Categories",
        "filename": "rmse_category",
        "higher_is_better": False,
        "bounded_score": False,
    },
    {
        "column": "f1_macro",
        "title": "Macro F1-score",
        "xlabel": "Macro F1-score",
        "filename": "f1_macro",
        "higher_is_better": True,
        "bounded_score": True,
    },
    {
        "column": "qwk",
        "title": "Quadratic Weighted Kappa",
        "xlabel": "Quadratic Weighted Kappa",
        "filename": "qwk",
        "higher_is_better": True,
        "bounded_score": True,
    },
]


def format_name(name):
    name = str(name).strip()
    name = name.replace("_", " ")
    name = " ".join(name.split())
    return name.title()


def wrap_label(name, width):
    name = str(name)
    name = name.replace("_", " ")
    name = name.replace(".csv", "")
    name = " ".join(name.split())
    return textwrap.fill(name, width=width)


def clean_filename(name):
    name = str(name).strip().lower()
    name = re.sub(r"\s+", "_", name)
    name = re.sub(r"[^a-z0-9_.-]+", "_", name)
    name = re.sub(r"_+", "_", name)
    return name.strip("_") or "unknown"


def make_category_color_map(dataset_categories):
    color_map = {}
    fallback_idx = 0

    for category in dataset_categories:
        if category in CATEGORY_BASE_COLORS:
            color_map[category] = CATEGORY_BASE_COLORS[category]
        else:
            color_map[category] = FALLBACK_CATEGORY_COLORS[
                fallback_idx % len(FALLBACK_CATEGORY_COLORS)
            ]
            fallback_idx += 1

    return color_map


def make_color_gradient(base_color, n):
    if n <= 1:
        return [base_color]

    base_rgb = np.array(to_rgb(base_color))
    white_rgb = np.array(to_rgb("#FFFFFF"))

    colors = []
    for strength in np.linspace(0.35, 1.0, n):
        colors.append(tuple((1 - strength) * white_rgb + strength * base_rgb))

    return colors


def make_confusion_cmap(name, base_color):
    return LinearSegmentedColormap.from_list(
        name,
        ["#FFFFFF", base_color],
    )


def load_metrics(path):
    df = pd.read_csv(path)

    required_columns = ["dataset", "dataset_category"]
    required_columns.extend(metric["column"] for metric in METRICS)

    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns in {path}: {missing_columns}")

    df = df.dropna(subset=["dataset", "dataset_category"]).copy()

    for metric in METRICS:
        column = metric["column"]
        df[column] = pd.to_numeric(df[column], errors="coerce")

    return df


def category_dataset_order(category_df):
    ordered = (
        category_df.assign(_sort_score=category_df["f1_macro"].fillna(-np.inf))
        .sort_values(["_sort_score", "dataset"], ascending=[False, True])
        ["dataset"]
        .tolist()
    )

    return ordered


def order_rows_by_dataset_list(df, ordered_datasets):
    ordered_df = df.copy()
    ordered_df["_dataset_order"] = pd.Categorical(
        ordered_df["dataset"],
        categories=ordered_datasets,
        ordered=True,
    )
    return ordered_df.sort_values("_dataset_order").drop(
        columns=["_dataset_order"]
    ).reset_index(drop=True)


def order_overview_rows(overview_df, dataset_categories):
    ordered_df = overview_df.copy()
    ordered_df["_category_order"] = pd.Categorical(
        ordered_df["dataset_category"],
        categories=dataset_categories,
        ordered=True,
    )
    return ordered_df.sort_values("_category_order").drop(
        columns=["_category_order"]
    ).reset_index(drop=True)


def apply_x_limits(ax, values, average, metric):
    values = list(values) + [average]
    data_min = min(values)
    data_max = max(values)

    if data_min < 0:
        span = data_max - data_min
        if span == 0:
            span = abs(data_min) or 1
        xmin = data_min - span * 0.12
    else:
        xmin = 0

    if metric["bounded_score"]:
        xmax = max(1.05, data_max * 1.18)
    else:
        xmax = data_max * 1.20 if data_max > 0 else 1

    if xmax <= xmin:
        xmax = xmin + 1

    ax.set_xlim(xmin, xmax)


def apply_y_limits(ax, values, average, metric):
    values = list(values) + [average]
    data_min = min(values)
    data_max = max(values)

    if data_min < 0:
        span = data_max - data_min
        if span == 0:
            span = abs(data_min) or 1
        ymin = data_min - span * 0.12
    else:
        ymin = 0

    if metric["bounded_score"]:
        ymax = max(1.05, data_max * 1.18)
    else:
        ymax = data_max * 1.20 if data_max > 0 else 1

    if ymax <= ymin:
        ymax = ymin + 1

    ax.set_ylim(ymin, ymax)


def add_bar_value_labels(ax, bars, values):
    xmin, xmax = ax.get_xlim()
    span = xmax - xmin
    offset = span * 0.012

    for bar, value in zip(bars, values):
        if value >= 0:
            x = bar.get_width() + offset
            ha = "left"
        else:
            x = bar.get_width() - offset
            ha = "right"

        ax.text(
            x,
            bar.get_y() + bar.get_height() / 2,
            f"{value:.3f}",
            va="center",
            ha=ha,
            fontsize=VALUE_LABEL_FONTSIZE,
        )


def add_vertical_bar_value_labels(ax, bars, values):
    ymin, ymax = ax.get_ylim()
    span = ymax - ymin
    offset = span * 0.012

    for bar, value in zip(bars, values):
        if value >= 0:
            y = bar.get_height() + offset
            va = "bottom"
        else:
            y = bar.get_height() - offset
            va = "top"

        ax.text(
            bar.get_x() + bar.get_width() / 2,
            y,
            f"{value:.3f}",
            va=va,
            ha="center",
            fontsize=VALUE_LABEL_FONTSIZE,
        )


def save_figure(fig, out_path):
    fig.savefig(out_path, bbox_inches="tight")
    plt.close(fig)
    print(f"[OK] Saved: {out_path}")


def plot_metric_for_category(df, dataset_category, metric, out_dir, category_colors):
    column = metric["column"]

    full_category_df = df[df["dataset_category"] == dataset_category].copy()
    ordered_datasets = category_dataset_order(full_category_df)
    category_df = full_category_df.dropna(subset=[column])

    if category_df.empty:
        print(
            f"[SKIP] {format_name(dataset_category)} - {metric['title']}: "
            "no numeric values available."
        )
        return None

    category_df = order_rows_by_dataset_list(category_df, ordered_datasets)

    n_datasets = len(category_df)
    y = np.arange(n_datasets)
    values = category_df[column].tolist()
    labels = [
        wrap_label(dataset, MAX_DATASET_LABEL_WIDTH)
        for dataset in category_df["dataset"].tolist()
    ]
    average = category_df[column].mean()
    base_color = category_colors[dataset_category]
    colors = make_color_gradient(base_color, n_datasets)

    fig_height = max(12, n_datasets * 1.35)
    fig, ax = plt.subplots(figsize=(24, fig_height))

    bars = ax.barh(
        y,
        values,
        height=BAR_HEIGHT,
        color=colors,
        edgecolor="none",
        alpha=0.95,
    )

    ax.set_yticks(y)
    ax.set_yticklabels(labels, fontsize=DATASET_LABEL_FONTSIZE, ha="right")
    ax.invert_yaxis()

    ax.axvline(
        average,
        color=AVERAGE_LINE_COLOR,
        linestyle="--",
        linewidth=2.2,
        label=f"{format_name(dataset_category)} average = {average:.3f}",
    )

    ax.set_title(
        metric["title"],
        fontsize=TITLE_FONTSIZE,
        fontweight="bold",
        pad=18,
    )
    ax.set_xlabel(metric["xlabel"], fontsize=AXIS_LABEL_FONTSIZE)
    ax.grid(axis="x", linestyle=":", linewidth=0.8, alpha=0.45)
    ax.set_axisbelow(True)
    ax.tick_params(axis="x", labelsize=TICK_LABEL_FONTSIZE)
    ax.tick_params(axis="y", length=0, pad=12)

    apply_x_limits(ax, values, average, metric)
    add_bar_value_labels(ax, bars, values)

    ax.legend(
        loc="upper center",
        bbox_to_anchor=(0.5, -0.10),
        fontsize=LEGEND_FONTSIZE,
        frameon=True,
        framealpha=0.9,
        ncol=1,
    )

    fig.suptitle(
        format_name(dataset_category),
        fontsize=GLOBAL_TITLE_FONTSIZE,
        fontweight="heavy",
        y=0.94,
    )

    plt.subplots_adjust(left=0.32, right=0.96, top=0.84, bottom=0.18)

    out_path = out_dir / (
        f"{clean_filename(dataset_category)}_{metric['filename']}.pdf"
    )
    save_figure(fig, out_path)
    return out_path


def plot_metric_overview(df, metric, out_dir, dataset_categories, category_colors):
    column = metric["column"]

    overview_df = (
        df.dropna(subset=[column])
        .groupby("dataset_category", as_index=False)[column]
        .mean()
    )

    if overview_df.empty:
        print(f"[SKIP] Overview - {metric['title']}: no numeric values available.")
        return None

    overview_df = order_overview_rows(overview_df, dataset_categories)

    n_categories = len(overview_df)
    x = np.arange(n_categories)
    values = overview_df[column].tolist()
    labels = [
        wrap_label(format_name(category), MAX_CATEGORY_LABEL_WIDTH)
        for category in overview_df["dataset_category"].tolist()
    ]
    overall_average = df[column].mean()
    colors = [
        category_colors[category]
        for category in overview_df["dataset_category"].tolist()
    ]

    fig, ax = plt.subplots(figsize=(30, 12))

    bars = ax.bar(
        x,
        values,
        width=OVERVIEW_BAR_WIDTH,
        color=colors,
        edgecolor="none",
        alpha=0.95,
    )

    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=TICK_LABEL_FONTSIZE)

    ax.axhline(
        overall_average,
        color=OVERALL_MEAN_COLOR,
        linestyle="--",
        linewidth=2.2,
        label=f"Overall average = {overall_average:.3f}",
    )

    ax.set_title(
        f"Average {metric['title']} by Dataset Category",
        fontsize=TITLE_FONTSIZE,
        fontweight="bold",
        pad=18,
    )
    ax.set_ylabel(metric["xlabel"], fontsize=AXIS_LABEL_FONTSIZE)
    ax.grid(axis="y", linestyle=":", linewidth=0.8, alpha=0.45)
    ax.set_axisbelow(True)
    ax.tick_params(axis="x", labelsize=TICK_LABEL_FONTSIZE, length=0, pad=12)
    ax.tick_params(axis="y", labelsize=TICK_LABEL_FONTSIZE)

    apply_y_limits(ax, values, overall_average, metric)
    add_vertical_bar_value_labels(ax, bars, values)

    ax.legend(
        loc="upper center",
        bbox_to_anchor=(0.5, -0.18),
        fontsize=LEGEND_FONTSIZE,
        frameon=True,
        framealpha=0.9,
        ncol=1,
    )

    plt.subplots_adjust(left=0.08, right=0.98, top=0.86, bottom=0.28)

    out_path = out_dir / f"overview_{metric['filename']}_by_dataset_category.pdf"
    save_figure(fig, out_path)
    return out_path


def format_confusion_tick(label):
    label = str(label)
    label = label.replace("true_cat", "")
    label = label.replace("pred_cat", "")
    label = label.replace("cat", "")
    label = label.strip()
    return label


def load_confusion_matrix(path):
    cm_df = pd.read_csv(path, index_col=0)
    cm = cm_df.to_numpy(dtype=float)
    x_labels = [format_confusion_tick(label) for label in cm_df.columns]
    y_labels = [format_confusion_tick(label) for label in cm_df.index]
    return cm, x_labels, y_labels


def plot_confusion_heatmap(cm, x_labels, y_labels, title, out_path, cmap):
    fig, ax = plt.subplots(figsize=(12, 10))
    image = ax.imshow(cm, cmap=cmap)

    colorbar = fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04)
    colorbar.ax.tick_params(labelsize=18)

    ax.set_xticks(np.arange(len(x_labels)))
    ax.set_yticks(np.arange(len(y_labels)))
    ax.set_xticklabels(x_labels, fontsize=22)
    ax.set_yticklabels(y_labels, fontsize=22)

    ax.set_xlabel("Predicted Category", fontsize=26, labelpad=15)
    ax.set_ylabel("True Category", fontsize=26, labelpad=15)
    ax.set_title(
        title,
        fontsize=32,
        fontweight="bold",
        pad=24,
    )

    max_value = cm.max() if cm.size else 0
    threshold = max_value * 0.60

    for row_idx in range(cm.shape[0]):
        for col_idx in range(cm.shape[1]):
            value = cm[row_idx, col_idx]
            text_color = "white" if value > threshold else "black"
            ax.text(
                col_idx,
                row_idx,
                f"{int(value)}",
                ha="center",
                va="center",
                fontsize=22,
                color=text_color,
            )

    ax.tick_params(axis="both", length=0)
    plt.tight_layout(pad=2)

    save_figure(fig, out_path)
    return out_path


def plot_confusion_matrix(confusion_matrix_path, out_dir):
    if not confusion_matrix_path.exists():
        print(f"[SKIP] Confusion matrix not found: {confusion_matrix_path}")
        return None

    cm, x_labels, y_labels = load_confusion_matrix(confusion_matrix_path)

    out_path = out_dir / "confusion_matrix_all.pdf"
    return plot_confusion_heatmap(
        cm=cm,
        x_labels=x_labels,
        y_labels=y_labels,
        title="Confusion Matrix - All Datasets",
        out_path=out_path,
        cmap="Blues",
    )


def plot_category_confusion_matrices(
    df,
    confusion_matrix_dir,
    out_dir,
    dataset_categories,
    category_colors,
):
    saved_paths = []

    for dataset_category in dataset_categories:
        category_df = df[df["dataset_category"] == dataset_category].copy()

        cm_total = None
        x_labels = None
        y_labels = None
        missing_datasets = []

        for dataset in category_df["dataset"].tolist():
            cm_path = confusion_matrix_dir / f"cm_{dataset}.csv"

            if not cm_path.exists():
                missing_datasets.append(dataset)
                continue

            cm, current_x_labels, current_y_labels = load_confusion_matrix(cm_path)

            if cm_total is None:
                cm_total = np.zeros_like(cm)
                x_labels = current_x_labels
                y_labels = current_y_labels

            if cm.shape != cm_total.shape:
                print(f"[WARN] Skipping {cm_path}: unexpected matrix shape {cm.shape}.")
                continue

            cm_total += cm

        if missing_datasets:
            preview = ", ".join(missing_datasets[:5])
            suffix = "..." if len(missing_datasets) > 5 else ""
            print(
                f"[WARN] {format_name(dataset_category)}: missing "
                f"{len(missing_datasets)} per-dataset confusion matrices "
                f"({preview}{suffix})."
            )

        if cm_total is None:
            print(
                f"[SKIP] {format_name(dataset_category)} confusion matrix: "
                "no per-dataset matrices available."
            )
            continue

        safe_category = clean_filename(dataset_category)
        cmap = make_confusion_cmap(
            f"{safe_category}_confusion_cmap",
            category_colors[dataset_category],
        )

        out_path = out_dir / f"{safe_category}_confusion_matrix.pdf"
        saved_path = plot_confusion_heatmap(
            cm=cm_total,
            x_labels=x_labels,
            y_labels=y_labels,
            title=f"Confusion Matrix - {format_name(dataset_category)}",
            out_path=out_path,
            cmap=cmap,
        )
        saved_paths.append(saved_path)

    return saved_paths


def parse_args():
    parser = argparse.ArgumentParser(
        description="Create dataset metric plots grouped by dataset category."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
        help=f"Path to dataset_metrics.csv. Default: {DEFAULT_INPUT}",
    )
    parser.add_argument(
        "--confusion-matrix",
        type=Path,
        default=DEFAULT_CONFUSION_MATRIX,
        help=(
            "Path to confusion_matrix_ALL.csv. "
            f"Default: {DEFAULT_CONFUSION_MATRIX}"
        ),
    )
    parser.add_argument(
        "--confusion-matrix-dir",
        type=Path,
        default=DEFAULT_CONFUSION_MATRIX_DIR,
        help=(
            "Directory with per-dataset confusion matrices. "
            f"Default: {DEFAULT_CONFUSION_MATRIX_DIR}"
        ),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory where PDF plots are saved. Default: {DEFAULT_OUTPUT_DIR}",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    df = load_metrics(args.input)
    dataset_categories = sorted(df["dataset_category"].dropna().unique())

    if not dataset_categories:
        print("No dataset categories found.")
        return

    category_colors = make_category_color_map(dataset_categories)
    saved_paths = []

    for dataset_category in dataset_categories:
        for metric in METRICS:
            path = plot_metric_for_category(
                df=df,
                dataset_category=dataset_category,
                metric=metric,
                out_dir=args.output_dir,
                category_colors=category_colors,
            )
            if path is not None:
                saved_paths.append(path)

    for metric in METRICS:
        path = plot_metric_overview(
            df=df,
            metric=metric,
            out_dir=args.output_dir,
            dataset_categories=dataset_categories,
            category_colors=category_colors,
        )
        if path is not None:
            saved_paths.append(path)

    path = plot_confusion_matrix(
        confusion_matrix_path=args.confusion_matrix,
        out_dir=args.output_dir,
    )
    if path is not None:
        saved_paths.append(path)

    saved_paths.extend(
        plot_category_confusion_matrices(
            df=df,
            confusion_matrix_dir=args.confusion_matrix_dir,
            out_dir=args.output_dir,
            dataset_categories=dataset_categories,
            category_colors=category_colors,
        )
    )

    print("\nDone.")
    print(f"Created {len(saved_paths)} PDF plots.")
    print(f"Output directory: {args.output_dir}")


if __name__ == "__main__":
    main()
