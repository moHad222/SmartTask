import streamlit as st

from database.database import add_task
from ai.model import predict_category


st.title("SmartTask 3")
st.write("Task Manager هوشمند")

st.subheader("ایجاد Task جدید")

title = st.text_input("عنوان Task")

description = st.text_area("توضیحات Task")

priority = st.selectbox(
    "اولویت",
    ["کم", "معمولی", "زیاد", "خیلی زیاد"]
)


if st.button("پیشنهاد دسته‌بندی با هوش مصنوعی"):
    if title.strip():
        category = predict_category(title)

        st.success(f"دسته‌بندی پیشنهادی: {category}")
    else:
        st.warning("لطفاً ابتدا عنوان Task را وارد کنید.")