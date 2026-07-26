function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Please log in" });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.admin) {
    return res.status(401).json({ error: "Admin login required" });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
