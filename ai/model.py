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
                f"فایل مدل پیدا نشد: {MODEL_PATH}"
            )

        if not VECTORIZER_PATH.exists():

            raise FileNotFoundError(
                f"فایل وکتورایزر پیدا نشد: {VECTORIZER_PATH}"
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
        "‌": " ",
    }

    for old, new in replacements.items():

        text = text.replace(
            old,
            new
        )

    text = " ".join(
        text.split()
    )

    return text


# =========================================================
# IMPORTANT KEYWORDS
# =========================================================

CATEGORY_KEYWORDS = {

    "دانشگاه": [

        "دانشگاه",
        "استاد",
        "امتحان",
        "کلاس",
        "ترم",
        "درس",
        "تکلیف",
        "پروژه درسی",
        "پروژه دانشگاه",
        "پایان نامه",
        "پایان‌نامه",
        "آزمایشگاه",
        "ارائه کلاسی",
        "پایگاه داده",

    ],

    "برنامه نویسی": [

        "پایتون",
        "python",
        "کد",
        "کدنویسی",
        "برنامه نویسی",
        "برنامه‌نویسی",
        "باگ",
        "خطای کد",
        "دیباگ",
        "دیتابیس",
        "database",
        "api",
        "javascript",
        "جاوا",
        "html",
        "css",
        "نرم افزار",
        "نرم‌افزار",
        "پیاده سازی",
        "پیاده‌سازی",
        "برنامه",

    ],

    "کاری": [

        "مدیر",
        "شرکت",
        "مشتری",
        "همکار",
        "جلسه کاری",
        "جلسه با مدیر",
        "وظیفه",
        "درخواست مشتری",
        "گزارش کاری",
        "ایمیل کاری",
        "کار شرکت",

    ],

    "شخصی": [

        "باشگاه",
        "ورزش",
        "بدنسازی",
        "فیتنس",
        "شنا",
        "دویدن",
        "پیاده روی",
        "پیاده‌روی",
        "یوگا",
        "استراحت",
        "خواب",
        "خانه",
        "اتاق",
        "تمیزکاری",
        "آشپزی",
        "فیلم",
        "سریال",
        "موسیقی",
        "دوست",
        "خودم",
        "وقت برای خودم",

    ],

    "خرید": [

        "خرید",
        "خریدن",
        "بخرم",
        "بگیرم",
        "تهیه کنم",
        "تهیه",
        "فروشگاه",
        "سوپرمارکت",
        "لباس",
        "کفش",
        "کیف",
        "لوازم",
        "وسایل",
        "مواد غذایی",
        "سفارش",

    ],

    "مالی": [

        "پول",
        "بانک",
        "حساب",
        "قسط",
        "قبض",
        "پرداخت",
        "حقوق",
        "بودجه",
        "هزینه",
        "خرج",
        "خرج کردم",
        "درآمد",
        "تراکنش",
        "بدهی",
        "وام",
        "مالی",

    ],

}


# =========================================================
# PREDICT
# =========================================================

def predict_category(title):

    text = normalize_text(
        title
    )

    if not text:

        return "تعیین نشده"


    load_model()


    # =====================================================
    # RULE-BASED SCORE
    # =====================================================

    keyword_scores = {

        category: 0

        for category in CATEGORIES

    }


    for category, keywords in CATEGORY_KEYWORDS.items():

        for keyword in keywords:

            keyword = normalize_text(
                keyword
            )

            if keyword in text:

                keyword_scores[category] += 1


    best_keyword_category = max(
        keyword_scores,
        key=keyword_scores.get
    )

    best_keyword_score = (
        keyword_scores[
            best_keyword_category
        ]
    )


    # اگر کلمه کلیدی واضح وجود داشته باشد
    if best_keyword_score >= 1:

        return best_keyword_category


    # =====================================================
    # ML PREDICTION
    # =====================================================

    vector = _vectorizer.transform(
        [text]
    )


    # =====================================================
    # PREDICT PROBABILITY
    # =====================================================

    if not hasattr(
        _model,
        "predict_proba"
    ):

        category = _model.predict(
            vector
        )[0]

        if category in CATEGORIES:

            return category

        return "تعیین نشده"


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


    # =====================================================
    # CONFIDENCE THRESHOLD
    # =====================================================

    if confidence < 0.35:

        return "تعیین نشده"


    if category not in CATEGORIES:

        return "تعیین نشده"


    return category
