from pathlib import Path
import joblib

from database.database import CATEGORIES


# =========================================================
# PATHS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = BASE_DIR / "task_classifier.pkl"
VECTORIZER_PATH = BASE_DIR / "task_vectorizer.pkl"


# =========================================================
# LOAD MODEL
# =========================================================

_model = None
_vectorizer = None


def load_model():

    global _model
    global _vectorizer

    if _model is None or _vectorizer is None:

        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                "فایل مدل AI پیدا نشد."
            )

        if not VECTORIZER_PATH.exists():
            raise FileNotFoundError(
                "فایل Vectorizer پیدا نشد."
            )

        _model = joblib.load(
            MODEL_PATH
        )

        _vectorizer = joblib.load(
            VECTORIZER_PATH
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
    }

    for old, new in replacements.items():

        text = text.replace(
            old,
            new
        )

    return text


# =========================================================
# PREDICT CATEGORY
# =========================================================

def predict_category(title):

    text = normalize_text(title)

    if not text:
        return "تعیین نشده"

    load_model()

    vector = _vectorizer.transform(
        [text]
    )

    probabilities = _model.predict_proba(
        vector
    )[0]

    best_index = probabilities.argmax()

    confidence = probabilities[
        best_index
    ]

    category = _model.classes_[
        best_index
    ]

    # -----------------------------------------------------
    # اگر مدل اطمینان کافی نداشت
    # -----------------------------------------------------

    if confidence < 0.35:

        return "تعیین نشده"

    # -----------------------------------------------------
    # فقط دسته‌های معتبر پروژه
    # -----------------------------------------------------

    if category not in CATEGORIES:

        return "تعیین نشده"

    return category