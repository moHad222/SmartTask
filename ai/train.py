from pathlib import Path

import pandas as pd
import joblib

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression


# =========================================================
# PATHS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = (
    BASE_DIR.parent
    / "data"
    / "training_data.csv"
)

MODEL_PATH = (
    BASE_DIR
    / "task_classifier.pkl"
)

VECTORIZER_PATH = (
    BASE_DIR
    / "task_vectorizer.pkl"
)


# =========================================================
# NORMALIZE
# =========================================================

def normalize_text(text):

    text = str(text).lower().strip()

    replacements = {
        "ي": "ی",
        "ى": "ی",
        "ك": "ک",
        "ۀ": "ه",
        "ة": "ه",
        "‌": " ",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    text = " ".join(text.split())

    return text


# =========================================================
# LOAD DATA
# =========================================================

if not DATA_PATH.exists():

    raise FileNotFoundError(
        f"فایل داده آموزشی پیدا نشد: {DATA_PATH}"
    )


df = pd.read_csv(DATA_PATH)

required_columns = {
    "text",
    "category"
}

if not required_columns.issubset(df.columns):

    raise ValueError(
        "فایل training_data.csv باید ستون‌های "
        "'text' و 'category' را داشته باشد."
    )


df["text"] = (
    df["text"]
    .astype(str)
    .apply(normalize_text)
)

df["category"] = (
    df["category"]
    .astype(str)
    .str.strip()
)

df = df[
    (df["text"] != "")
    & (df["category"] != "")
].copy()


# =========================================================
# VECTORIZE
# =========================================================

vectorizer = TfidfVectorizer(
    analyzer="char_wb",
    ngram_range=(2, 5),
    min_df=1,
    sublinear_tf=True
)


X = vectorizer.fit_transform(
    df["text"]
)

y = df["category"]


# =========================================================
# TRAIN
# =========================================================

model = LogisticRegression(
    max_iter=3000,
    random_state=42,
    class_weight="balanced"
)

model.fit(
    X,
    y
)


# =========================================================
# SAVE
# =========================================================

joblib.dump(
    model,
    MODEL_PATH
)

joblib.dump(
    vectorizer,
    VECTORIZER_PATH
)


# =========================================================
# RESULT
# =========================================================

print(
    "مدل با موفقیت آموزش داده شد."
)

print(
    "دسته‌ها:",
    list(model.classes_)
)

print(
    "تعداد نمونه‌ها:",
    len(df)
)

print(
    "Model:",
    MODEL_PATH
)

print(
    "Vectorizer:",
    VECTORIZER_PATH
)
