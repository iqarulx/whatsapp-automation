const path = require("path");
const express = require("express");
const session = require("express-session");

const google = require("./lib/google");
const { requireAuth } = require("./lib/authMiddleware");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const whatsappRoutes = require("./routes/whatsapp");
const googleRoutes = require("./routes/google");
const sendRoutes = require("./routes/send");
const groupsRoutes = require("./routes/groups");

const PORT = process.env.PORT || 3000;

// This app runs multiple whatsapp-web.js/puppeteer instances (one per
// user). Their internals occasionally throw uncaught errors outside of any
// promise we control (e.g. a detached frame during a page reload). Rather
// than let one flaky session take the whole server down for every user,
// just log it and keep running.
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (server kept alive):", err);
});
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection (server kept alive):", err);
});

const app = express();
app.use(express.json());
app.use(
  session({
    // Local single-machine tool: a fixed secret is fine here, but change it
    // if this is ever exposed beyond localhost.
    secret: "wa-bulk-sender-local-dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use(express.static(path.join(__dirname, "public")));

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});
app.get("/privacy", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "privacy.html"));
});
app.get("/terms", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "terms.html"));
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/whatsapp", requireAuth, whatsappRoutes);
app.use("/api/google", requireAuth, googleRoutes);
app.use("/api/send", requireAuth, sendRoutes);
app.use("/api/groups", requireAuth, groupsRoutes);

// Matches the redirect URI registered in the Google OAuth client:
// http://localhost:3000/callback
app.get("/callback", async (req, res) => {
  const { code, error, state } = req.query;
  if (error) {
    return res.status(400).send(`Google auth failed: ${error}`);
  }

  const userId = req.session.userId;
  if (!userId || String(userId) !== String(state)) {
    return res
      .status(401)
      .send("Your session expired before Google could confirm the connection. Please log back in and try again.");
  }

  try {
    await google.handleCallback(userId, code);
    res.redirect("/?google=connected");
  } catch (err) {
    res.status(500).send(`Google auth failed: ${err.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Whatsapp Automation running at http://localhost:${PORT}`);
  console.log(`Admin panel at http://localhost:${PORT}/admin`);
});
