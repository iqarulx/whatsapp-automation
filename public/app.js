const userBar = document.getElementById("userBar");
const userGreeting = document.getElementById("userGreeting");
const logoutBtn = document.getElementById("logoutBtn");

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginIdentifier = document.getElementById("loginIdentifier");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");

const waBadge = document.getElementById("waBadge");
const waConnectBtn = document.getElementById("waConnectBtn");
const waQrBox = document.getElementById("waQrBox");
const waQrImg = document.getElementById("waQrImg");

const googleBadge = document.getElementById("googleBadge");
const googleConnectBtn = document.getElementById("googleConnectBtn");

const googleContactsBox = document.getElementById("googleContactsBox");
const refreshContactsBtn = document.getElementById("refreshContactsBtn");
const contactSearch = document.getElementById("contactSearch");
const contactsSummary = document.getElementById("contactsSummary");
const contactsList = document.getElementById("contactsList");

const groupsSummary = document.getElementById("groupsSummary");
const createGroupBtn = document.getElementById("createGroupBtn");
const groupsList = document.getElementById("groupsList");

const groupModalOverlay = document.getElementById("groupModalOverlay");
const groupModalTitle = document.getElementById("groupModalTitle");
const groupModalClose = document.getElementById("groupModalClose");
const groupModalCancel = document.getElementById("groupModalCancel");
const groupModalError = document.getElementById("groupModalError");
const groupForm = document.getElementById("groupForm");
const groupNameInput = document.getElementById("groupNameInput");
const groupNumbersList = document.getElementById("groupNumbersList");
const addNumberInput = document.getElementById("addNumberInput");
const addNumberBtn = document.getElementById("addNumberBtn");

const manualNumbers = document.getElementById("manualNumbers");
const recipientCount = document.getElementById("recipientCount");
const messageBox = document.getElementById("messageBox");
const sendBtn = document.getElementById("sendBtn");
const sendHint = document.getElementById("sendHint");

const logPanel = document.getElementById("logPanel");
const logSummary = document.getElementById("logSummary");
const logList = document.getElementById("logList");

let whatsappReady = false;
let allContacts = [];
let selectedPhones = new Set();
let allGroups = [];
let selectedGroupIds = new Set();
let googleConnected = false;
let waStreamStarted = false;

// ---------- Auth gating ----------

async function checkAuth() {
  const res = await fetch("/api/auth/status");
  const data = await res.json();
  if (data.loggedIn) {
    showDashboard(data.user);
  } else {
    showLogin();
  }
}

function showLogin() {
  loginView.hidden = false;
  dashboardView.hidden = true;
  userBar.hidden = true;
}

function showDashboard(user) {
  loginView.hidden = true;
  dashboardView.hidden = false;
  userBar.hidden = false;
  userGreeting.textContent = user.name;

  if (!waStreamStarted) {
    waStreamStarted = true;
    connectWhatsappStream();
    refreshGoogleStatus();
    loadGroups();
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: loginIdentifier.value.trim(),
        password: loginPassword.value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    loginPassword.value = "";
    showDashboard(data.user);
  } catch (err) {
    loginError.textContent = err.message;
  }
});

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  loginIdentifier.value = "";
  loginPassword.value = "";
  showLogin();
});

// ---------- WhatsApp status ----------

function renderWhatsappStatus(status) {
  whatsappReady = status.status === "ready";
  waQrBox.hidden = status.status !== "qr";
  if (status.status === "qr" && status.qrDataUrl) {
    waQrImg.src = status.qrDataUrl;
  }

  waBadge.className = "badge";
  switch (status.status) {
    case "ready":
      waBadge.classList.add("ok");
      waBadge.textContent = "Connected";
      waConnectBtn.hidden = true;
      break;
    case "qr":
      waBadge.classList.add("pending");
      waBadge.textContent = "Scan QR to connect";
      waConnectBtn.hidden = true;
      break;
    case "initializing":
    case "authenticated":
      waBadge.classList.add("pending");
      waBadge.textContent = "Connecting…";
      waConnectBtn.hidden = true;
      break;
    case "auth_failure":
      waBadge.classList.add("bad");
      waBadge.textContent = "Connection failed";
      waConnectBtn.hidden = false;
      break;
    default:
      waBadge.classList.add("bad");
      waBadge.textContent = "Not connected";
      waConnectBtn.hidden = false;
  }
  updateSendState();
}

