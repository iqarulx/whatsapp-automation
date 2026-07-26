const adminBar = document.getElementById("adminBar");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");

const adminLoginView = document.getElementById("adminLoginView");
const adminDashboard = document.getElementById("adminDashboard");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminUsername = document.getElementById("adminUsername");
const adminPassword = document.getElementById("adminPassword");
const adminLoginError = document.getElementById("adminLoginError");

const createUserForm = document.getElementById("createUserForm");
const uName = document.getElementById("uName");
const uEmail = document.getElementById("uEmail");
const uMobile = document.getElementById("uMobile");
const uCompany = document.getElementById("uCompany");
const uPassword = document.getElementById("uPassword");
const createUserMsg = document.getElementById("createUserMsg");

const usersTableWrap = document.getElementById("usersTableWrap");

// ---------- Auth gating ----------

async function checkAdminAuth() {
  const res = await fetch("/api/admin/status");
  const data = await res.json();
  if (data.loggedIn) {
    showAdminDashboard();
  } else {
    showAdminLogin();
  }
}

function showAdminLogin() {
  adminLoginView.hidden = false;
  adminDashboard.hidden = true;
  adminBar.hidden = true;
}

function showAdminDashboard() {
  adminLoginView.hidden = true;
  adminDashboard.hidden = false;
  adminBar.hidden = false;
  loadUsers();
}

adminLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  adminLoginError.textContent = "";
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: adminUsername.value.trim(),
        password: adminPassword.value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    adminPassword.value = "";
    showAdminDashboard();
  } catch (err) {
    adminLoginError.textContent = err.message;
  }
});

adminLogoutBtn.addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  adminUsername.value = "";
  adminPassword.value = "";
  showAdminLogin();
});

// ---------- User management ----------

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderUsers(users) {
  if (users.length === 0) {
    usersTableWrap.innerHTML = `<p class="hint">No users yet. Create one above.</p>`;
    return;
  }

  const rows = users
    .map(
      (u) => `
        <tr>
          <td>${escapeHtml(u.name)}</td>
          <td>${escapeHtml(u.email)}</td>
          <td>${escapeHtml(u.mobile)}</td>
          <td class="muted">${escapeHtml(u.companyName || "—")}</td>
          <td class="muted">${escapeHtml(u.whatsappNumber || "Not linked")}</td>
          <td><button class="delete-btn" data-id="${u.id}">Delete</button></td>
        </tr>`
    )
    .join("");

  usersTableWrap.innerHTML = `
    <div class="table-scroll">
      <table class="users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Mobile</th>
            <th>Company</th>
            <th>WhatsApp</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  usersTableWrap.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this user? This also removes their saved contacts and Google connection.")) return;
      await fetch(`/api/admin/users/${btn.dataset.id}`, { method: "DELETE" });
      loadUsers();
    });
  });
}

async function loadUsers() {
  usersTableWrap.innerHTML = `<p class="hint">Loading…</p>`;
  const res = await fetch("/api/admin/users");
  const data = await res.json();
  renderUsers(data.users || []);
}

createUserForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  createUserMsg.textContent = "";
  createUserMsg.classList.remove("error");
  try {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: uName.value.trim(),
        email: uEmail.value.trim(),
        mobile: uMobile.value.trim(),
        companyName: uCompany.value.trim(),
        password: uPassword.value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create user");
    createUserForm.reset();
    createUserMsg.textContent = `Created ${data.user.name}.`;
    loadUsers();
  } catch (err) {
    createUserMsg.classList.add("error");
    createUserMsg.textContent = err.message;
  }
});

// ---------- Init ----------

checkAdminAuth();
