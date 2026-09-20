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
      ["library", "Library", "/pages/library.html"],
      ["announcements", "Announcements", "/pages/announcements.html"],
      ["messages", "Contact Messages", "/pages/admin-messages.html"],
    ],
    teacher: [
      ["overview", "Overview", "/pages/teacher.html"],
      ["attendance", "Take Attendance", "/pages/teacher-attendance.html"],
      ["grades", "Grades", "/pages/teacher-grades.html"],
      ["timetable", "My Timetable", "/pages/teacher-timetable.html"],
      ["announcements", "Announcements", "/pages/announcements.html"],
    ],
    student: [
      ["overview", "Overview", "/pages/student.html"],
      ["attendance", "My Attendance", "/pages/student-attendance.html"],
      ["grades", "My Grades", "/pages/student-grades.html"],
      ["timetable", "My Timetable", "/pages/student-timetable.html"],
      ["library", "Library", "/pages/library.html"],
      ["announcements", "Announcements", "/pages/announcements.html"],
    ],
    parent: [
      ["overview", "Overview", "/pages/parent.html"],
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
            `<a href="${href}" class="${key === activeKey ? "active" : ""}">${label}</a>`
        )
        .join("")}
    </nav>
    <div class="logout-row">
      <div class="small-text muted" style="margin-bottom:6px;">${user.name}</div>
      <button onclick="logout()">Log out →</button>
    </div>
  `;
}