function connectWhatsappStream() {
  const es = new EventSource("/api/whatsapp/stream");
  es.onmessage = (e) => renderWhatsappStatus(JSON.parse(e.data));
  es.onerror = () => {
    // Browser will auto-retry the SSE connection.
  };
}

waConnectBtn.addEventListener("click", async () => {
  waConnectBtn.hidden = true;
  await fetch("/api/whatsapp/connect", { method: "POST" });
});

// ---------- Google status ----------

async function refreshGoogleStatus() {
  const res = await fetch("/api/google/status");
  const status = await res.json();
  googleConnected = status.connected;
  googleBadge.className = "badge";
  if (status.connected) {
    googleBadge.classList.add("ok");
    googleBadge.textContent = "Connected";
    googleConnectBtn.hidden = true;
    googleContactsBox.hidden = false;
    loadContacts();
  } else {
    googleBadge.classList.add("bad");
    googleBadge.textContent = "Not connected";
    googleConnectBtn.hidden = false;
    googleContactsBox.hidden = true;
  }
}

// ---------- Google contacts ----------

function initials(name) {
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0] || "";
  const last = words.length > 1 ? words[words.length - 1][0] || "" : "";
  return (first + last).toUpperCase();
}

function renderContacts(list) {
  contactsList.innerHTML = "";

  if (list.length === 0) {
    const empty = document.createElement("p");
    empty.className = "contacts-meta";
    empty.textContent = "No contacts match your search.";
    contactsList.appendChild(empty);
    return;
  }

  for (const contact of list) {
    const row = document.createElement("label");
    row.className = "contact-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = contact.phone;
    checkbox.checked = selectedPhones.has(contact.phone);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedPhones.add(contact.phone);
      else selectedPhones.delete(contact.phone);
      updateRecipientCount();
    });

    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.textContent = initials(contact.name);

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = contact.name;

    const phone = document.createElement("span");
    phone.className = "phone";
    phone.textContent = contact.phone;

    row.append(checkbox, avatar, name, phone);
    contactsList.appendChild(row);
  }
}

async function loadContacts() {
  contactsSummary.textContent = "Loading contacts…";
  try {
    const res = await fetch("/api/google/contacts");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load contacts");
    allContacts = data.contacts;
    contactsSummary.textContent = `${allContacts.length} contact(s)`;
    contactSearch.hidden = allContacts.length === 0;
    contactsList.hidden = allContacts.length === 0;
    renderContacts(allContacts);
  } catch (err) {
    contactsSummary.textContent = err.message;
  }
}

