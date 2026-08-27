let allTasks = [];

let options = {
    categories: [],
    priorities: [],
    statuses: []
};

let editingTaskId = null;

let currentUser = {
    username: "مهمان",
    logged_in: false,
    is_guest: true
};

const notifiedReminders = new Set();

let reminderCheckInterval = null;

const $ = id => document.getElementById(id);


/* =========================================================
   GENERAL
========================================================= */

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);


async function initializeApp() {

    setupEvents();

    updateUserUI();

    initializeDatePickers();

    try {

        await loadSession();
        await loadOptions();
        await loadTasks();

    } catch (error) {

        console.error(
            "Initialization error:",
            error
        );
    }

    await requestNotificationPermission();

    startReminderChecker();
}


/* =========================================================
   SESSION
========================================================= */

async function loadSession() {

    const response =
        await fetch("/api/session");

    if (!response.ok) {

        throw new Error(
            "دریافت اطلاعات کاربر ناموفق بود."
        );
    }

    currentUser =
        await response.json();

    updateUserUI();
}


function updateUserUI() {

    const username =
        currentUser.username || "مهمان";

    if ($("currentUsername")) {

        $("currentUsername").textContent =
            username;
    }

    if ($("welcomeTitle")) {

        $("welcomeTitle").textContent =
            currentUser.is_guest
                ? "سلام 👋"
                : `سلام ${username} 👋`;
    }

    if ($("welcomeText")) {

        $("welcomeText").textContent =
            currentUser.is_guest
                ? "کارهای امروزت رو مدیریت کن و چیزی رو فراموش نکن."
                : `${username}، کارهات رو مدیریت کن و چیزی رو فراموش نکن.`;
    }

    $("loginButton")?.classList.toggle(
        "hidden",
        !currentUser.is_guest
    );

    $("logoutButton")?.classList.toggle(
        "hidden",
        currentUser.is_guest
    );
}


/* =========================================================
   OPTIONS
========================================================= */

async function loadOptions() {

    const response =
        await fetch("/api/options");

    if (!response.ok) {

        throw new Error(
            "دریافت تنظیمات ناموفق بود."
        );
    }

    options =
        await response.json();

    fillSelect(
        $("categoryFilter"),
        options.categories,
        "همه دسته‌بندی‌ها"
    );

    fillSelect(
        $("priorityFilter"),
        options.priorities,
        "همه اولویت‌ها"
    );

    fillSelect(
        $("priority"),
        options.priorities
    );
}


function fillSelect(
    select,
    values,
    defaultText = null
) {

    if (!select) return;

    select.innerHTML = "";

    if (defaultText !== null) {

        const option =
            document.createElement("option");

        option.value = "";

        option.textContent =
            defaultText;

        select.appendChild(option);
    }

    (values || []).forEach(value => {

        const option =
            document.createElement("option");

        option.value = value;

        option.textContent = value;

        select.appendChild(option);
    });
}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

    $("openTaskModal")
        ?.addEventListener(
            "click",
            openCreateModal
        );

    $("closeTaskModal")
        ?.addEventListener(
            "click",
            closeTaskModal
        );

    $("cancelTask")
        ?.addEventListener(
            "click",
            closeTaskModal
        );

    $("taskForm")
        ?.addEventListener(
            "submit",
            handleTaskSubmit
        );

    $("predictCategory")
        ?.addEventListener(
            "click",
            predictCategory
        );


    [
        "taskSearch",
        "categoryFilter",
        "priorityFilter",
        "statusFilter",
        "dueDateFilter"
    ].forEach(id => {

        $(id)?.addEventListener(
            id === "taskSearch"
                ? "input"
                : "change",
            applyFilters
        );
    });


    $("loginButton")
        ?.addEventListener(
            "click",
            openAuthModal
        );

    $("closeAuthModal")
        ?.addEventListener(
            "click",
            closeAuthModal
        );

    $("loginTab")
        ?.addEventListener(
            "click",
            () => showAuthTab("login")
        );

    $("registerTab")
        ?.addEventListener(
            "click",
            () => showAuthTab("register")
        );

    $("loginForm")
        ?.addEventListener(
            "submit",
            loginUser
        );

    $("registerForm")
        ?.addEventListener(
            "submit",
            registerUser
        );

    $("guestButton")
        ?.addEventListener(
            "click",
            continueAsGuest
        );

    $("guestButtonRegister")
        ?.addEventListener(
            "click",
            continueAsGuest
        );

    $("logoutButton")
        ?.addEventListener(
            "click",
            logoutUser
        );


    $("taskModal")
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    $("taskModal")
                ) {
                    closeTaskModal();
                }
            }
        );


    $("authModal")
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    $("authModal")
                ) {
                    closeAuthModal();
                }
            }
        );


    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {

                closeTaskModal();
                closeAuthModal();
                closeDatePickers();
            }
        }
    );
}


/* =========================================================
   AUTH
========================================================= */

function openAuthModal() {

    const modal =
        $("authModal");

    if (!modal) return;

    showAuthTab("login");

    clearAuthMessages();

    modal.classList.add("active");

    modal.style.display = "flex";

    setTimeout(
        () => $("loginUsername")?.focus(),
        100
    );
}


function closeAuthModal() {

    const modal =
        $("authModal");

    if (!modal) return;

    modal.classList.remove("active");

    modal.style.display = "none";

    clearAuthMessages();

    $("loginForm")?.reset();

    $("registerForm")?.reset();
}


