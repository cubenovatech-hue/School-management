/* ---------------- API wrapper ---------------- */
const API_BASE = "/api";

async function api(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

/* ---------------- Auth helpers ---------------- */
function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function requireAuth(allowedRoles) {
  const user = getUser();
  const token = localStorage.getItem("token");
  if (!user || !token) {
    window.location.href = "/login.html";
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.location.href = "/login.html";
    return null;
  }
  return user;
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login.html";
}

/* ---------------- UI helpers ---------------- */
function toast(message, isError = false) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `toast show ${isError ? "error" : ""}`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("show"), 3200);
}

function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtCurrency(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

function initials(name) {
  return (name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function stageLabel(stage) {
  const map = {
    new: "New",
    contacted: "Contacted",
    visit_scheduled: "Visit Scheduled",
    application_submitted: "Application In",
    enrolled: "Enrolled",
    lost: "Lost",
  };
  return map[stage] || stage;
}

/* Renders the sidebar for a given role + active page key */
function renderSidebar(activeKey) {
  const user = getUser();
  if (!user) return;

  const navByRole = {
    admin: [
      ["overview", "Overview", "/pages/admin.html"],
      ["students", "Students", "/pages/admin-students.html"],
      ["teachers", "Teachers", "/pages/admin-teachers.html"],
      ["attendance", "Attendance", "/pages/admin-attendance.html"],
      ["fees", "Fees", "/pages/admin-fees.html"],
      ["leads", "Admissions CRM", "/pages/leads.html"],
      ["subscriptions", "Subscriptions", "/pages/admin-subscriptions.html"],
      ["timetable", "Timetable", "/pages/admin-timetable.html"],
      ["salary", "Teacher Salary", "/pages/admin-salary.html"],
      ["library", "Library", "/pages/library.html"],
      ["announcements", "Announcements", "/pages/announcements.html"],
      ["messages", "Contact Messages", "/pages/admin-messages.html"],
    ],
    teacher: [
      ["overview", "Overview", "/pages/teacher.html"],
      ["attendance", "Take Attendance", "/pages/teacher-attendance.html"],
      ["grades", "Grades", "/pages/teacher-grades.html"],
      ["timetable", "My Timetable", "/pages/teacher-timetable.html"],
      ["salary", "My Salary", "/pages/teacher-salary.html"],
      ["notifications", "Notifications", "/pages/notifications.html"],
      ["announcements", "Announcements", "/pages/announcements.html"],
    ],
    student: [
      ["overview", "Overview", "/pages/student.html"],
      ["attendance", "My Attendance", "/pages/student-attendance.html"],
      ["grades", "My Grades", "/pages/student-grades.html"],
      ["timetable", "My Timetable", "/pages/student-timetable.html"],
      ["library", "Library", "/pages/library.html"],
      ["notifications", "Notifications", "/pages/notifications.html"],
      ["announcements", "Announcements", "/pages/announcements.html"],
    ],
    parent: [
      ["overview", "Overview", "/pages/parent.html"],
      ["notifications", "Notifications", "/pages/notifications.html"],
      ["announcements", "Announcements", "/pages/announcements.html"],
    ],
  };

  const items = navByRole[user.role] || [];
  const roleColors = { admin: "#2F6D5E", teacher: "#3A5BA0", student: "#C97A2B", parent: "#8B4F9E" };
  document.documentElement.style.setProperty("--accent", roleColors[user.role] || "#2F6D5E");

  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  sidebar.innerHTML = `
    <div class="brand">
      <div class="dot"></div>
      <div class="name">Northfield School</div>
    </div>
    <div class="role-badge">${user.role}</div>
    <nav>
      ${items
        .map(
          ([key, label, href]) =>
            `<a href="${href}" class="${key === activeKey ? "active" : ""}">${label}${key === "notifications" ? ' <span id="navNotifBadge" style="display:none; background:var(--crm); color:#fff; font-size:10px; font-weight:700; padding:1px 6px; border-radius:10px; margin-left:6px;"></span>' : ""}</a>`
        )
        .join("")}
    </nav>
    <div class="logout-row">
      <div class="small-text muted" style="margin-bottom:6px;">${user.name}</div>
      <button onclick="logout()">Log out →</button>
    </div>
  `;

  ensureMobileNavChrome();

  // Fetch unread notification count in the background, for any role that has a Notifications link
  if (items.some(([key]) => key === "notifications")) {
    api("/misc/messages/inbox")
      .then((messages) => {
        const unread = messages.filter((m) => !m.read).length;
        const badge = document.getElementById("navNotifBadge");
        if (badge && unread > 0) {
          badge.textContent = unread > 9 ? "9+" : unread;
          badge.style.display = "inline-block";
        }
      })
      .catch(() => {}); // silent — a badge failing to load shouldn't break the page
  }
}

/* ---------------- Mobile navigation: hamburger topbar + off-canvas drawer ---------------- */
function ensureMobileNavChrome() {
  if (!document.getElementById("mobileTopbar")) {
    const topbar = document.createElement("div");
    topbar.id = "mobileTopbar";
    topbar.className = "mobile-topbar";
    topbar.innerHTML = `
      <button class="hamburger-btn" onclick="toggleMobileSidebar()" aria-label="Open menu"><span></span><span></span><span></span></button>
      <div class="brand"><span class="dot"></span> Northfield School</div>
      <span style="width:32px;"></span>
    `;
    const appShell = document.querySelector(".app-shell");
    if (appShell) appShell.insertBefore(topbar, appShell.firstChild);
  }

  if (!document.getElementById("sidebarOverlay")) {
    const overlay = document.createElement("div");
    overlay.id = "sidebarOverlay";
    overlay.className = "sidebar-overlay";
    overlay.addEventListener("click", closeMobileSidebar);
    document.body.appendChild(overlay);
  }
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  if (!sidebar) return;
  const isOpen = sidebar.classList.toggle("open");
  if (overlay) overlay.classList.toggle("show", isOpen);
}

function closeMobileSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  if (sidebar) sidebar.classList.remove("open");
  if (overlay) overlay.classList.remove("show");
}
