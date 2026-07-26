const db = require("./db");

function getTokens(userId) {
  const row = db.prepare(`SELECT * FROM google_tokens WHERE user_id = ?`).get(userId);
  if (!row) return null;
  return {
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    scope: row.scope,
    token_type: row.token_type,
    expiry_date: row.expiry_date,
  };
}

// Google only sends a refresh_token on the very first consent, so merge onto
// whatever we already have instead of overwriting it with an absent value.
function saveTokens(userId, tokens) {
  const merged = { ...(getTokens(userId) || {}), ...tokens };
  db.prepare(
    `INSERT INTO google_tokens (user_id, access_token, refresh_token, scope, token_type, expiry_date, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       scope = excluded.scope,
       token_type = excluded.token_type,
       expiry_date = excluded.expiry_date,
       updated_at = excluded.updated_at`
  ).run(
    userId,
    merged.access_token ?? null,
    merged.refresh_token ?? null,
    merged.scope ?? null,
    merged.token_type ?? null,
    merged.expiry_date ?? null
  );
}

module.exports = { getTokens, saveTokens };
