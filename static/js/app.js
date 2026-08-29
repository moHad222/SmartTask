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


// =========================
// HELPERS
// =========================

const $ = id => document.getElementById(id);

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// =========================
// START
// =========================

document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);

async function initializeApp() {

    setupEvents();
    updateUserUI();

    try {

        await loadSession();

    } catch (error) {

        console.error(
            "Session error:",
            error
        );
    }

    try {

        await loadOptions();

    } catch (error) {

        console.error(
            "Options error:",
            error
        );
    }

    try {

        await loadTasks();

    } catch (error) {

        console.error(
            "Tasks error:",
            error
        );
    }

    // =========================
    // NOTIFICATIONS
    // =========================
    // Permission در اینجا درخواست نمی‌شود.
    // مرورگرها درخواست Notification را بهتر است
    // در نتیجه تعامل مستقیم کاربر دریافت کنند.

    startReminderChecker();
}


// =========================
// SESSION
// =========================

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


// =========================
// OPTIONS
// =========================

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
        option.textContent = defaultText;

        select.appendChild(option);
    }

    values.forEach(value => {

        const option =
            document.createElement("option");

        option.value = value;
        option.textContent = value;

        select.appendChild(option);
    });
}


// =========================
// EVENTS
// =========================

function setupEvents() {

    $("openTaskModal")?.addEventListener(
        "click",
        openCreateModal
    );

    $("closeTaskModal")?.addEventListener(
        "click",
        closeTaskModal
    );

    $("cancelTask")?.addEventListener(
        "click",
        closeTaskModal
    );

    $("taskForm")?.addEventListener(
        "submit",
        handleTaskSubmit
    );

    $("predictCategory")?.addEventListener(
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


    // =========================
    // AUTH
    // =========================

    $("loginButton")?.addEventListener(
        "click",
        openAuthModal
    );

    $("closeAuthModal")?.addEventListener(
        "click",
        closeAuthModal
    );

    $("loginTab")?.addEventListener(
        "click",
        () => showAuthTab("login")
    );

    $("registerTab")?.addEventListener(
        "click",
        () => showAuthTab("register")
    );

    $("loginForm")?.addEventListener(
        "submit",
        loginUser
    );

    $("registerForm")?.addEventListener(
        "submit",
        registerUser
    );

    $("guestButton")?.addEventListener(
        "click",
        continueAsGuest
    );

    $("guestButtonRegister")?.addEventListener(
        "click",
        continueAsGuest
    );

    $("logoutButton")?.addEventListener(
        "click",
        logoutUser
    );


    // =========================
    // MODAL BACKDROP
    // =========================

    $("taskModal")?.addEventListener(
        "click",
        event => {

            if (
                event.target === $("taskModal")
            ) {
                closeTaskModal();
            }

        }
    );

    $("authModal")?.addEventListener(
        "click",
        event => {

            if (
                event.target === $("authModal")
            ) {
                closeAuthModal();
            }

        }
    );


    // =========================
    // ESCAPE
    // =========================

    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {

                closeTaskModal();
                closeAuthModal();
            }

        }
    );
}


// =========================
// AUTH MODAL
// =========================

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

        const element =
            $(id);

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


// =========================
// LOGIN
// =========================

async function loginUser(event) {

    event.preventDefault();

    const username =
        $("loginUsername")
            ?.value
            .trim();

    const password =
        $("loginPassword")
            ?.value || "";

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

                    body: JSON.stringify({
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


// =========================
// REGISTER
// =========================

async function registerUser(event) {

    event.preventDefault();

    const username =
        $("registerUsername")
            ?.value
            .trim();

    const password =
        $("registerPassword")
            ?.value || "";

    const repeatPassword =
        $("registerPasswordRepeat")
            ?.value || "";

    if (!username || !password) {

        showAuthMessage(
            "registerMessage",
            "نام کاربری و رمز عبور را وارد کن."
        );

        return;
    }

    if (
        password !== repeatPassword
    ) {

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

                    body: JSON.stringify({
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


// =========================
// GUEST
// =========================

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
            "خطا: " +
            error.message
        );
    }
}


// =========================
// LOGOUT
// =========================

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
            "از حساب خارج شدی و اکنون به‌عنوان مهمان هستی."
        );

    } catch (error) {

        alert(
            "خطا: " +
            error.message
        );
    }
}


// =========================
// TASK MODAL
// =========================

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

        alert("کار پیدا نشد.");

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

    $("dueDate").value =
        task.due_date || "";

    $("reminderAt").value =
        convertReminderForInput(
            task.reminder_at
        );

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

    } else {

        if (title) {
            title.textContent =
                "افزودن کار جدید";
        }

        if (submit) {
            submit.textContent =
                "ثبت کار";
        }
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
}