refreshContactsBtn.addEventListener("click", async () => {
  refreshContactsBtn.disabled = true;
  refreshContactsBtn.textContent = "Refreshing…";
  contactsSummary.textContent = "Fetching latest contacts from Google…";
  try {
    const res = await fetch("/api/google/contacts/refresh", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to refresh contacts");
    allContacts = data.contacts;
    contactsSummary.textContent = `${allContacts.length} contact(s) · refreshed just now`;
    contactSearch.hidden = allContacts.length === 0;
    contactsList.hidden = allContacts.length === 0;
    renderContacts(allContacts);
  } catch (err) {
    contactsSummary.textContent = err.message;
  } finally {
    refreshContactsBtn.disabled = false;
    refreshContactsBtn.textContent = "Refresh Contacts";
  }
});

contactSearch.addEventListener("input", () => {
  const q = contactSearch.value.trim().toLowerCase();
  const filtered = q
    ? allContacts.filter(
        (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
      )
    : allContacts;
  renderContacts(filtered);
});

// ---------- Groups ----------

async function loadGroups() {
  const res = await fetch("/api/groups");
  const data = await res.json();
  allGroups = data.groups || [];
  renderGroups();
}

function renderGroups() {
  groupsSummary.textContent =
    allGroups.length === 0 ? "No saved groups yet" : `${allGroups.length} group(s)`;
  groupsList.hidden = allGroups.length === 0;
  groupsList.innerHTML = "";

  for (const group of allGroups) {
    const row = document.createElement("div");
    row.className = "group-row";

    const checkboxLabel = document.createElement("label");
    checkboxLabel.style.display = "contents";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedGroupIds.has(group.id);
    checkbox.setAttribute("aria-label", `Select group ${group.name}`);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedGroupIds.add(group.id);
      else selectedGroupIds.delete(group.id);
      updateRecipientCount();
    });

    const avatar = document.createElement("span");
    avatar.className = "avatar group-avatar";
    avatar.textContent = initials(group.name);

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = group.name;

    const count = document.createElement("span");
    count.className = "count";
    count.textContent = `${group.numbers.length} number${group.numbers.length === 1 ? "" : "s"}`;

    checkboxLabel.append(checkbox, avatar, name);

    const actions = document.createElement("div");
    actions.className = "group-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "icon-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openGroupModal("edit", group));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "icon-btn danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteGroup(group));

    actions.append(editBtn, deleteBtn);

    row.append(checkboxLabel, count, actions);
    groupsList.appendChild(row);
  }
}

async function deleteGroup(group) {
  if (!confirm(`Delete the group "${group.name}"? This can't be undone.`)) return;
  await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
  selectedGroupIds.delete(group.id);
  await loadGroups();
  updateRecipientCount();
}

// ---------- Group create/edit modal ----------

let modalMode = null; // "create" | "edit"
let modalNumbers = [];
let editingGroupId = null;

function renderModalNumbers() {
  groupNumbersList.innerHTML = "";
  if (modalNumbers.length === 0) {
    const empty = document.createElement("p");
    empty.className = "contacts-meta";
    empty.textContent = "No numbers yet — add one below.";
    groupNumbersList.appendChild(empty);
    return;
  }
  for (const number of modalNumbers) {
    const chip = document.createElement("span");
    chip.className = "number-chip";

    const text = document.createElement("span");
    text.textContent = number;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "✕";
    removeBtn.setAttribute("aria-label", `Remove ${number}`);
    removeBtn.addEventListener("click", () => {
      modalNumbers = modalNumbers.filter((n) => n !== number);
      renderModalNumbers();
    });

    chip.append(text, removeBtn);
    groupNumbersList.appendChild(chip);
  }
}

function openGroupModal(mode, group) {
  modalMode = mode;
  editingGroupId = mode === "edit" ? group.id : null;
  groupModalTitle.textContent = mode === "edit" ? "Edit group" : "Create group";
  groupNameInput.value = mode === "edit" ? group.name : "";
  modalNumbers = mode === "edit" ? [...group.numbers] : allRecipients();
  groupModalError.textContent = "";
  addNumberInput.value = "";
  renderModalNumbers();
  groupModalOverlay.hidden = false;
  groupNameInput.focus();
}

function closeGroupModal() {
  groupModalOverlay.hidden = true;
  modalMode = null;
  editingGroupId = null;
}

groupModalClose.addEventListener("click", closeGroupModal);
groupModalCancel.addEventListener("click", closeGroupModal);
groupModalOverlay.addEventListener("click", (e) => {
  if (e.target === groupModalOverlay) closeGroupModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !groupModalOverlay.hidden) closeGroupModal();
});

