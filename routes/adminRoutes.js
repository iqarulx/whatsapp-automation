const express = require("express");
const users = require("../lib/users");
const whatsapp = require("../lib/whatsapp");
const { requireAdmin } = require("../lib/authMiddleware");

const router = express.Router();

const ADMIN_USERNAME = "Admin";
const ADMIN_PASSWORD = "Admin123@";

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.admin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Invalid admin username or password" });
});

router.post("/logout", (req, res) => {
  if (req.session) req.session.admin = null;
  res.json({ ok: true });
});

router.get("/status", (req, res) => {
  res.json({ loggedIn: !!(req.session && req.session.admin) });
});

router.get("/users", requireAdmin, (req, res) => {
  res.json({ users: users.listUsers() });
});

router.post("/users", requireAdmin, (req, res) => {
  const { name, email, mobile, companyName, password } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  if (!email || !String(email).trim()) {
    return res.status(400).json({ error: "Email is required" });
  }
  if (!mobile || !String(mobile).trim()) {
    return res.status(400).json({ error: "Mobile number is required" });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const user = users.createUser({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      mobile: String(mobile).replace(/[^\d]/g, ""),
      companyName: companyName ? String(companyName).trim() : null,
      password: String(password),
    });
    res.status(201).json({ user });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "A user with that email or mobile number already exists" });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete("/users/:id", requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  whatsapp.destroySession(userId);
  users.deleteUser(userId);
  res.json({ ok: true });
});

module.exports = router;
