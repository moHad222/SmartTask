import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
import joblib

DATA_PATH = "data/training_data.csv"

data = pd.read_csv(DATA_PATH)

print(data.head())

print("\nتعداد نمونه‌ها:", len(data))
print("دسته‌ها:", data["category"].unique())

X = data["text"]
y = data["category"]


vectorizer = TfidfVectorizer(
    analyzer="word",
    ngram_range=(1, 2)
)

X_vectorized = vectorizer.fit_transform(X)


model = MultinomialNB()

model.fit(X_vectorized, y)


print("\nModel trained successfully!")

test_tasks = [
    "تحویل پروژه پایگاه داده",
    "رفع باگ برنامه پایتون",
    "خرید مواد غذایی",
    "پرداخت قبض برق",
    "جلسه با مدیر",
    "مرتب کردن اتاق"
]


test_vectors = vectorizer.transform(test_tasks)
predictions = model.predict(test_vectors)


print("\nTest predictions:")

for task, prediction in zip(test_tasks, predictions):
    print(f"{task} → {prediction}")

joblib.dump(model, "ai/task_classifier.pkl")
joblib.dump(vectorizer, "ai/task_vectorizer.pkl")

print("\nModel and vectorizer saved successfully!")