const express = require("express");
const groups = require("../lib/groups");
const { normalizeNumbers } = require("../lib/phone");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ groups: groups.listGroups(req.session.userId) });
});

router.post("/", (req, res) => {
  const { name, numbers } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Group name is required" });
  }
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: "Select at least one recipient for the group" });
  }
  const cleanNumbers = normalizeNumbers(numbers);
  if (cleanNumbers.length === 0) {
    return res.status(400).json({ error: "No valid phone numbers found" });
  }

  try {
    const group = groups.createGroup(req.session.userId, String(name).trim(), cleanNumbers);
    res.status(201).json({ group });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "A group with that name already exists" });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", (req, res) => {
  const { name, numbers } = req.body || {};

  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: "Group name is required" });
  }

  let cleanNumbers;
  if (numbers !== undefined) {
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ error: "A group must have at least one number" });
    }
    cleanNumbers = normalizeNumbers(numbers);
    if (cleanNumbers.length === 0) {
      return res.status(400).json({ error: "No valid phone numbers found" });
    }
  }

  try {
    const updated = groups.updateGroup(req.session.userId, Number(req.params.id), {
      name: name !== undefined ? String(name).trim() : undefined,
      numbers: cleanNumbers,
    });
    if (!updated) return res.status(404).json({ error: "Group not found" });
    res.json({ group: updated });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "A group with that name already exists" });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", (req, res) => {
  groups.deleteGroup(req.session.userId, Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