function addNumberFromInput() {
  const raw = addNumberInput.value.trim();
  if (!raw) return;
  const parts = raw.split(",").map((n) => n.replace(/[^\d]/g, "")).filter((n) => n.length >= 8);
  for (const digits of parts) {
    if (!modalNumbers.includes(digits)) modalNumbers.push(digits);
  }
  addNumberInput.value = "";
  renderModalNumbers();
}

addNumberBtn.addEventListener("click", addNumberFromInput);
addNumberInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addNumberFromInput();
  }
});

createGroupBtn.addEventListener("click", () => {
  openGroupModal("create", { name: "", numbers: allRecipients() });
});

groupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  groupModalError.textContent = "";

  const name = groupNameInput.value.trim();
  if (!name) {
    groupModalError.textContent = "Group name is required.";
    return;
  }
  if (modalNumbers.length === 0) {
    groupModalError.textContent = "Add at least one number.";
    return;
  }

  const saveBtn = document.getElementById("groupModalSave");
  saveBtn.disabled = true;
  try {
    const url = modalMode === "edit" ? `/api/groups/${editingGroupId}` : "/api/groups";
    const method = modalMode === "edit" ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, numbers: modalNumbers }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save group");
    closeGroupModal();
    await loadGroups();
    updateRecipientCount();
  } catch (err) {
    groupModalError.textContent = err.message;
  } finally {
    saveBtn.disabled = false;
  }
});

// ---------- Recipients / send ----------

function manualNumbersList() {
  return manualNumbers.value
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
}

function groupNumbersFromSelection() {
  const numbers = [];
  for (const group of allGroups) {
    if (selectedGroupIds.has(group.id)) numbers.push(...group.numbers);
  }
  return numbers;
}

function allRecipients() {
  const combined = new Set([
    ...selectedPhones,
    ...manualNumbersList(),
    ...groupNumbersFromSelection(),
  ]);
  return Array.from(combined);
}

function updateRecipientCount() {
  const count = allRecipients().length;
  recipientCount.innerHTML = `<strong>${count}</strong> recipient${count === 1 ? "" : "s"} selected`;
  createGroupBtn.disabled = count === 0;
  updateSendState();
}

manualNumbers.addEventListener("input", updateRecipientCount);
messageBox.addEventListener("input", updateSendState);

function updateSendState() {
  const hasRecipients = allRecipients().length > 0;
  const hasMessage = messageBox.value.trim().length > 0;
  sendBtn.disabled = !(whatsappReady && hasRecipients && hasMessage);
  if (!whatsappReady) sendHint.textContent = "Connect WhatsApp first.";
  else if (!hasRecipients) sendHint.textContent = "Add at least one recipient.";
  else if (!hasMessage) sendHint.textContent = "Type a message.";
  else sendHint.textContent = "";
}

function addLogLine(text, ok) {
  const line = document.createElement("div");
  line.className = `log-line ${ok ? "ok" : "bad"}`;
  line.textContent = text;
  logList.appendChild(line);
  logList.scrollTop = logList.scrollHeight;
}

sendBtn.addEventListener("click", async () => {
  const numbers = allRecipients();
  const message = messageBox.value.trim();

  sendBtn.disabled = true;
  logPanel.hidden = false;
  logList.innerHTML = "";
  logSummary.textContent = `Sending to ${numbers.length} recipient(s)…`;

  try {
    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, numbers }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to start send job");

    const es = new EventSource(`/api/send/stream/${data.jobId}`);
    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === "sent") {
        addLogLine(`Sent to ${event.number}`, true);
      } else if (event.type === "failed") {
        addLogLine(`Failed for ${event.number}: ${event.reason}`, false);
      } else if (event.type === "done") {
        logSummary.textContent = `Done. Sent ${event.sent.length}, failed ${event.failed.length}.`;
        es.close();
        updateSendState();
      }
    };
    es.onerror = () => {
      es.close();
      updateSendState();
    };
  } catch (err) {
    logSummary.textContent = err.message;
    updateSendState();
  }
});

// ---------- Init ----------

checkAuth();
updateSendState();
