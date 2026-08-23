from model import predict_category


test_tasks = [
    "تحویل پروژه پایگاه داده",
    "رفع باگ برنامه پایتون",
    "خرید مواد غذایی",
    "پرداخت قبض برق",
    "جلسه با مدیر",
    "مرتب کردن اتاق"
]


for task in test_tasks:
    category = predict_category(task)

    print(f"{task} → {category}")