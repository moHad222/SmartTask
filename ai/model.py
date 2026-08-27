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
# MODEL
# =========================================================

_model = None
_vectorizer = None


def load_model():

    global _model
    global _vectorizer

    if _model is None or _vectorizer is None:

        _model = joblib.load(MODEL_PATH)
        _vectorizer = joblib.load(VECTORIZER_PATH)

        # سازگاری LogisticRegression
        # با نسخه‌های جدید scikit-learn
        if hasattr(_model, "solver"):

            if not hasattr(_model, "multi_class"):

                _model.multi_class = "auto"
# =========================================================
# NORMALIZE
# =========================================================

def normalize_text(text):

    text = str(text or "").lower().strip()

    replacements = {
        "ي": "ی",
        "ى": "ی",
        "ك": "ک",
        "ۀ": "ه",
        "ة": "ه",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    return text


# =========================================================
# PREDICT
# =========================================================

def predict_category(title):

    text = normalize_text(title)

    if not text:
        return "تعیین نشده"

    load_model()

    # -----------------------------------------------------
    # VECTORIZE
    # -----------------------------------------------------

    vector = _vectorizer.transform([text])

    # -----------------------------------------------------
    # PREDICT
    # -----------------------------------------------------

    category = _model.predict(vector)[0]

    # -----------------------------------------------------
    # CONFIDENCE
    # -----------------------------------------------------

    confidence = None

    if hasattr(_model, "predict_proba"):

        probabilities = _model.predict_proba(vector)[0]

        best_index = probabilities.argmax()

        category = _model.classes_[best_index]

        confidence = probabilities[best_index]

    # -----------------------------------------------------
    # VALID CATEGORY
    # -----------------------------------------------------

    if category not in CATEGORIES:

        return "تعیین نشده"

    # -----------------------------------------------------
    # CONFIDENCE THRESHOLD
    # -----------------------------------------------------

    if confidence is not None:

        if confidence < 0.35:

            return "تعیین نشده"

    return category