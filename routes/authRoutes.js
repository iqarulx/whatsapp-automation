const express = require("express");
const users = require("../lib/users");

const router = express.Router();

router.post("/login", (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ error: "Email/mobile and password are required" });
  }

  const user = users.findByEmailOrMobile(String(identifier).trim());
  if (!user || !users.verifyPassword(user, password)) {
    return res.status(401).json({ error: "Invalid email/mobile or password" });
  }

  req.session.userId = user.id;
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      companyName: user.company_name,
    },
  });
});

router.post("/logout", (req, res) => {
  if (req.session) req.session.userId = null;
  res.json({ ok: true });
});

router.get("/status", (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ loggedIn: false });
  }
  const user = users.getUserById(req.session.userId);
  if (!user) {
    req.session.userId = null;
    return res.json({ loggedIn: false });
  }
  res.json({ loggedIn: true, user });
});

module.exports = router;