function showAuthTab(tab) {

    const login =
        tab === "login";

    $("loginTab")?.classList.toggle(
        "active",
        login
    );

    $("registerTab")?.classList.toggle(
        "active",
        !login
    );

    $("loginForm")?.classList.toggle(
        "hidden",
        !login
    );

    $("registerForm")?.classList.toggle(
        "hidden",
        login
    );

    if ($("authTitle")) {

        $("authTitle").textContent =
            login
                ? "ورود به حساب"
                : "ساخت حساب جدید";
    }

    clearAuthMessages();
}


function clearAuthMessages() {

    [
        "loginMessage",
        "registerMessage"
    ].forEach(id => {

        const element = $(id);

        if (!element) return;

        element.textContent = "";

        element.className =
            "auth-message";
    });
}


function showAuthMessage(
    elementId,
    message,
    type = "error"
) {

    const element =
        $(elementId);

    if (!element) return;

    element.textContent =
        message;

    element.className =
        `auth-message ${type}`;
}


/* =========================================================
   LOGIN
========================================================= */

async function loginUser(event) {

    event.preventDefault();

    const username =
        $("loginUsername")?.value.trim();

    const password =
        $("loginPassword")?.value || "";

    if (!username || !password) {

        showAuthMessage(
            "loginMessage",
            "نام کاربری و رمز عبور را وارد کن."
        );

        return;
    }

    try {

        const response =
            await fetch(
                "/api/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify({
                            username,
                            password
                        })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "ورود انجام نشد."
            );
        }

        currentUser = {
            username: data.username,
            logged_in: true,
            is_guest: false
        };

        updateUserUI();

        closeAuthModal();

        resetFilters();

        await loadTasks();

        alert(
            `سلام ${data.username} 👋 خوش اومدی`
        );

    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        showAuthMessage(
            "loginMessage",
            error.message
        );
    }
}


/* =========================================================
   REGISTER
========================================================= */

async function registerUser(event) {

    event.preventDefault();

    const username =
        $("registerUsername")?.value.trim();

    const password =
        $("registerPassword")?.value || "";

    const repeatPassword =
        $("registerPasswordRepeat")?.value || "";

    if (!username || !password) {

        showAuthMessage(
            "registerMessage",
            "نام کاربری و رمز عبور را وارد کن."
        );

        return;
    }

    if (password !== repeatPassword) {

        showAuthMessage(
            "registerMessage",
            "تکرار رمز عبور با رمز اصلی یکسان نیست."
        );

        return;
    }

    try {

        const response =
            await fetch(
                "/api/register",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify({
                            username,
                            password
                        })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "ثبت‌نام انجام نشد."
            );
        }

        currentUser = {
            username: data.username,
            logged_in: true,
            is_guest: false
        };

        updateUserUI();

        closeAuthModal();

        resetFilters();

        await loadTasks();

        alert(
            `حساب ${data.username} ساخته شد 👋 خوش اومدی`
        );

    } catch (error) {

        console.error(
            "Register error:",
            error
        );

        showAuthMessage(
            "registerMessage",
            error.message
        );
    }
}


/* =========================================================
   GUEST
========================================================= */

async function continueAsGuest() {

    try {

        const response =
            await fetch(
                "/api/guest",
                {
                    method: "POST"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "ورود به حالت مهمان انجام نشد."
            );
        }

        currentUser = {
            username: "مهمان",
            logged_in: false,
            is_guest: true
        };

        updateUserUI();

        closeAuthModal();

        resetFilters();

        await loadTasks();

    } catch (error) {

        alert(
            "خطا: " + error.message
        );
    }
}


/* =========================================================
   LOGOUT
========================================================= */

async function logoutUser() {

    if (
        !confirm(
            "آیا می‌خواهی از حساب خارج شوی؟"
        )
    ) {
        return;
    }

    try {

        const response =
            await fetch(
                "/api/logout",
                {
                    method: "POST"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "خروج انجام نشد."
            );
        }

        currentUser = {
            username: "مهمان",
            logged_in: false,
            is_guest: true
        };

        updateUserUI();

        resetFilters();

        await loadTasks();

        alert(
            "از حساب خارج شدی و اکنون به‌عنوان مهمان هستی"
        );

    } catch (error) {

        alert(
            "خطا: " + error.message
        );
    }
}


/* =========================================================
   TASK MODAL
========================================================= */

function openCreateModal() {

    editingTaskId = null;

    resetTaskForm();

    setModalMode(false);

    const modal =
        $("taskModal");

    if (!modal) return;

    modal.classList.add("active");

    modal.style.display = "flex";

    setTimeout(
        () => $("title")?.focus(),
        100
    );
}


function openEditModal(taskId) {

    const task =
        allTasks.find(
            item =>
                Number(item.id) ===
                Number(taskId)
        );

    if (!task) {

        alert(
            "کار مورد نظر پیدا نشد."
        );

        return;
    }

    editingTaskId =
        Number(task.id);

    setModalMode(true);

    $("title").value =
        task.title || "";

    $("description").value =
        task.description || "";

    $("priority").value =
        task.priority || "معمولی";


    if (task.due_date) {

        setPersianDateInput(
            "dueDate",
            "dueDateValue",
            task.due_date
        );

    } else {

        clearPersianDateInput(
            "dueDate",
            "dueDateValue"
        );
    }


    if (task.reminder_at) {

        const reminder =
            parseReminderDateParts(
                task.reminder_at
            );

        if (reminder) {

            setPersianDateInput(
                "reminderDate",
                "reminderDateValue",
                reminder.date
            );

            $("reminderTime").value =
                reminder.time;
        }

    } else {

        clearPersianDateInput(
            "reminderDate",
            "reminderDateValue"
        );

        $("reminderTime").value =
            "";
    }


    const result =
        $("categoryResult");

    if (result) {

        result.dataset.category =
            task.category || "";

        result.textContent =
            task.category
                ? `دسته‌بندی فعلی: ${task.category}`
                : "";

        result.classList.toggle(
            "hidden",
            !task.category
        );
    }


    const modal =
        $("taskModal");

    if (!modal) return;

    modal.classList.add("active");

    modal.style.display = "flex";

    setTimeout(
        () => $("title")?.focus(),
        100
    );
}


