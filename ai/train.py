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
# LOAD DATA
# =========================================================

df = pd.read_csv(
    DATA_PATH
)

df["text"] = (
    df["text"]
    .astype(str)
    .str.lower()
    .str.strip()
)

df["category"] = (
    df["category"]
    .astype(str)
    .str.strip()
)


# =========================================================
# VECTORIZE
# =========================================================

vectorizer = TfidfVectorizer(
    analyzer="char_wb",
    ngram_range=(2, 5),
    min_df=1
)


X = vectorizer.fit_transform(
    df["text"]
)

y = df["category"]


# =========================================================
# TRAIN
# =========================================================

model = LogisticRegression(
    max_iter=2000,
    random_state=42
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