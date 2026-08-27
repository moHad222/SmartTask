import json
import os
import secrets

from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
from http.cookies import SimpleCookie

from database.database import (
    init_db,
    get_all_tasks,
    create_task,
    update_task,
    update_task_status,
    delete_task,
    get_categories,
    CATEGORIES,
    PRIORITIES,
    STATUSES,
    create_guest_user,
    create_user,
    authenticate_user,
)

from ai.model import predict_category


# =========================================================
# SETTINGS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent

DEFAULT_PORT = 8000


# =========================================================
# DATABASE
# =========================================================

# DATABASE_URL توسط محیط Liara تأمین می‌شود.
init_db()


# =========================================================
# SESSIONS
# =========================================================

SESSIONS = {}


# =========================================================
# RESPONSE HELPERS
# =========================================================

def send_json(handler, data, status=200, session_id=None):

    response = json.dumps(
        data,
        ensure_ascii=False,
        default=str
    ).encode("utf-8")

    handler.send_response(status)

    handler.send_header(
        "Content-Type",
        "application/json; charset=utf-8"
    )

    handler.send_header(
        "Content-Length",
        str(len(response))
    )

    if session_id:

        handler.send_header(
            "Set-Cookie",
            f"session_id={session_id}; "
            "Path=/; "
            "HttpOnly; "
            "SameSite=Lax"
        )

    handler.end_headers()

    handler.wfile.write(response)


def read_json(handler):

    try:

        content_length = int(
            handler.headers.get(
                "Content-Length",
                0
            )
        )

        if content_length <= 0:
            return {}

        body = handler.rfile.read(
            content_length
        )

        if not body:
            return {}

        return json.loads(
            body.decode("utf-8")
        )

    except Exception:

        return {}


# =========================================================
# SESSION HELPERS
# =========================================================

def get_cookie_session(handler):

    cookie_header = handler.headers.get(
        "Cookie",
        ""
    )

    if not cookie_header:
        return None

    cookie = SimpleCookie()

    try:

        cookie.load(cookie_header)

    except Exception:

        return None

    if "session_id" not in cookie:
        return None

    return cookie["session_id"].value


def create_session(
    user_id,
    username,
    is_guest=False
):

    session_id = secrets.token_urlsafe(32)

    SESSIONS[session_id] = {
        "user_id": int(user_id),
        "username": username,
        "is_guest": bool(is_guest)
    }

    return session_id


def get_current_session(handler):

    session_id = get_cookie_session(handler)

    if session_id:

        session = SESSIONS.get(
            session_id
        )

        if session:
            return session_id, session

    # اگر Session وجود نداشت،
    # یک کاربر مهمان جدید ساخته می‌شود.

    guest = create_guest_user()

    if not guest:

        raise RuntimeError(
            "ساخت کاربر مهمان انجام نشد."
        )

    session_id = create_session(
        guest["id"],
        guest["username"],
        True
    )

    return (
        session_id,
        SESSIONS[session_id]
    )


# =========================================================
# DATE / REMINDER VALIDATION
# =========================================================

def normalize_date(value):

    """
    تاریخ سررسید را به فرمت استاندارد YYYY-MM-DD
    تبدیل می‌کند.

    مرورگر معمولاً همین فرمت را ارسال می‌کند.
    اگر مقدار خالی باشد، None برمی‌گردد.
    """

    if value is None:
        return None

    value = str(value).strip()

    if not value:
        return None

    # فرمت استاندارد HTML date
    if len(value) == 10:

        parts = value.split("-")

        if (
            len(parts) == 3
            and all(part.isdigit() for part in parts)
            and len(parts[0]) == 4
            and len(parts[1]) == 2
            and len(parts[2]) == 2
        ):

            return value

    return value


def normalize_reminder(value):

    """
    زمان یادآوری را برای ذخیره در دیتابیس استاندارد می‌کند.

    ورودی معمولاً:
        YYYY-MM-DDTHH:MM

    است.

    برای سازگاری با دیتابیس، T به فاصله تبدیل می‌شود:
        YYYY-MM-DD HH:MM
    """

    if value is None:
        return None

    value = str(value).strip()

    if not value:
        return None

    value = value.replace("T", " ")

    return value


# =========================================================
# TASK VALIDATION
# =========================================================

