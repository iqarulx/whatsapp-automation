const db = require("./db");

function getContacts(userId) {
  return db
    .prepare(`SELECT name, phone FROM contacts WHERE user_id = ? ORDER BY name COLLATE NOCASE`)
    .all(userId);
}

function hasContacts(userId) {
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM contacts WHERE user_id = ?`)
    .get(userId);
  return row.count > 0;
}

function saveContacts(userId, contacts) {
  db.exec("BEGIN");
  try {
    db.prepare(`DELETE FROM contacts WHERE user_id = ?`).run(userId);
    // OR IGNORE: two different saved names can share the same phone number.
    const insert = db.prepare(`INSERT OR IGNORE INTO contacts (user_id, name, phone) VALUES (?, ?, ?)`);
    for (const contact of contacts) {
      insert.run(userId, contact.name, contact.phone);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

module.exports = { getContacts, hasContacts, saveContacts };
