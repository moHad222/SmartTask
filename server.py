import json
import secrets

from http.server import (
    SimpleHTTPRequestHandler,
    HTTPServer
)

from pathlib import Path

from urllib.parse import urlparse

from http.cookies import SimpleCookie

from database.database import (
    init_db,
    get_all_tasks,
    get_task,
    create_task,
    update_task,
    update_task_status,
    delete_task,
    get_categories,
    CATEGORIES,
    PRIORITIES,
    STATUSES,
    create_guest_user,
    get_user_by_username,
    create_user,
    authenticate_user,
)

from ai.model import predict_category


# =========================================================
# SETTINGS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent

HOST = "localhost"

PORT = 8000


# =========================================================
# DATABASE
# =========================================================

init_db()


# =========================================================
# SESSIONS
# =========================================================

SESSIONS = {}


# =========================================================
# HELPERS
# =========================================================

def send_json(
    handler,
    data,
    status=200
):

    response = json.dumps(
        data,
        ensure_ascii=False
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
# SESSION
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

        "is_guest": is_guest

    }


    return session_id


def get_current_session(handler):

    session_id = get_cookie_session(
        handler
    )


    if session_id:

        session = SESSIONS.get(
            session_id
        )


        if session:

            return (
                session_id,
                session
            )


    # -----------------------------------------------------
    # اگر Session وجود نداشت → Guest جدید
    # -----------------------------------------------------

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


def set_session_cookie(
    handler,
    session_id
):

    handler.send_header(
        "Set-Cookie",
        f"session_id={session_id}; "
        "Path=/; "
        "HttpOnly; "
        "SameSite=Lax"
    )


def get_user_from_request(handler):

    session_id = get_cookie_session(
        handler
    )


    if not session_id:

        return None


    return SESSIONS.get(
        session_id
    )


# =========================================================
# SEND JSON WITH SESSION
# =========================================================

