const express = require("express");
const google = require("../lib/google");

const router = express.Router();

router.get("/status", (req, res) => {
  try {
    res.json(google.getStatus(req.session.userId));
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

router.get("/connect", (req, res) => {
  try {
    res.redirect(google.getAuthUrl(req.session.userId));
  } catch (err) {
    res.status(500).send(`Google connect failed: ${err.message}`);
  }
});

// Cache-first: returns previously-saved contacts unless nothing is cached yet.
router.get("/contacts", async (req, res) => {
  try {
    const contacts = await google.getContacts(req.session.userId);
    res.json({ contacts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Explicit refresh: always refetches from Google and overwrites the cache.
router.post("/contacts/refresh", async (req, res) => {
  try {
    const contacts = await google.getContacts(req.session.userId, { forceRefresh: true });
    res.json({ contacts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