def validate_task_data(data):

    title = str(
        data.get(
            "title",
            ""
        )
    ).strip()

    description = str(
        data.get(
            "description",
            ""
        )
    ).strip()

    priority = str(
        data.get(
            "priority",
            "معمولی"
        )
    ).strip()

    category = str(
        data.get(
            "category",
            "تعیین نشده"
        )
    ).strip()

    due_date = normalize_date(
        data.get("due_date")
    )

    reminder_at = normalize_reminder(
        data.get("reminder_at")
    )


    # -----------------------------------------------------
    # TITLE
    # -----------------------------------------------------

    if not title:

        return (
            None,
            "عنوان کار الزامی است."
        )


    # -----------------------------------------------------
    # PRIORITY
    # -----------------------------------------------------

    if priority not in PRIORITIES:

        return (
            None,
            "اولویت نامعتبر است."
        )


    # -----------------------------------------------------
    # CATEGORY
    # -----------------------------------------------------

    if category not in CATEGORIES:

        return (
            None,
            "دسته‌بندی نامعتبر است."
        )


    # -----------------------------------------------------
    # RESULT
    # -----------------------------------------------------

    return {

        "title": title,

        "description": description,

        "priority": priority,

        "category": category,

        "due_date": due_date,

        "reminder_at": reminder_at

    }, None


# =========================================================
# REQUEST HANDLER
# =========================================================