def send_session_json(
    handler,
    data,
    status=200,
    session_id=None
):

    response = json.dumps(
        data,
        ensure_ascii=False
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

        set_session_cookie(
            handler,
            session_id
        )


    handler.end_headers()


    handler.wfile.write(response)


# =========================================================
# VALIDATE TASK
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


    due_date = data.get(
        "due_date"
    )


    reminder_at = data.get(
        "reminder_at"
    )


    if due_date is not None:

        due_date = str(
            due_date
        ).strip()


        if not due_date:

            due_date = None


    if reminder_at is not None:

        reminder_at = str(
            reminder_at
        ).strip()


        if not reminder_at:

            reminder_at = None


    if not title:

        return (
            None,
            "عنوان Task الزامی است."
        )


    if priority not in PRIORITIES:

        return (
            None,
            "اولویت نامعتبر است."
        )


    if category not in CATEGORIES:

        return (
            None,
            "دسته‌بندی نامعتبر است."
        )


    return {

        "title": title,

        "description": description,

        "priority": priority,

        "category": category,

        "due_date": due_date,

        "reminder_at": reminder_at,

    }, None


# =========================================================
# REQUEST HANDLER
# =========================================================

class SmartTaskHandler(
    SimpleHTTPRequestHandler
):


    # =====================================================
    # PATH TRANSLATION
    # =====================================================

    def translate_path(
        self,
        path
    ):

        parsed = urlparse(path)

        clean_path = parsed.path


        if clean_path == "/":

            return str(
                BASE_DIR /
                "templates" /
                "index.html"
            )


        if clean_path.startswith(
            "/static/"
        ):

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
            f"GET request: {self.path}"
        )


        # -------------------------------------------------
        # SESSION
        # -------------------------------------------------

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


        # -------------------------------------------------
        # CURRENT USER
        # -------------------------------------------------

        if path == "/api/session":

            send_session_json(
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

                session_id=session_id
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


                send_session_json(
                    self,
                    tasks,
                    session_id=session_id
                )


            except Exception as e:

                print(
                    "GET TASKS ERROR:",
                    e
                )


                send_session_json(
                    self,
                    {
                        "error": str(e)
                    },
                    500,
                    session_id=session_id
                )


            return


        # -------------------------------------------------
        # CATEGORIES
        # -------------------------------------------------

        if path == "/api/categories":

            try:

                categories = get_categories()


                send_session_json(
                    self,
                    categories,
                    session_id=session_id
                )


            except Exception as e:

                send_session_json(
                    self,
                    {
                        "error": str(e)
                    },
                    500,
                    session_id=session_id
                )


            return


        # -------------------------------------------------
        # OPTIONS
        # -------------------------------------------------

        if path == "/api/options":

            send_session_json(
                self,

                {
                    "categories":
                        CATEGORIES,

                    "priorities":
                        PRIORITIES,

                    "statuses":
                        STATUSES
                },

                session_id=session_id
            )

            return


        # -------------------------------------------------
        # DEFAULT
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
            f"POST request: {self.path}"
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


            send_session_json(
                self,

                {
                    "success": True,

                    "username":
                        username
                },

                201,

                session_id
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


            send_session_json(
                self,

                {
                    "success": True,

                    "username":
                        user["username"]
                },

                200,

                session_id
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


                send_session_json(
                    self,

                    {
                        "success": True,

                        "username":
                            "مهمان",

                        "is_guest":
                            True
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
                        "error":
                            str(e)
                    },
                    500
                )


            return


        # =================================================
        # LOGOUT
        # =================================================

        if path == "/api/logout":

            session_id = get_cookie_session(
                self
            )


            if session_id:

                SESSIONS.pop(
                    session_id,
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


                send_session_json(
                    self,

                    {
                        "success": True,

                        "username":
                            "مهمان",

                        "is_guest":
                            True
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
                        "error":
                            str(e)
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
        # AI
        # =================================================

        if path == "/api/predict":

            title = str(
                data.get(
                    "title",
                    ""
                )
            ).strip()


            if not title:

                send_session_json(
                    self,
                    {
                        "error":
                        "عنوان Task خالی است."
                    },
                    400,
                    session_id
                )

                return


            try:

                category = predict_category(
                    title
                )


                send_session_json(
                    self,

                    {
                        "category":
                            category
                    },

                    session_id=session_id
                )


            except Exception as e:

                print(
                    "AI ERROR:",
                    e
                )


                send_session_json(
                    self,

                    {
                        "error":
                            str(e)
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

                send_session_json(
                    self,
                    {
                        "error":
                            error
                    },
                    400,
                    session_id
                )

                return


            try:

                task_id = create_task(

                    user_id=
                        session["user_id"],

                    title=
                        task_data["title"],

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


                send_session_json(
                    self,

                    {
                        "success":
                            True,

                        "task_id":
                            task_id
                    },

                    201,

                    session_id
                )


            except Exception as e:

                print(
                    "CREATE TASK ERROR:",
                    e
                )


                send_session_json(
                    self,

                    {
                        "error":
                            str(e)
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

                send_session_json(
                    self,

                    {
                        "error":
                        "شناسه Task ارسال نشده است."
                    },

                    400,

                    session_id
                )

                return


            task_data, error = (
                validate_task_data(data)
            )


            if error:

                send_session_json(
                    self,

                    {
                        "error":
                            error
                    },

                    400,

                    session_id
                )

                return


            try:

                updated = update_task(

                    task_id=
                        int(task_id),

                    user_id=
                        session["user_id"],

                    title=
                        task_data["title"],

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

                    send_session_json(
                        self,

                        {
                            "error":
                            "Task پیدا نشد."
                        },

                        404,

                        session_id
                    )

                    return


                send_session_json(
                    self,

                    {
                        "success":
                            True
                    },

                    session_id=session_id
                )


            except Exception as e:

                print(
                    "UPDATE TASK ERROR:",
                    e
                )


                send_session_json(
                    self,

                    {
                        "error":
                            str(e)
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

                send_session_json(
                    self,

                    {
                        "error":
                        "شناسه یا وضعیت Task ارسال نشده است."
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

                    send_session_json(
                        self,

                        {
                            "error":
                            "Task یا وضعیت نامعتبر است."
                        },

                        400,

                        session_id
                    )

                    return


                send_session_json(
                    self,

                    {
                        "success":
                            True
                    },

                    session_id=session_id
                )


            except Exception as e:

                send_session_json(
                    self,

                    {
                        "error":
                            str(e)
                    },

                    500,

                    session_id
                )


            return


        # =================================================
        # DELETE
        # =================================================

        if path == "/api/tasks/delete":

            task_id = data.get(
                "task_id"
            )


            if not task_id:

                send_session_json(
                    self,

                    {
                        "error":
                        "شناسه Task ارسال نشده است."
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

                    send_session_json(
                        self,

                        {
                            "error":
                            "Task پیدا نشد."
                        },

                        404,

                        session_id
                    )

                    return


                send_session_json(
                    self,

                    {
                        "success":
                            True
                    },

                    session_id=session_id
                )


            except Exception as e:

                print(
                    "DELETE ERROR:",
                    e
                )


                send_session_json(
                    self,

                    {
                        "error":
                            str(e)
                    },

                    500,

                    session_id
                )


            return


        # =================================================
        # UNKNOWN API
        # =================================================

        send_session_json(
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

if __name__ == "__main__":

    server = HTTPServer(
        (HOST, PORT),
        SmartTaskHandler
    )


    print(
        "================================="
    )

    print(
        "SmartTask3"
    )

    print(
        f"http://{HOST}:{PORT}"
    )

    print(
        "================================="
    )


    try:

        server.serve_forever()


    except KeyboardInterrupt:

        print(
            "\nServer stopped."
        )


    finally:

        server.server_close()