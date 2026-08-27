import os
import hashlib
import secrets

import psycopg
from psycopg.rows import dict_row


# =========================================================
# DATABASE
# =========================================================

DATABASE_URL = os.environ.get("DATABASE_URL")


# =========================================================
# CONSTANTS
# =========================================================

CATEGORIES = [
    "تعیین نشده",
    "دانشگاه",
    "برنامه نویسی",
    "کاری",
    "شخصی",
    "خرید",
    "مالی",
]

PRIORITIES = [
    "خیلی زیاد",
    "زیاد",
    "معمولی",
    "کم",
]

STATUSES = [
    "انجام نشده",
    "در حال انجام",
    "انجام شده",
]

GUEST_USERNAME = "مهمان"


# =========================================================
# CONNECTION
# =========================================================

def get_connection():

    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL تنظیم نشده است."
        )

    return psycopg.connect(
        DATABASE_URL,
        row_factory=dict_row
    )


# =========================================================
# PASSWORD HASH
# =========================================================

def hash_password(password):

    salt = secrets.token_bytes(16)

    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        200_000
    )

    return (
        salt.hex()
        + "$"
        + password_hash.hex()
    )


def verify_password(
    password,
    stored_password
):

    try:

        salt_hex, hash_hex = (
            stored_password.split("$")
        )

        salt = bytes.fromhex(
            salt_hex
        )

        expected_hash = bytes.fromhex(
            hash_hex
        )

        actual_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            200_000
        )

        return secrets.compare_digest(
            actual_hash,
            expected_hash
        )

    except Exception:

        return False


# =========================================================
# INITIALIZE DATABASE
# =========================================================