function resetTaskForm() {

    $("taskForm")?.reset();

    const result =
        $("categoryResult");

    if (!result) return;

    result.textContent = "";

    result.classList.add(
        "hidden"
    );

    delete result.dataset.category;
}


// =========================
// LOAD TASKS
// =========================

async function loadTasks() {

    const response =
        await fetch("/api/tasks");

    let data = null;

    try {

        data = await response.json();

    } catch (error) {

        throw new Error(
            `سرور پاسخ JSON معتبر برنگرداند. کد خطا: ${response.status}`
        );
    }

    if (!response.ok) {

        throw new Error(
            data?.error ||
            `دریافت کارها ناموفق بود. کد خطا: ${response.status}`
        );
    }

    if (!Array.isArray(data)) {

        throw new Error(
            "پاسخ سرور برای کارها معتبر نیست."
        );
    }

    allTasks = data;

    renderTasks(allTasks);

    updateDashboard(allTasks);

    renderReminders(allTasks);

    checkRemindersNow();
}


// =========================
// RENDER TASKS
// =========================

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
                    هنوز کاری نداری
                </h3>

                <p>
                    برای ایجاد یک کار جدید
                    روی «افزودن کار» بزن.
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

        card.dataset.taskId =
            task.id;

        card.innerHTML = `
            <div class="task-content">

                <div class="task-title-row">

                    <h3>
                        ${escapeHtml(task.title)}
                    </h3>

                    <span
                        class="status-badge ${getStatusClass(task.status)}"
                    >
                        ${escapeHtml(task.status)}
                    </span>

                </div>

                <p class="task-description">
                    ${escapeHtml(task.description || "")}
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
                                    task.due_date
                                )
                                : "بدون سررسید"
                        }
                    </span>

                    <span>
                        🔔 ${
                            task.reminder_at
                                ? formatReminder(
                                    task.reminder_at
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

    if (
        status === "انجام شده"
    ) {
        return "status-completed";
    }

    if (
        status === "در حال انجام"
    ) {
        return "status-progress";
    }

    return "status-pending";
}


// =========================
// DASHBOARD
// =========================

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


// =========================
// FORM
// =========================

async function handleTaskSubmit(event) {

    event.preventDefault();

    const title =
        $("title")
            ?.value
            .trim();

    if (!title) {

        alert(
            "عنوان کار را وارد کن."
        );

        return;
    }

    const result =
        $("categoryResult");

    let category =
        result?.dataset.category;

    if (
        editingTaskId !== null
    ) {

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

    } else {

        category =
            category ||
            "تعیین نشده";
    }


    // =========================
    // NOTIFICATION PERMISSION
    // =========================

    const reminderValue =
        $("reminderAt")
            ?.value
            ?.trim() || "";

    if (reminderValue) {

        await requestNotificationPermission();
    }


    if (
        editingTaskId !== null
    ) {

        await updateTask(
            editingTaskId,
            category
        );

        return;
    }

    await createTask(
        category
    );
}


// =========================
// CREATE
// =========================

function getTaskFormData(
    category
) {

    return {

        title:
            $("title")
                ?.value
                .trim() || "",

        description:
            $("description")
                ?.value
                .trim() || "",

        priority:
            $("priority")
                ?.value ||
            "معمولی",

        category,

        due_date:
            $("dueDate")
                ?.value ||
            null,

        reminder_at:
            $("reminderAt")
                ?.value ||
            null
    };
}

async function createTask(
    category
) {

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
                "ثبت کار انجام نشد."
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


// =========================
// UPDATE
// =========================

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


// =========================
// AI
// =========================

async function predictCategory() {

    const title =
        $("title")
            ?.value
            .trim();

    if (!title) {

        showCategoryMessage(
            "ابتدا عنوان کار را وارد کن."
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

function showCategoryMessage(
    message
) {

    const result =
        $("categoryResult");

    if (!result) return;

    result.textContent =
        message;

    result.classList.remove(
        "hidden"
    );
}


// =========================
// STATUS
// =========================

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
                            task_id:
                                taskId,

                            status:
                                nextStatus
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


// =========================
// DELETE
// =========================

async function deleteTask(
    taskId
) {

    if (
        !confirm(
            "آیا مطمئنی می‌خواهی این کار را حذف کنی؟"
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
                            task_id:
                                taskId
                        })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "حذف کار انجام نشد."
            );
        }

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


// =========================
// FILTERS
// =========================

function applyFilters() {

    const search =
        $("taskSearch")
            ?.value
            .trim()
            .toLowerCase() || "";

    const category =
        $("categoryFilter")
            ?.value || "";

    const priority =
        $("priorityFilter")
            ?.value || "";

    const status =
        $("statusFilter")
            ?.value || "";

    const dueDate =
        $("dueDateFilter")
            ?.value || "";


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


// =========================
// DUE DATE
// =========================

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
        new Date(
            `${value}T00:00:00`
        );


    if (
        filter === "today"
    ) {

        return (
            date.getTime() ===
            today.getTime()
        );
    }


    if (
        filter === "upcoming"
    ) {

        return date > today;
    }


    return filter !== "none";
}


// =========================
// REMINDERS
// =========================

function getUpcomingReminders(
    tasks
) {

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

function parseReminderDate(
    value
) {

    if (!value) {
        return null;
    }

    const normalized =
        String(value)
            .replace(" ", "T");

    if (
        !normalized.includes("T")
    ) {
        return null;
    }

    const date =
        new Date(normalized);

    return Number.isNaN(
        date.getTime()
    )
        ? null
        : date;
}

function convertReminderForInput(
    value
) {

    if (!value) {
        return "";
    }

    const normalized =
        String(value)
            .replace(" ", "T");

    return normalized.length >= 16
        ? normalized.substring(
            0,
            16
        )
        : normalized;
}


// =========================
// RENDER REMINDERS
// =========================

function renderReminders(
    tasks
) {

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

                <span>🔕</span>

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
                        ${formatReminder(
                            task.reminder_at
                        )}
                    </span>

                </div>
            `;

            list.appendChild(item);
        });
}