function setModalMode(isEdit) {

    const modal =
        $("taskModal");

    if (!modal) return;

    const title =
        modal.querySelector(
            ".modal-header h2"
        );

    const submit =
        modal.querySelector(
            ".submit-button"
        );

    if (isEdit) {

        if (title) {
            title.textContent =
                "ویرایش کار";
        }

        if (submit) {
            submit.textContent =
                "ذخیره تغییرات";
        }

        return;
    }

    if (title) {
        title.textContent =
            "افزودن کار";
    }

    if (submit) {
        submit.textContent =
            "ثبت کار";
    }
}


function closeTaskModal() {

    const modal =
        $("taskModal");

    if (!modal) return;

    modal.classList.remove("active");

    modal.style.display = "none";

    editingTaskId = null;

    resetTaskForm();

    setModalMode(false);

    closeDatePickers();
}


function resetTaskForm() {

    $("taskForm")?.reset();

    clearPersianDateInput(
        "dueDate",
        "dueDateValue"
    );

    clearPersianDateInput(
        "reminderDate",
        "reminderDateValue"
    );

    $("reminderTime").value = "";

    const result =
        $("categoryResult");

    if (!result) return;

    result.textContent = "";

    result.classList.add("hidden");

    delete result.dataset.category;
}


/* =========================================================
   LOAD & RENDER TASKS
========================================================= */

async function loadTasks() {

    const response =
        await fetch("/api/tasks");

    if (!response.ok) {

        throw new Error(
            "دریافت کارها ناموفق بود."
        );
    }

    allTasks =
        await response.json();

    renderTasks(allTasks);

    updateDashboard(allTasks);

    renderReminders(allTasks);
}