class SmartTaskHandler(SimpleHTTPRequestHandler):


    # =====================================================
    # PATH TRANSLATION
    # =====================================================

    def translate_path(self, path):

        parsed = urlparse(path)

        clean_path = parsed.path


        # -------------------------------------------------
        # صفحه اصلی
        # -------------------------------------------------

        if clean_path == "/":

            return str(
                BASE_DIR /
                "templates" /
                "index.html"
            )


        # -------------------------------------------------
        # فایل‌های استاتیک
        # -------------------------------------------------

        if clean_path.startswith("/static/"):

            relative_path = clean_path[
                len("/static/"):
            ]

            return str(
                BASE_DIR /
                "static" /
                relative_path
            )


        return str(
            BASE_DIR /
            clean_path.lstrip("/")
        )


    # =====================================================
    # GET
    # =====================================================

    def do_GET(self):

        parsed = urlparse(
            self.path
        )

        path = parsed.path

        print(
            f"GET {path}"
        )


        # -------------------------------------------------
        # SESSION
        # -------------------------------------------------

        try:

            session_id, session = (
                get_current_session(self)
            )

        except Exception as e:

            print(
                "SESSION ERROR:",
                e
            )

            send_json(
                self,
                {
                    "error": str(e)
                },
                500
            )

            return


        # -------------------------------------------------
        # SESSION API
        # -------------------------------------------------

        if path == "/api/session":

            send_json(

                self,

                {
                    "logged_in":
                        not session["is_guest"],

                    "is_guest":
                        session["is_guest"],

                    "user_id":
                        session["user_id"],

                    "username":
                        "مهمان"
                        if session["is_guest"]
                        else session["username"]
                },

                200,

                session_id
            )

            return


        # -------------------------------------------------
        # TASKS
        # -------------------------------------------------

        if path == "/api/tasks":

            try:

                tasks = get_all_tasks(
                    session["user_id"]
                )

                send_json(
                    self,
                    tasks,
                    200,
                    session_id
                )

            except Exception as e:

                print(
                    "GET TASKS ERROR:",
                    e
                )

                send_json(
                    self,
                    {
                        "error": str(e)
                    },
                    500,
                    session_id
                )

            return


        # -------------------------------------------------
        # CATEGORIES
        # -------------------------------------------------

        if path == "/api/categories":

            try:

                categories = get_categories()

                send_json(
                    self,
                    categories,
                    200,
                    session_id
                )

            except Exception as e:

                print(
                    "GET CATEGORIES ERROR:",
                    e
                )

                send_json(
                    self,
                    {
                        "error": str(e)
                    },
                    500,
                    session_id
                )

            return


        # -------------------------------------------------
        # OPTIONS
        # -------------------------------------------------

        if path == "/api/options":

            send_json(

                self,

                {
                    "categories": CATEGORIES,
                    "priorities": PRIORITIES,
                    "statuses": STATUSES
                },

                200,

                session_id
            )

            return


        # -------------------------------------------------
        # STATIC / HTML
        # -------------------------------------------------

        super().do_GET()


    # =====================================================
    # POST
    # =====================================================

    def do_POST(self):

        parsed = urlparse(
            self.path
        )

        path = parsed.path

        print(
            f"POST {path}"
        )


        data = read_json(
            self
        )


        # =================================================
        # REGISTER
        # =================================================

        if path == "/api/register":

            username = str(
                data.get(
                    "username",
                    ""
                )
            ).strip()

            password = str(
                data.get(
                    "password",
                    ""
                )
            )


            try:

                user_id, error = create_user(
                    username,
                    password
                )


                if error:

                    send_json(
                        self,
                        {
                            "error": error
                        },
                        400
                    )

                    return


                session_id = create_session(
                    user_id,
                    username,
                    False
                )


                send_json(

                    self,

                    {
                        "success": True,
                        "username": username
                    },

                    201,

                    session_id
                )


            except Exception as e:

                print(
                    "REGISTER ERROR:",
                    e
                )

                send_json(
                    self,
                    {
                        "error": str(e)
                    },
                    500
                )

            return


        # =================================================
        # LOGIN
        # =================================================

        if path == "/api/login":

            username = str(
                data.get(
                    "username",
                    ""
                )
            ).strip()

            password = str(
                data.get(
                    "password",
                    ""
                )
            )


            if not username or not password:

                send_json(

                    self,

                    {
                        "error":
                            "نام کاربری و رمز عبور را وارد کن."
                    },

                    400
                )

                return


            try:

                user = authenticate_user(
                    username,
                    password
                )


                if not user:

                    send_json(

                        self,

                        {
                            "error":
                                "نام کاربری یا رمز عبور اشتباه است."
                        },

                        401
                    )

                    return


                session_id = create_session(
                    user["id"],
                    user["username"],
                    False
                )


                send_json(

                    self,

                    {
                        "success": True,
                        "username":
                            user["username"]
                    },

                    200,

                    session_id
                )


            except Exception as e:

                print(
                    "LOGIN ERROR:",
                    e
                )

                send_json(
                    self,
                    {
                        "error": str(e)
                    },
                    500
                )

            return


        # =================================================
        # GUEST
        # =================================================

        if path == "/api/guest":

            try:

                guest = create_guest_user()


                if not guest:

                    send_json(

                        self,

                        {
                            "error":
                                "ساخت کاربر مهمان انجام نشد."
                        },

                        500
                    )

                    return


                session_id = create_session(
                    guest["id"],
                    guest["username"],
                    True
                )


                send_json(

                    self,

                    {
                        "success": True,
                        "username": "مهمان",
                        "is_guest": True
                    },

                    200,

                    session_id
                )


            except Exception as e:

                print(
                    "GUEST ERROR:",
                    e
                )

                send_json(
                    self,
                    {
                        "error": str(e)
                    },
                    500
                )

            return


        # =================================================
        # LOGOUT
        # =================================================

        if path == "/api/logout":

            old_session_id = (
                get_cookie_session(self)
            )


            if old_session_id:

                SESSIONS.pop(
                    old_session_id,
                    None
                )


            try:

                guest = create_guest_user()


                if not guest:

                    send_json(

                        self,

                        {
                            "error":
                                "ساخت کاربر مهمان انجام نشد."
                        },

                        500
                    )

                    return


                new_session_id = create_session(
                    guest["id"],
                    guest["username"],
                    True
                )


                send_json(

                    self,

                    {
                        "success": True,
                        "username": "مهمان",
                        "is_guest": True
                    },

                    200,

                    new_session_id
                )


            except Exception as e:

                print(
                    "LOGOUT ERROR:",
                    e
                )

                send_json(
                    self,
                    {
                        "error": str(e)
                    },
                    500
                )

            return


        # =================================================
        # CURRENT SESSION
        # =================================================

        try:

            session_id, session = (
                get_current_session(self)
            )

        except Exception as e:

            send_json(

                self,

                {
                    "error": str(e)
                },

                500
            )

            return


        # =================================================
        # AI PREDICTION
        # =================================================

        if path == "/api/predict":

            title = str(
                data.get(
                    "title",
                    ""
                )
            ).strip()


            if not title:

                send_json(

                    self,

                    {
                        "error":
                            "عنوان کار خالی است."
                    },

                    400,

                    session_id
                )

                return


            try:

                category = predict_category(
                    title
                )


                send_json(

                    self,

                    {
                        "category": category
                    },

                    200,

                    session_id
                )


            except Exception as e:

                print(
                    "AI ERROR:",
                    e
                )

                send_json(

                    self,

                    {
                        "error": str(e)
                    },

                    500,

                    session_id
                )

            return


        # =================================================
        # CREATE TASK
        # =================================================

        if path == "/api/tasks":

            task_data, error = (
                validate_task_data(data)
            )


            if error:

                send_json(

                    self,

                    {
                        "error": error
                    },

                    400,

                    session_id
                )

                return


            try:

                task_id = create_task(

                    user_id=session["user_id"],

                    title=task_data["title"],

                    description=
                        task_data["description"],

                    priority=
                        task_data["priority"],

                    category=
                        task_data["category"],

                    due_date=
                        task_data["due_date"],

                    reminder_at=
                        task_data["reminder_at"]
                )


                send_json(

                    self,

                    {
                        "success": True,
                        "task_id": task_id
                    },

                    201,

                    session_id
                )


            except Exception as e:

                print(
                    "CREATE TASK ERROR:",
                    e
                )

                send_json(

                    self,

                    {
                        "error": str(e)
                    },

                    500,

                    session_id
                )

            return


        # =================================================
        # UPDATE TASK
        # =================================================

        if path == "/api/tasks/update":

            task_id = data.get(
                "task_id"
            )


            if not task_id:

                send_json(

                    self,

                    {
                        "error":
                            "شناسه کار ارسال نشده است."
                    },

                    400,

                    session_id
                )

                return


            task_data, error = (
                validate_task_data(data)
            )


            if error:

                send_json(

                    self,

                    {
                        "error": error
                    },

                    400,

                    session_id
                )

                return


            try:

                updated = update_task(

                    task_id=int(task_id),

                    user_id=session["user_id"],

                    title=task_data["title"],

                    description=
                        task_data["description"],

                    priority=
                        task_data["priority"],

                    category=
                        task_data["category"],

                    due_date=
                        task_data["due_date"],

                    reminder_at=
                        task_data["reminder_at"]
                )


                if not updated:

                    send_json(

                        self,

                        {
                            "error":
                                "کار پیدا نشد."
                        },

                        404,

                        session_id
                    )

                    return


                send_json(

                    self,

                    {
                        "success": True
                    },

                    200,

                    session_id
                )


            except Exception as e:

                print(
                    "UPDATE TASK ERROR:",
                    e
                )

                send_json(

                    self,

                    {
                        "error": str(e)
                    },

                    500,

                    session_id
                )

            return


        # =================================================
        # UPDATE STATUS
        # =================================================

        if path == "/api/tasks/status":

            task_id = data.get(
                "task_id"
            )

            status = data.get(
                "status"
            )


            if not task_id or not status:

                send_json(

                    self,

                    {
                        "error":
                            "شناسه یا وضعیت کار ارسال نشده است."
                    },

                    400,

                    session_id
                )

                return


            try:

                updated = update_task_status(

                    int(task_id),

                    session["user_id"],

                    status
                )


                if not updated:

                    send_json(

                        self,

                        {
                            "error":
                                "کار یا وضعیت نامعتبر است."
                        },

                        400,

                        session_id
                    )

                    return


                send_json(

                    self,

                    {
                        "success": True
                    },

                    200,

                    session_id
                )


            except Exception as e:

                print(
                    "UPDATE STATUS ERROR:",
                    e
                )

                send_json(

                    self,

                    {
                        "error": str(e)
                    },

                    500,

                    session_id
                )

            return


        # =================================================
        # DELETE TASK
        # =================================================

        if path == "/api/tasks/delete":

            task_id = data.get(
                "task_id"
            )


            if not task_id:

                send_json(

                    self,

                    {
                        "error":
                            "شناسه کار ارسال نشده است."
                    },

                    400,

                    session_id
                )

                return


            try:

                deleted = delete_task(

                    int(task_id),

                    session["user_id"]
                )


                if not deleted:

                    send_json(

                        self,

                        {
                            "error":
                                "کار پیدا نشد."
                        },

                        404,

                        session_id
                    )

                    return


                send_json(

                    self,

                    {
                        "success": True
                    },

                    200,

                    session_id
                )


            except Exception as e:

                print(
                    "DELETE ERROR:",
                    e
                )

                send_json(

                    self,

                    {
                        "error": str(e)
                    },

                    500,

                    session_id
                )

            return


        # =================================================
        # UNKNOWN API
        # =================================================

        send_json(

            self,

            {
                "error":
                    "API endpoint پیدا نشد."
            },

            404,

            session_id
        )


    # =====================================================
    # HEAD
    # =====================================================

    def do_HEAD(self):

        if self.path == "/favicon.ico":

            self.send_response(204)

            self.end_headers()

            return


        super().do_HEAD()


# =========================================================
# START SERVER
# =========================================================

def run_server():

    port = int(
        os.environ.get(
            "PORT",
            DEFAULT_PORT
        )
    )


    server = HTTPServer(
        ("0.0.0.0", port),
        SmartTaskHandler
    )


    print("=" * 40)
    print("SmartTask3")
    print(f"Server running on port {port}")
    print("=" * 40)


    try:

        server.serve_forever()


    except KeyboardInterrupt:

        print("\nServer stopped.")


    finally:

        server.server_close()


# =========================================================
# MAIN
# =========================================================

if __name__ == "__main__":

    run_server()