// =========================
// FORMAT DATE
// =========================

function formatReminder(
    value
) {

    if (!value) {
        return "بدون یادآوری";
    }

    const date =
        parseReminderDate(
            value
        );

    if (!date) {
        return value;
    }

    return date.toLocaleString(
        "fa-IR",
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    );
}

// =========================
// BROWSER NOTIFICATIONS
// =========================

const REMINDER_STORAGE_KEY =
    "smarttask3_shown_reminders";

let reminderChecker = null;

let notificationRegistration = null;


// -------------------------
// ثبت Service Worker
// -------------------------

async function registerNotificationServiceWorker() {

    if (!("serviceWorker" in navigator)) {

        console.warn(
            "مرورگر از Service Worker پشتیبانی نمی‌کند."
        );

        return null;
    }

    try {

        notificationRegistration =
            await navigator.serviceWorker.register(
                "/static/js/sw.js",
                {
                    scope: "/static/js/"
                }
            );

        await navigator.serviceWorker.ready;

        console.log(
            "Notification Service Worker فعال شد."
        );

        return notificationRegistration;

    } catch (error) {

        console.error(
            "Service Worker registration error:",
            error
        );

        return null;
    }
}


// -------------------------
// ذخیره اعلان‌های نمایش داده‌شده
// -------------------------

function getShownReminderKeys() {

    try {

        const saved =
            localStorage.getItem(
                REMINDER_STORAGE_KEY
            );

        if (!saved) {
            return new Set();
        }

        const parsed =
            JSON.parse(saved);

        if (!Array.isArray(parsed)) {
            return new Set();
        }

        return new Set(parsed);

    } catch (error) {

        console.error(
            "Reminder storage read error:",
            error
        );

        return new Set();
    }
}