function renderTasks(tasks) {

    const list =
        $("taskList");

    if (!list) return;

    if (!tasks.length) {

        list.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    📋
                </div>

                <h3>
                    هنوز کاری وارد نکردی
                </h3>

                <p>
                    برای ایجاد یک برنامه روی افزودن کار جدید بزن.
                </p>

            </div>
        `;

        return;
    }

    list.innerHTML = "";

    tasks.forEach(task => {

        const card =
            document.createElement("div");

        card.className =
            "task-card";

        card.innerHTML = `

            <div class="task-content">

                <div class="task-title-row">

                    <h3>
                        ${escapeHtml(task.title)}
                    </h3>

                    <span class="status-badge ${getStatusClass(task.status)}">
                        ${escapeHtml(task.status)}
                    </span>

                </div>


                <p class="task-description">
                    ${escapeHtml(
                        task.description || ""
                    )}
                </p>


                <div class="task-meta">

                    <span>
                        📁 ${escapeHtml(
                            task.category || "عمومی"
                        )}
                    </span>

                    <span>
                        ⚡ ${escapeHtml(
                            task.priority || "معمولی"
                        )}
                    </span>

                    <span>
                        📅 ${
                            task.due_date
                                ? escapeHtml(
                                    formatPersianDate(
                                        task.due_date
                                    )
                                )
                                : "بدون سررسید"
                        }
                    </span>

                    <span>
                        🔔 ${
                            task.reminder_at
                                ? escapeHtml(
                                    formatReminder(
                                        task.reminder_at
                                    )
                                )
                                : "بدون یادآوری"
                        }
                    </span>

                </div>


                <div class="task-actions">

                    <button
                        type="button"
                        class="status-task-button"
                    >
                        تغییر وضعیت
                    </button>

                    <button
                        type="button"
                        class="edit-task-button"
                    >
                        ویرایش
                    </button>

                    <button
                        type="button"
                        class="delete-task-button"
                    >
                        حذف
                    </button>

                </div>

            </div>
        `;


        card
            .querySelector(
                ".status-task-button"
            )
            .addEventListener(
                "click",
                () =>
                    changeTaskStatus(
                        task.id,
                        task.status
                    )
            );


        card
            .querySelector(
                ".edit-task-button"
            )
            .addEventListener(
                "click",
                () =>
                    openEditModal(
                        task.id
                    )
            );


        card
            .querySelector(
                ".delete-task-button"
            )
            .addEventListener(
                "click",
                () =>
                    deleteTask(
                        task.id
                    )
            );


        list.appendChild(card);
    });
}


function getStatusClass(status) {

    if (status === "انجام شده") {
        return "status-completed";
    }

    if (status === "در حال انجام") {
        return "status-progress";
    }

    return "status-pending";
}


/* =========================================================
   DASHBOARD
========================================================= */

function updateDashboard(tasks) {

    if ($("totalTasks")) {

        $("totalTasks").textContent =
            tasks.length;
    }

    if ($("inProgressTasks")) {

        $("inProgressTasks").textContent =
            tasks.filter(
                task =>
                    task.status ===
                    "در حال انجام"
            ).length;
    }

    if ($("completedTasks")) {

        $("completedTasks").textContent =
            tasks.filter(
                task =>
                    task.status ===
                    "انجام شده"
            ).length;
    }

    if ($("reminderTasks")) {

        $("reminderTasks").textContent =
            getUpcomingReminders(
                tasks
            ).length;
    }
}


/* =========================================================
   CREATE / UPDATE
========================================================= */

async function handleTaskSubmit(event) {

    event.preventDefault();

    const title =
        $("title")?.value.trim();

    if (!title) {

        alert(
            "عنوان رو وارد کن."
        );

        return;
    }


    const result =
        $("categoryResult");

    let category =
        result?.dataset.category;


    if (editingTaskId !== null) {

        const oldTask =
            allTasks.find(
                task =>
                    Number(task.id) ===
                    Number(editingTaskId)
            );

        category =
            category ||
            oldTask?.category ||
            "تعیین نشده";

        await updateTask(
            editingTaskId,
            category
        );

        return;
    }


    await createTask(
        category || "تعیین نشده"
    );
}


function getTaskFormData(category) {

    const dueDate =
        $("dueDateValue")?.value || null;

    const reminderDate =
        $("reminderDateValue")?.value || "";

    const reminderTime =
        $("reminderTime")?.value || "";


    let reminderAt = null;


    if (
        reminderDate &&
        reminderTime
    ) {

        reminderAt =
            `${reminderDate}T${reminderTime}`;
    }


    return {

        title:
            $("title")?.value.trim() || "",

        description:
            $("description")?.value.trim() || "",

        priority:
            $("priority")?.value ||
            "معمولی",

        category,

        due_date:
            dueDate,

        reminder_at:
            reminderAt
    };
}


async function createTask(category) {

    try {

        const response =
            await fetch(
                "/api/tasks",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            getTaskFormData(
                                category
                            )
                        )
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "ثبت انجام نشد."
            );
        }

        closeTaskModal();

        await loadTasks();

    } catch (error) {

        console.error(
            "Create task error:",
            error
        );

        alert(
            "خطا: " +
            error.message
        );
    }
}


async function updateTask(
    taskId,
    category
) {

    try {

        const data = {

            task_id: taskId,

            ...getTaskFormData(
                category
            )
        };


        const response =
            await fetch(
                "/api/tasks/update",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(data)
                }
            );


        const responseData =
            await response.json();


        if (!response.ok) {

            throw new Error(
                responseData.error ||
                "ویرایش انجام نشد."
            );
        }


        closeTaskModal();

        await loadTasks();

    } catch (error) {

        console.error(
            "Update task error:",
            error
        );

        alert(
            "خطا: " +
            error.message
        );
    }
}


/* =========================================================
   AI
========================================================= */

async function predictCategory() {

    const title =
        $("title")?.value.trim();

    if (!title) {

        showCategoryMessage(
            "ابتدا عنوان را وارد کن."
        );

        return;
    }

    showCategoryMessage(
        "در حال پیش‌بینی..."
    );


    try {

        const response =
            await fetch(
                "/api/predict",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            title
                        })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "پیش‌بینی انجام نشد."
            );
        }


        const result =
            $("categoryResult");


        result.dataset.category =
            data.category;


        result.textContent =
            `دسته‌بندی پیشنهادی: ${data.category}`;


        result.classList.remove(
            "hidden"
        );

    } catch (error) {

        showCategoryMessage(
            "خطا: " +
            error.message
        );
    }
}


function showCategoryMessage(message) {

    const result =
        $("categoryResult");

    if (!result) return;

    result.textContent =
        message;

    result.classList.remove(
        "hidden"
    );
}


/* =========================================================
   STATUS
========================================================= */

async function changeTaskStatus(
    taskId,
    currentStatus
) {

    const currentIndex =
        options.statuses.indexOf(
            currentStatus
        );


    let nextIndex =
        currentIndex + 1;


    if (
        nextIndex >=
        options.statuses.length
    ) {

        nextIndex = 0;
    }


    const nextStatus =
        options.statuses[nextIndex];


    try {

        const response =
            await fetch(
                "/api/tasks/status",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            task_id: taskId,
                            status: nextStatus
                        })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "تغییر وضعیت انجام نشد."
            );
        }


        await loadTasks();

    } catch (error) {

        alert(
            "خطا: " +
            error.message
        );
    }
}


/* =========================================================
   DELETE
========================================================= */

async function deleteTask(taskId) {

    if (
        !confirm(
            "آیا از حذف کردنش مطمئن هستی؟"
        )
    ) {
        return;
    }


    try {

        const response =
            await fetch(
                "/api/tasks/delete",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            task_id: taskId
                        })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "حذف انجام نشد."
            );
        }


        [...notifiedReminders]
            .filter(
                key =>
                    key.startsWith(
                        `${taskId}-`
                    )
            )
            .forEach(
                key =>
                    notifiedReminders.delete(
                        key
                    )
            );


        await loadTasks();

    } catch (error) {

        console.error(
            "Delete error:",
            error
        );

        alert(
            "خطا: " +
            error.message
        );
    }
}


/* =========================================================
   FILTERS
========================================================= */

function applyFilters() {

    const search =
        $("taskSearch")?.value
            .trim()
            .toLowerCase() || "";


    const category =
        $("categoryFilter")?.value || "";


    const priority =
        $("priorityFilter")?.value || "";


    const status =
        $("statusFilter")?.value || "";


    const dueDate =
        $("dueDateFilter")?.value || "";


    const filtered =
        allTasks.filter(task => {

            const text = [

                task.title,
                task.description,
                task.category

            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            if (
                search &&
                !text.includes(search)
            ) {
                return false;
            }


            if (
                category &&
                task.category !== category
            ) {
                return false;
            }


            if (
                priority &&
                task.priority !== priority
            ) {
                return false;
            }


            if (
                status &&
                task.status !== status
            ) {
                return false;
            }


            if (
                dueDate &&
                !checkDueDate(
                    task.due_date,
                    dueDate
                )
            ) {
                return false;
            }


            return true;
        });


    renderTasks(filtered);

    updateDashboard(filtered);

    renderReminders(filtered);
}


function resetFilters() {

    [
        "taskSearch",
        "categoryFilter",
        "priorityFilter",
        "statusFilter",
        "dueDateFilter"
    ].forEach(id => {

        if ($(id)) {
            $(id).value = "";
        }
    });
}


/* =========================================================
   DUE DATE FILTER
========================================================= */

function checkDueDate(
    value,
    filter
) {

    if (!value) {

        return filter === "none";
    }


    const today =
        new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );


    const date =
        parseDatabaseDate(value);


    if (!date) {
        return false;
    }


    if (filter === "today") {

        return (
            date.getTime() ===
            today.getTime()
        );
    }


    if (filter === "upcoming") {

        return date > today;
    }


    return filter !== "none";
}


/* =========================================================
   REMINDERS
========================================================= */

function getUpcomingReminders(tasks) {

    const now =
        new Date();


    const limit =
        new Date(
            now.getTime() +
            24 *
            60 *
            60 *
            1000
        );


    return tasks.filter(task => {

        if (!task.reminder_at) {
            return false;
        }


        if (
            task.status ===
            "انجام شده"
        ) {
            return false;
        }


        const reminder =
            parseReminderDate(
                task.reminder_at
            );


        return (
            reminder &&
            reminder >= now &&
            reminder <= limit
        );
    });
}


function parseReminderDate(value) {

    if (!value) return null;

    const normalized =
        String(value)
            .trim()
            .replace(" ", "T");


    const date =
        new Date(normalized);


    return Number.isNaN(
        date.getTime()
    )
        ? null
        : date;
}


function parseReminderDateParts(value) {

    if (!value) return null;


    const normalized =
        String(value)
            .trim()
            .replace(" ", "T");


    const match =
        normalized.match(
            /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/
        );


    if (!match) {
        return null;
    }


    return {
        date: match[1],
        time: match[2]
    };
}


/* =========================================================
   REMINDER CHECKER
========================================================= */

function startReminderChecker() {

    if (reminderCheckInterval) {

        clearInterval(
            reminderCheckInterval
        );
    }


    checkReminders();


    reminderCheckInterval =
        setInterval(
            checkReminders,
            10000
        );
}


function checkReminders() {

    if (
        !Array.isArray(allTasks) ||
        !allTasks.length
    ) {
        return;
    }


    const now =
        new Date();


    allTasks.forEach(task => {

        if (!task.reminder_at) {
            return;
        }


        if (
            task.status ===
            "انجام شده"
        ) {
            return;
        }


        const reminderDate =
            parseReminderDate(
                task.reminder_at
            );


        if (!reminderDate) {
            return;
        }


        const reminderKey =
            `${task.id}-${task.reminder_at}`;


        if (
            reminderDate <= now &&
            !notifiedReminders.has(
                reminderKey
            )
        ) {

            notifiedReminders.add(
                reminderKey
            );


            showReminderNotification(
                task
            );
        }
    });
}


/* =========================================================
   NOTIFICATIONS
========================================================= */

async function requestNotificationPermission() {

    if (
        !("Notification" in window)
    ) {
        return;
    }


    if (
        Notification.permission ===
        "default"
    ) {

        try {

            await Notification.requestPermission();

        } catch (error) {

            console.error(
                "Notification permission error:",
                error
            );
        }
    }
}


function showReminderNotification(task) {

    const reminderText =
        formatReminder(
            task.reminder_at
        );


    showSiteNotification(
        "🔔 زمان یادآوری رسید",
        `${task.title} — ${reminderText}`
    );


    if (
        "Notification" in window &&
        Notification.permission ===
        "granted"
    ) {

        try {

            new Notification(
                "🔔 یادآوری SmarTask",
                {
                    body:
                        `${task.title}\nزمان انجام این کار رسیده است.`,

                    tag:
                        `smarttask-reminder-${task.id}`,

                    renotify: false
                }
            );

        } catch (error) {

            console.error(
                "Browser notification error:",
                error
            );
        }
    }
}


function showSiteNotification(
    title,
    message
) {

    let container =
        $("notificationContainer");


    if (!container) {

        container =
            document.createElement("div");

        container.id =
            "notificationContainer";


        Object.assign(
            container.style,
            {
                position: "fixed",
                top: "20px",
                right: "20px",
                left: "20px",
                zIndex: "99999",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "10px",
                pointerEvents: "none"
            }
        );


        document.body.appendChild(
            container
        );
    }


    const notification =
        document.createElement("div");


    Object.assign(
        notification.style,
        {
            width: "min(360px, 100%)",
            boxSizing: "border-box",
            background: "#fff",
            color: "#3b2520",
            padding: "16px 18px",
            borderRadius: "14px",
            boxShadow:
                "0 8px 30px rgba(0,0,0,0.18)",
            border:
                "1px solid #e5d5cc",
            cursor: "pointer",
            pointerEvents: "auto",
            direction: "rtl"
        }
    );


    notification.innerHTML = `

        <div style="
            font-weight:700;
            font-size:16px;
        ">
            ${escapeHtml(title)}
        </div>

        <div style="
            margin-top:7px;
            line-height:1.7;
        ">
            ${escapeHtml(message)}
        </div>

        <div style="
            margin-top:10px;
            font-size:12px;
            opacity:.6;
        ">
            برای بستن کلیک کن
        </div>
    `;


    notification.addEventListener(
        "click",
        () => notification.remove()
    );


    container.appendChild(
        notification
    );


    setTimeout(
        () => {

            if (
                notification.parentNode
            ) {
                notification.remove();
            }

        },
        10000
    );
}


/* =========================================================
   REMINDER LIST
========================================================= */

function renderReminders(tasks) {

    const list =
        $("reminderList");

    if (!list) return;


    const reminders =
        getUpcomingReminders(
            tasks
        );


    if (!reminders.length) {

        list.innerHTML = `

            <div class="no-reminders">

                <span>
                    🔕
                </span>

                <p>
                    در ۲۴ ساعت آینده
                    یادآوری فعالی نداری.
                </p>

            </div>
        `;

        return;
    }


    list.innerHTML = "";


    reminders
        .sort(
            (a, b) =>
                parseReminderDate(
                    a.reminder_at
                ) -
                parseReminderDate(
                    b.reminder_at
                )
        )
        .forEach(task => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "reminder-card";


            item.innerHTML = `

                <div class="reminder-icon">
                    🔔
                </div>

                <div class="reminder-info">

                    <strong>
                        ${escapeHtml(
                            task.title
                        )}
                    </strong>

                    <span>
                        ${escapeHtml(
                            formatReminder(
                                task.reminder_at
                            )
                        )}
                    </span>

                </div>
            `;


            list.appendChild(
                item
            );
        });
}


/* =========================================================
   PERSIAN DATE CONVERSION
   بدون کتابخانه
========================================================= */

function gregorianToJalali(
    gy,
    gm,
    gd
) {

    const gDaysInMonth = [
        31,
        28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31
    ];


    const jDaysInMonth = [
        31,
        31,
        31,
        31,
        31,
        31,
        30,
        30,
        30,
        30,
        30,
        29
    ];


    let gy2 =
        gy - 1600;

    let gm2 =
        gm - 1;

    let gd2 =
        gd - 1;


    let gDayNo =
        365 * gy2 +
        Math.floor(
            (gy2 + 3) / 4
        ) -
        Math.floor(
            (gy2 + 99) / 100
        ) +
        Math.floor(
            (gy2 + 399) / 400
        );


    for (
        let i = 0;
        i < gm2;
        i++
    ) {

        gDayNo +=
            gDaysInMonth[i];
    }


    if (
        gm2 > 1 &&
        (
            gy % 4 === 0 &&
            gy % 100 !== 0
            ||
            gy % 400 === 0
        )
    ) {

        gDayNo++;
    }


    gDayNo += gd2;


    let jDayNo =
        gDayNo - 79;


    const jNp =
        Math.floor(
            jDayNo / 12053
        );


    jDayNo %=
        12053;


    let jy =
        979 +
        33 * jNp +
        4 *
        Math.floor(
            jDayNo / 1461
        );


    jDayNo %=
        1461;


    if (
        jDayNo >= 366
    ) {

        jy +=
            Math.floor(
                (jDayNo - 1) / 365
            );

        jDayNo =
            (jDayNo - 1) % 365;
    }


    let jm = 0;

    for (
        ;
        jm < 11 &&
        jDayNo >=
            jDaysInMonth[jm];
        jm++
    ) {

        jDayNo -=
            jDaysInMonth[jm];
    }


    const jd =
        jDayNo + 1;


    return {
        year: jy,
        month: jm + 1,
        day: jd
    };
}


function jalaliToGregorian(
    jy,
    jm,
    jd
) {

    const jDaysInMonth = [
        31,
        31,
        31,
        31,
        31,
        31,
        30,
        30,
        30,
        30,
        30,
        29
    ];


    let gy =
        jy + 621;


    let days = 0;


    for (
        let year = 1;
        year < jy;
        year++
    ) {

        days +=
            isJalaliLeap(year)
                ? 366
                : 365;
    }


    for (
        let month = 1;
        month < jm;
        month++
    ) {

        days +=
            jDaysInMonth[month - 1];
    }


    days += jd - 1;


    const base =
        jalaliEpochToGregorian(
            jy
        );


    const date =
        new Date(
            base.year,
            base.month - 1,
            base.day
        );


    date.setDate(
        date.getDate() +
        days -
        jalaliDaysBeforeYear(
            jy
        )
    );


    return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate()
    };
}


function isJalaliLeap(year) {

    const breaks = [
        -61, 9, 38, 199, 426, 686,
        756, 818, 1111, 1181, 1210,
        1635, 2060, 2097, 2192, 2262,
        2347, 2380, 2380, 2400, 2500,
        3000
    ];

    let leap =
        0;

    let jp =
        breaks[0];

    let jump =
        0;


    for (
        let i = 1;
        i < breaks.length;
        i++
    ) {

        jump =
            breaks[i] - jp;

        if (
            year < breaks[i]
        ) {
            break;
        }

        leap +=
            jump;

        jp =
            breaks[i];
    }


    let n =
        year - jp;


    return (
        (
            n % 33
        ) === 1 ||
        (
            n % 33
        ) === 5 ||
        (
            n % 33
        ) === 9 ||
        (
            n % 33
        ) === 13 ||
        (
            n % 33
        ) === 17 ||
        (
            n % 33
        ) === 22 ||
        (
            n % 33
        ) === 26 ||
        (
            n % 33
        ) === 30
    );
}


/*
 * تبدیل دقیق‌تر با الگوریتم استاندارد جلالی
 */

function jalaliToGregorianExact(
    jy,
    jm,
    jd
) {

    jy -= 979;

    let gy =
        1600;

    let days =
        365 * jy +
        Math.floor(
            jy / 33
        ) * 8 +
        Math.floor(
            (
                jy % 33 + 3
            ) / 4
        );


    if (jm <= 6) {

        days +=
            (jm - 1) * 31;

    } else {

        days +=
            (jm - 7) * 30 +
            186;
    }


    days +=
        jd - 1;


    gy +=
        400 *
        Math.floor(
            days / 146097
        );


    days %=
        146097;


    if (days >= 36525) {

        days--;

        gy +=
            100 *
            Math.floor(
                days / 36524
            );

        days %=
            36524;

        if (days >= 365) {
            days++;
        }
    }


    gy +=
        4 *
        Math.floor(
            days / 1461
        );


    days %=
        1461;


    if (days >= 366) {

        gy +=
            Math.floor(
                (
                    days - 1
                ) / 365
            );

        days =
            (
                days - 1
            ) % 365;
    }


    let gd =
        days + 1;


    const leap =
        (
            gy % 4 === 0 &&
            gy % 100 !== 0
        ) ||
        gy % 400 === 0;


    const gDays = [
        31,
        leap ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31
    ];


    let gm = 1;


    while (
        gd >
        gDays[gm - 1]
    ) {

        gd -=
            gDays[gm - 1];

        gm++;
    }


    return {
        year: gy,
        month: gm,
        day: gd
    };
}


function jalaliDaysBeforeYear(
    year
) {

    return 0;
}


function jalaliEpochToGregorian(
    year
) {

    return {
        year: year + 621,
        month: 3,
        day: 21
    };
}


/* =========================================================
   DATE HELPERS
========================================================= */

function pad2(value) {

    return String(value)
        .padStart(2, "0");
}


function toPersianDigits(value) {

    return String(value)
        .replace(
            /\d/g,
            digit =>
                "۰۱۲۳۴۵۶۷۸۹"[
                    Number(digit)
                ]
        );
}


function toEnglishDigits(value) {

    return String(value)
        .replace(
            /[۰-۹]/g,
            digit =>
                "۰۱۲۳۴۵۶۷۸۹".indexOf(
                    digit
                )
        );
}


function parseDatabaseDate(
    value
) {

    if (!value) {
        return null;
    }


    const match =
        String(value).match(
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/
        );


    if (!match) {
        return null;
    }


    const year =
        Number(match[1]);

    const month =
        Number(match[2]);

    const day =
        Number(match[3]);


    const date =
        new Date(
            year,
            month - 1,
            day
        );


    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }


    date.setHours(
        0,
        0,
        0,
        0
    );


    return date;
}


function formatPersianDate(
    value
) {

    const date =
        parseDatabaseDate(
            value
        );


    if (!date) {
        return value || "";
    }


    const jalali =
        gregorianToJalali(
            date.getFullYear(),
            date.getMonth() + 1,
            date.getDate()
        );


    return toPersianDigits(
        `${jalali.year}/${pad2(jalali.month)}/${pad2(jalali.day)}`
    );
}


function formatReminder(
    value
) {

    if (!value) {
        return "بدون یادآوری";
    }


    const parts =
        parseReminderDateParts(
            value
        );


    if (!parts) {
        return value;
    }


    return (
        formatPersianDate(
            parts.date
        ) +
        " - " +
        toPersianDigits(
            parts.time
        )
    );
}


/* =========================================================
   PERSIAN DATE PICKER
========================================================= */

let datePickerState = {
    target: null,
    valueTarget: null,
    year: null,
    month: null
};


function initializeDatePickers() {

    $("openDueDatePicker")
        ?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                openPersianDatePicker(
                    "dueDatePicker",
                    "dueDate",
                    "dueDateValue"
                );
            }
        );


    $("openReminderDatePicker")
        ?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                openPersianDatePicker(
                    "reminderDatePicker",
                    "reminderDate",
                    "reminderDateValue"
                );
            }
        );


    $("dueDate")
        ?.addEventListener(
            "click",
            () =>
                openPersianDatePicker(
                    "dueDatePicker",
                    "dueDate",
                    "dueDateValue"
                )
        );


    $("reminderDate")
        ?.addEventListener(
            "click",
            () =>
                openPersianDatePicker(
                    "reminderDatePicker",
                    "reminderDate",
                    "reminderDateValue"
                )
        );


    document.addEventListener(
        "click",
        event => {

            const picker1 =
                $("dueDatePicker");

            const picker2 =
                $("reminderDatePicker");


            if (
                picker1 &&
                !picker1.contains(event.target) &&
                event.target !== $("dueDate") &&
                event.target !== $("openDueDatePicker")
            ) {

                picker1.classList.add(
                    "hidden"
                );
            }


            if (
                picker2 &&
                !picker2.contains(event.target) &&
                event.target !== $("reminderDate") &&
                event.target !== $("openReminderDatePicker")
            ) {

                picker2.classList.add(
                    "hidden"
                );
            }
        }
    );
}


function openPersianDatePicker(
    pickerId,
    inputId,
    valueId
) {

    const picker =
        $(pickerId);

    if (!picker) return;


    closeDatePickers();


    let year;
    let month;


    const existing =
        $(valueId)?.value;


    if (existing) {

        const date =
            parseDatabaseDate(
                existing
            );


        if (date) {

            const jalali =
                gregorianToJalali(
                    date.getFullYear(),
                    date.getMonth() + 1,
                    date.getDate()
                );


            year =
                jalali.year;

            month =
                jalali.month;
        }
    }


    if (
        !year ||
        !month
    ) {

        const today =
            new Date();


        const jalali =
            gregorianToJalali(
                today.getFullYear(),
                today.getMonth() + 1,
                today.getDate()
            );


        year =
            jalali.year;

        month =
            jalali.month;
    }


    datePickerState = {
        target: inputId,
        valueTarget: valueId,
        year,
        month
    };


    renderPersianCalendar(
        picker,
        year,
        month
    );


    picker.classList.remove(
        "hidden"
    );
}


function closeDatePickers() {

    $("dueDatePicker")
        ?.classList.add("hidden");

    $("reminderDatePicker")
        ?.classList.add("hidden");
}


function renderPersianCalendar(
    picker,
    year,
    month
) {

    const monthNames = [
        "فروردین",
        "اردیبهشت",
        "خرداد",
        "تیر",
        "مرداد",
        "شهریور",
        "مهر",
        "آبان",
        "آذر",
        "دی",
        "بهمن",
        "اسفند"
    ];


    const firstGregorian =
        jalaliToGregorianExact(
            year,
            month,
            1
        );


    const firstDate =
        new Date(
            firstGregorian.year,
            firstGregorian.month - 1,
            firstGregorian.day
        );


    const firstWeekDay =
        (
            firstDate.getDay() + 1
        ) % 7;


    const daysInMonth =
        month <= 6
            ? 31
            : month <= 11
                ? 30
                : (
                    isJalaliLeap(year)
                        ? 30
                        : 29
                );


    let html = `

        <div class="persian-calendar">

            <div class="persian-calendar-header">

                <button
                    type="button"
                    data-calendar-prev
                >
                    ‹
                </button>

                <strong>
                    ${monthNames[month - 1]}
                    ${toPersianDigits(year)}
                </strong>

                <button
                    type="button"
                    data-calendar-next
                >
                    ›
                </button>

            </div>


            <div class="persian-calendar-weekdays">

                <span>شنبه</span>
                <span>یکشنبه</span>
                <span>دوشنبه</span>
                <span>سه‌شنبه</span>
                <span>چهارشنبه</span>
                <span>پنجشنبه</span>
                <span>جمعه</span>

            </div>


            <div class="persian-calendar-days">
    `;


    for (
        let i = 0;
        i < firstWeekDay;
        i++
    ) {

        html += `
            <span class="calendar-empty"></span>
        `;
    }


    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        html += `

            <button
                type="button"
                class="calendar-day"
                data-calendar-day="${day}"
            >
                ${toPersianDigits(day)}
            </button>
        `;
    }


    html += `

            </div>

            <button
                type="button"
                class="calendar-today"
                data-calendar-today
            >
                امروز
            </button>

        </div>
    `;


    picker.innerHTML =
        html;


    picker
        .querySelector(
            "[data-calendar-prev]"
        )
        ?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                let newYear =
                    year;

                let newMonth =
                    month - 1;


                if (newMonth < 1) {

                    newMonth = 12;

                    newYear--;
                }


                datePickerState.year =
                    newYear;

                datePickerState.month =
                    newMonth;


                renderPersianCalendar(
                    picker,
                    newYear,
                    newMonth
                );
            }
        );


    picker
        .querySelector(
            "[data-calendar-next]"
        )
        ?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                let newYear =
                    year;

                let newMonth =
                    month + 1;


                if (newMonth > 12) {

                    newMonth = 1;

                    newYear++;
                }


                datePickerState.year =
                    newYear;

                datePickerState.month =
                    newMonth;


                renderPersianCalendar(
                    picker,
                    newYear,
                    newMonth
                );
            }
        );


    picker
        .querySelectorAll(
            "[data-calendar-day]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    const day =
                        Number(
                            button.dataset.calendarDay
                        );


                    selectPersianDate(
                        year,
                        month,
                        day
                    );
                }
            );
        });


    picker
        .querySelector(
            "[data-calendar-today]"
        )
        ?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                const today =
                    new Date();


                const jalali =
                    gregorianToJalali(
                        today.getFullYear(),
                        today.getMonth() + 1,
                        today.getDate()
                    );


                selectPersianDate(
                    jalali.year,
                    jalali.month,
                    jalali.day
                );
            }
        );
}


function selectPersianDate(
    year,
    month,
    day
) {

    const gregorian =
        jalaliToGregorianExact(
            year,
            month,
            day
        );


    const databaseValue =
        `${gregorian.year}-${pad2(gregorian.month)}-${pad2(gregorian.day)}`;


    const displayValue =
        toPersianDigits(
            `${year}/${pad2(month)}/${pad2(day)}`
        );


    if (
        datePickerState.target
    ) {

        $(datePickerState.target).value =
            displayValue;
    }


    if (
        datePickerState.valueTarget
    ) {

        $(datePickerState.valueTarget).value =
            databaseValue;
    }


    closeDatePickers();
}


function setPersianDateInput(
    inputId,
    valueId,
    databaseDate
) {

    const date =
        parseDatabaseDate(
            databaseDate
        );


    if (!date) {

        clearPersianDateInput(
            inputId,
            valueId
        );

        return;
    }


    const jalali =
        gregorianToJalali(
            date.getFullYear(),
            date.getMonth() + 1,
            date.getDate()
        );


    $(inputId).value =
        toPersianDigits(
            `${jalali.year}/${pad2(jalali.month)}/${pad2(jalali.day)}`
        );


    $(valueId).value =
        databaseDate;
}


function clearPersianDateInput(
    inputId,
    valueId
) {

    if ($(inputId)) {
        $(inputId).value = "";
    }

    if ($(valueId)) {
        $(valueId).value = "";
    }
}


/* =========================================================
   REMINDER INPUT
========================================================= */

function getReminderValue() {

    const date =
        $("reminderDateValue")?.value ||
        "";

    const time =
        $("reminderTime")?.value ||
        "";


    if (!date || !time) {
        return null;
    }


    return `${date}T${time}`;
}


/* =========================================================
   FINAL DATE DISPLAY
========================================================= */

function convertReminderForInput(
    value
) {

    const parts =
        parseReminderDateParts(
            value
        );


    if (!parts) {

        return {
            date: "",
            time: ""
        };
    }


    return parts;
}