def init_db():

    conn = get_connection()

    try:

        with conn.cursor() as cursor:

            # =================================================
            # USERS
            # =================================================

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (

                    id SERIAL PRIMARY KEY,

                    username TEXT NOT NULL,

                    password TEXT NOT NULL,

                    created_at TIMESTAMP
                        DEFAULT CURRENT_TIMESTAMP
                )
            """)


            # =================================================
            # CATEGORIES
            # =================================================

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS categories (

                    id SERIAL PRIMARY KEY,

                    name TEXT NOT NULL UNIQUE,

                    created_at TIMESTAMP
                        DEFAULT CURRENT_TIMESTAMP
                )
            """)


            # =================================================
            # TASKS
            # =================================================

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tasks (

                    id SERIAL PRIMARY KEY,

                    user_id INTEGER NOT NULL,

                    category_id INTEGER,

                    title TEXT NOT NULL,

                    description TEXT,

                    priority TEXT NOT NULL
                        DEFAULT 'معمولی',

                    status TEXT NOT NULL
                        DEFAULT 'انجام نشده',

                    created_at TIMESTAMP
                        DEFAULT CURRENT_TIMESTAMP,

                    due_date DATE,

                    reminder_at TIMESTAMP,

                    FOREIGN KEY (user_id)
                        REFERENCES users(id)
                        ON DELETE CASCADE,

                    FOREIGN KEY (category_id)
                        REFERENCES categories(id)
                        ON DELETE SET NULL
                )
            """)


            # =================================================
            # DEFAULT CATEGORIES
            # =================================================

            for category in CATEGORIES:

                cursor.execute("""
                    INSERT INTO categories (name)
                    VALUES (%s)
                    ON CONFLICT (name) DO NOTHING
                """, (category,))


            # =================================================
            # GUEST USER
            # =================================================

            cursor.execute("""
                SELECT id
                FROM users
                WHERE username = %s
                LIMIT 1
            """, (GUEST_USERNAME,))

            guest = cursor.fetchone()


            if not guest:

                cursor.execute("""
                    INSERT INTO users (
                        username,
                        password
                    )
                    VALUES (%s, %s)
                """, (
                    GUEST_USERNAME,
                    hash_password(
                        secrets.token_urlsafe(32)
                    )
                ))


        conn.commit()

    finally:

        conn.close()


# =========================================================
# USER FUNCTIONS
# =========================================================

def get_guest_user():

    conn = get_connection()

    try:

        with conn.cursor() as cursor:

            cursor.execute("""
                SELECT
                    id,
                    username,
                    password,
                    created_at
                FROM users
                WHERE username LIKE 'مهمان_%%'
                ORDER BY id DESC
                LIMIT 1
            """)

            row = cursor.fetchone()

            return row

    finally:

        conn.close()


def create_guest_user():

    username = (
        "مهمان_"
        + secrets.token_urlsafe(8)
    )

    password = secrets.token_urlsafe(32)

    conn = get_connection()

    try:

        with conn.cursor() as cursor:

            cursor.execute("""
                INSERT INTO users (
                    username,
                    password
                )
                VALUES (%s, %s)
                RETURNING id
            """, (
                username,
                hash_password(password)
            ))

            row = cursor.fetchone()

            user_id = row["id"]

        conn.commit()

    finally:

        conn.close()


    return {
        "id": user_id,
        "username": username
    }


def get_user_by_username(username):

    conn = get_connection()

    try:

        with conn.cursor() as cursor:

            cursor.execute("""
                SELECT
                    id,
                    username,
                    password,
                    created_at
                FROM users
                WHERE username = %s
                LIMIT 1
            """, (username,))

            return cursor.fetchone()

    finally:

        conn.close()


def create_user(
    username,
    password
):

    username = str(
        username or ""
    ).strip()

    password = str(
        password or ""
    )


    if not username:

        return (
            None,
            "نام کاربری الزامی است."
        )


    if len(username) < 3:

        return (
            None,
            "نام کاربری باید حداقل ۳ کاراکتر باشد."
        )


    if len(username) > 30:

        return (
            None,
            "نام کاربری نباید بیشتر از ۳۰ کاراکتر باشد."
        )


    if username == GUEST_USERNAME:

        return (
            None,
            "این نام کاربری قابل استفاده نیست."
        )


    if not password:

        return (
            None,
            "رمز عبور الزامی است."
        )


    if len(password) < 4:

        return (
            None,
            "رمز عبور باید حداقل ۴ کاراکتر باشد."
        )


    existing = get_user_by_username(
        username
    )

    if existing:

        return (
            None,
            "این نام کاربری قبلاً ثبت شده است."
        )


    conn = get_connection()

    try:

        with conn.cursor() as cursor:

            cursor.execute("""
                INSERT INTO users (
                    username,
                    password
                )
                VALUES (%s, %s)
                RETURNING id
            """, (
                username,
                hash_password(password)
            ))

            row = cursor.fetchone()

            user_id = row["id"]

        conn.commit()

    finally:

        conn.close()


    return user_id, None


def authenticate_user(
    username,
    password
):

    username = str(
        username or ""
    ).strip()

    password = str(
        password or ""
    )


    user = get_user_by_username(
        username
    )


    if not user:

        return None


    if username == GUEST_USERNAME:

        return None


    if not verify_password(
        password,
        user["password"]
    ):

        return None


    return user


# =========================================================
# CATEGORY
# =========================================================

def get_categories():

    conn = get_connection()

    try:

        with conn.cursor() as cursor:

            cursor.execute("""
                SELECT
                    id,
                    name
                FROM categories
                ORDER BY id
            """)

            rows = cursor.fetchall()

            return rows

    finally:

        conn.close()


def get_category_id(
    category_name
):

    if not category_name:

        return None


    conn = get_connection()

    try:

        with conn.cursor() as cursor:

            cursor.execute("""
                SELECT id
                FROM categories
                WHERE name = %s
            """, (category_name,))

            row = cursor.fetchone()

            if row:

                return row["id"]

            return None

    finally:

        conn.close()


# =========================================================
# CREATE TASK
# =========================================================

def create_task(
    user_id,
    title,
    description="",
    priority="معمولی",
    category="دانشگاه",
    due_date=None,
    reminder_at=None
):

    if priority not in PRIORITIES:

        priority = "معمولی"


    if category not in CATEGORIES:

        category = "تعیین نشده"


    category_id = get_category_id(
        category
    )


    conn = get_connection()

    try:

        with conn.cursor() as cursor:

            cursor.execute("""
                INSERT INTO tasks (

                    user_id,

                    category_id,

                    title,

                    description,

                    priority,

                    status,

                    due_date,

                    reminder_at

                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                RETURNING id
            """, (

                user_id,

                category_id,

                title,

                description,

                priority,

                "انجام نشده",

                due_date,

                reminder_at

            ))

            row = cursor.fetchone()

            task_id = row["id"]

        conn.commit()

    finally:

        conn.close()


    return task_id


# =========================================================
# GET ALL TASKS
# =========================================================

def get_all_tasks(
    user_id
):

    conn = get_connection()

    try:

        with conn.cursor() as cursor:

            cursor.execute("""
                SELECT

                    tasks.id,

                    tasks.user_id,

                    tasks.title,

                    tasks.description,

                    tasks.priority,

                    tasks.status,

                    tasks.created_at,

                    tasks.due_date,

                    tasks.reminder_at,

                    categories.name AS category

                FROM tasks

                LEFT JOIN categories
                    ON tasks.category_id =
                       categories.id

                WHERE tasks.user_id = %s

                ORDER BY tasks.id DESC

            """, (user_id,))

            rows = cursor.fetchall()

            return rows

    finally:

        conn.close()


# =========================================================
# GET ONE TASK
# =========================================================

def get_task(
    task_id,
    user_id=None
):

    conn = get_connection()

    try:

        with conn.cursor() as cursor:

            if user_id is None:

                cursor.execute("""
                    SELECT

                        tasks.id,

                        tasks.user_id,

                        tasks.title,

                        tasks.description,

                        tasks.priority,

                        tasks.status,

                        tasks.created_at,

                        tasks.due_date,

                        tasks.reminder_at,

                        categories.name AS category

                    FROM tasks

                    LEFT JOIN categories
                        ON tasks.category_id =
                           categories.id

                    WHERE tasks.id = %s

                """, (task_id,))

            else:

                cursor.execute("""
                    SELECT

                        tasks.id,

                        tasks.user_id,

                        tasks.title,

                        tasks.description,

                        tasks.priority,

                        tasks.status,

                        tasks.created_at,

                        tasks.due_date,

                        tasks.reminder_at,

                        categories.name AS category

                    FROM tasks

                    LEFT JOIN categories
                        ON tasks.category_id =
                           categories.id

                    WHERE tasks.id = %s

                    AND tasks.user_id = %s

                """, (
                    task_id,
                    user_id
                ))

            return cursor.fetchone()

    finally:

        conn.close()


# =========================================================
# UPDATE TASK
# =========================================================

def update_task(
    task_id,
    user_id,
    title,
    description,
    priority,
    category,
    due_date,
    reminder_at=None
):

    if priority not in PRIORITIES:

        priority = "معمولی"


    if category not in CATEGORIES:

        category = "تعیین نشده"


    category_id = get_category_id(
        category
    )


    conn = get_connection()

    try:

        with conn.cursor() as cursor:

            cursor.execute("""
                UPDATE tasks

                SET

                    title = %s,

                    description = %s,

                    priority = %s,

                    category_id = %s,

                    due_date = %s,

                    reminder_at = %s

                WHERE id = %s

                AND user_id = %s

            """, (

                title,

                description,

                priority,

                category_id,

                due_date,

                reminder_at,

                task_id,

                user_id

            ))

            changed = cursor.rowcount

        conn.commit()

    finally:

        conn.close()


    return changed > 0


# =========================================================
# UPDATE STATUS
# =========================================================

def update_task_status(
    task_id,
    user_id,
    status
):

    if status not in STATUSES:

        return False


    conn = get_connection()

    try:

        with conn.cursor() as cursor:

            cursor.execute("""
                UPDATE tasks

                SET status = %s

                WHERE id = %s

                AND user_id = %s

            """, (

                status,

                task_id,

                user_id

            ))

            changed = cursor.rowcount

        conn.commit()

    finally:

        conn.close()


    return changed > 0


# =========================================================
# DELETE TASK
# =========================================================

def delete_task(
    task_id,
    user_id
):

    conn = get_connection()

    try:

        with conn.cursor() as cursor:

            cursor.execute("""
                DELETE FROM tasks

                WHERE id = %s

                AND user_id = %s

            """, (
                task_id,
                user_id
            ))

            deleted = cursor.rowcount

        conn.commit()

    finally:

        conn.close()


    return deleted > 0


