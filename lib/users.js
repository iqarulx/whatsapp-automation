const bcrypt = require("bcryptjs");
const db = require("./db");

const PUBLIC_FIELDS = `id, name, email, mobile, company_name AS companyName, whatsapp_number AS whatsappNumber, created_at AS createdAt`;

function createUser({ name, email, mobile, companyName, password }) {
  const passwordHash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare(
    `INSERT INTO users (name, email, mobile, company_name, password_hash) VALUES (?, ?, ?, ?, ?)`
  );
  const info = stmt.run(name, email, mobile, companyName || null, passwordHash);
  return getUserById(Number(info.lastInsertRowid));
}

function getUserById(id) {
  return db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).get(id);
}

function findByEmailOrMobile(identifier) {
  return db
    .prepare(`SELECT * FROM users WHERE email = ? OR mobile = ?`)
    .get(identifier, identifier);
}

function listUsers() {
  return db
    .prepare(`SELECT ${PUBLIC_FIELDS} FROM users ORDER BY created_at DESC`)
    .all();
}

function deleteUser(id) {
  db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
}

function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash);
}

function setWhatsappNumber(userId, number) {
  db.prepare(`UPDATE users SET whatsapp_number = ? WHERE id = ?`).run(number, userId);
}

module.exports = {
  createUser,
  getUserById,
  findByEmailOrMobile,
  listUsers,
  deleteUser,
  verifyPassword,
  setWhatsappNumber,
};
