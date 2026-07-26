const db = require("./db");

function rowToGroup(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, numbers: JSON.parse(row.numbers) };
}

function listGroups(userId) {
  return db
    .prepare(`SELECT id, name, numbers FROM groups WHERE user_id = ? ORDER BY name COLLATE NOCASE`)
    .all(userId)
    .map(rowToGroup);
}

function getGroup(userId, id) {
  const row = db
    .prepare(`SELECT id, name, numbers FROM groups WHERE id = ? AND user_id = ?`)
    .get(id, userId);
  return rowToGroup(row);
}

function createGroup(userId, name, numbers) {
  const info = db
    .prepare(`INSERT INTO groups (user_id, name, numbers) VALUES (?, ?, ?)`)
    .run(userId, name, JSON.stringify(numbers));
  return getGroup(userId, Number(info.lastInsertRowid));
}

function updateGroup(userId, id, { name, numbers }) {
  const existing = getGroup(userId, id);
  if (!existing) return null;
  const nextName = name !== undefined ? name : existing.name;
  const nextNumbers = numbers !== undefined ? numbers : existing.numbers;
  db.prepare(`UPDATE groups SET name = ?, numbers = ? WHERE id = ? AND user_id = ?`).run(
    nextName,
    JSON.stringify(nextNumbers),
    id,
    userId
  );
  return getGroup(userId, id);
}

function deleteGroup(userId, id) {
  db.prepare(`DELETE FROM groups WHERE id = ? AND user_id = ?`).run(id, userId);
}

module.exports = { listGroups, getGroup, createGroup, updateGroup, deleteGroup };
