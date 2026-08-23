from database.database import CATEGORIES


# =========================================================
# SIMPLE LOCAL AI CLASSIFIER
# =========================================================

KEYWORDS = {

    "دانشگاه": [
        "دانشگاه",
        "استاد",
        "امتحان",
        "کلاس",
        "ترم",
        "پروژه",
        "درس",
        "تمرین",
        "تحقیق",
        "گزارش",
        "کارآموزی",
        "پایان نامه",
        "پایان‌نامه",
    ],

    "برنامه نویسی": [
        "python",
        "پایتون",
        "برنامه",
        "کد",
        "کدنویسی",
        "برنامه نویسی",
        "برنامه‌نویسی",
        "javascript",
        "جاوا",
        "html",
        "css",
        "database",
        "دیتابیس",
        "api",
        "پروژه نرم افزار",
        "نرم افزار",
        "نرم‌افزار",
    ],

    "کاری": [
        "کار",
        "شرکت",
        "جلسه",
        "مشتری",
        "مدیر",
        "اداری",
        "گزارش کاری",
        "پروپوزال",
        "همکار",
        "دفتر",
    ],

    "شخصی": [
        "ورزش",
        "مطالعه",
        "استراحت",
        "خواب",
        "خانه",
        "اتاق",
        "تمیزکاری",
        "آشپزی",
        "فیلم",
        "کتاب",
        "موسیقی",
        "شخصی",
    ],

    "خرید": [
        "خرید",
        "فروشگاه",
        "سوپرمارکت",
        "لباس",
        "کفش",
        "کیف",
        "لوازم",
        "خریدن",
        "سفارش",
    ],

    "مالی": [
        "پول",
        "بانک",
        "قسط",
        "قبض",
        "پرداخت",
        "حقوق",
        "بودجه",
        "هزینه",
        "مالی",
        "وام",
    ],
}


def normalize_text(text):

    text = str(text).lower()

    replacements = {
        "ي": "ی",
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


def predict_category(title):

    text = normalize_text(title)

    scores = {
        category: 0
        for category in CATEGORIES
    }

    for category in CATEGORIES:

        words = KEYWORDS.get(
            category,
            []
        )

        for word in words:

            word = normalize_text(
                word
            )

            if word in text:

                scores[category] += 1

    best_category = max(
        scores,
        key=scores.get
    )

    if scores[best_category] == 0:

        return "تعیین نشده"

    return best_category