const express = require("express");
const whatsapp = require("../lib/whatsapp");

const router = express.Router();

router.get("/status", (req, res) => {
  res.json(whatsapp.getStatus(req.session.userId));
});

router.post("/connect", (req, res) => {
  res.json(whatsapp.initClient(req.session.userId));
});

// Server-Sent Events: push this user's status updates (qr code, ready, etc.) live.
// Also lazily starts their client the first time their dashboard opens, so a
// returning user's saved session reconnects without needing to click Connect.
router.get("/stream", (req, res) => {
  const userId = req.session.userId;

  if (whatsapp.getStatus(userId).status === "disconnected") {
    whatsapp.initClient(userId);
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  send(whatsapp.getStatus(userId));

  const listener = (event) => {
    if (event.userId === userId) send(event);
  };
  whatsapp.emitter.on("update", listener);

  req.on("close", () => {
    whatsapp.emitter.off("update", listener);
  });
});

module.exports = router;