function saveShownReminderKeys(keys) {

    try {

        localStorage.setItem(
            REMINDER_STORAGE_KEY,
            JSON.stringify(
                Array.from(keys)
            )
        );

    } catch (error) {

        console.error(
            "Reminder storage save error:",
            error
        );
    }
}


// -------------------------
// کلید یکتای یادآوری
// -------------------------

function getReminderNotificationKey(task) {

    return [
        "smarttask3",
        "reminder",
        task.id,
        task.reminder_at
    ].join("-");
}


// -------------------------
// درخواست اجازه Notification
// -------------------------

async function requestNotificationPermission() {

    if (!("Notification" in window)) {

        console.warn(
            "مرورگر این سیستم از Notification پشتیبانی نمی‌کند."
        );

        return false;
    }


    if (
        Notification.permission ===
        "granted"
    ) {

        return true;
    }


    if (
        Notification.permission ===
        "denied"
    ) {

        console.warn(
            "اجازه Notification توسط کاربر رد شده است."
        );

        return false;
    }


    try {

        const permission =
            await Notification.requestPermission();

        return (
            permission ===
            "granted"
        );

    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );

        return false;
    }
}


// -------------------------
// شروع بررسی یادآوری‌ها
// -------------------------

function startReminderChecker() {

    if (reminderChecker) {

        clearInterval(
            reminderChecker
        );
    }


    registerNotificationServiceWorker()
        .then(() => {

            checkRemindersNow();

        })
        .catch(error => {

            console.error(
                "Reminder Service Worker error:",
                error
            );

        });


    reminderChecker =
        setInterval(
            checkRemindersNow,
            1000
        );
}


// -------------------------
// بررسی زمان یادآوری‌ها
// -------------------------

async function checkRemindersNow() {

    if (
        !Array.isArray(allTasks)
    ) {
        return;
    }


    if (
        !("Notification" in window)
    ) {
        return;
    }


    if (
        Notification.permission !==
        "granted"
    ) {
        return;
    }


    const registration =
        notificationRegistration ||
        await getNotificationRegistration();


    if (!registration) {
        return;
    }


    const now =
        new Date();


    const shownKeys =
        getShownReminderKeys();


    let storageChanged =
        false;


    for (
        const task of allTasks
    ) {

        if (!task.reminder_at) {
            continue;
        }


        if (
            task.status ===
            "انجام شده"
        ) {
            continue;
        }


        const reminder =
            parseReminderDate(
                task.reminder_at
            );


        if (!reminder) {
            continue;
        }


        const key =
            getReminderNotificationKey(
                task
            );


        if (
            shownKeys.has(key)
        ) {
            continue;
        }


        if (
            now.getTime() >=
            reminder.getTime()
        ) {

            const shown =
                await showTaskReminderNotification(
                    task,
                    registration
                );


            if (shown) {

                shownKeys.add(key);

                storageChanged = true;
            }
        }
    }


    if (storageChanged) {

        saveShownReminderKeys(
            shownKeys
        );
    }
}


// -------------------------
// دریافت Service Worker
// -------------------------

async function getNotificationRegistration() {

    if (
        !("serviceWorker" in navigator)
    ) {
        return null;
    }


    try {

        const registration =
            await navigator.serviceWorker.ready;

        notificationRegistration =
            registration;

        return registration;

    } catch (error) {

        console.error(
            "Service Worker ready error:",
            error
        );

        return null;
    }
}


// -------------------------
// نمایش Notification
// -------------------------

async function showTaskReminderNotification(
    task,
    registration
) {

    if (!registration) {
        return false;
    }


    if (
        !("Notification" in window)
    ) {
        return false;
    }


    if (
        Notification.permission !==
        "granted"
    ) {
        return false;
    }


    const title =
        "🔔 یادآوری کار";


    const body =
        task.title ||
        "یک کار برایت یادآوری شده است.";


    const tag =
        getReminderNotificationKey(
            task
        );


    try {

        await registration.showNotification(
            title,
            {
                body: body,

                icon:
                    "/static/favicon.ico",

                badge:
                    "/static/favicon.ico",

                tag: tag,

                renotify: false,

                requireInteraction: false,

                data: {
                    taskId: task.id
                }
            }
        );


        return true;

    } catch (error) {

        console.error(
            "Notification error:",
            error
        );

        return false;
    }
}