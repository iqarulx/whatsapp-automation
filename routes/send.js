const express = require("express");
const whatsapp = require("../lib/whatsapp");
const sendJobs = require("../lib/sendJobs");
const { normalizeNumbers } = require("../lib/phone");

const router = express.Router();

router.post("/", (req, res) => {
  const userId = req.session.userId;
  const { message, numbers } = req.body || {};

  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: "Message is required" });
  }
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: "At least one recipient is required" });
  }

  const status = whatsapp.getStatus(userId);
  if (status.status !== "ready") {
    return res.status(409).json({ error: "WhatsApp is not connected" });
  }

  const cleanNumbers = normalizeNumbers(numbers);
  if (cleanNumbers.length === 0) {
    return res.status(400).json({ error: "No valid phone numbers found" });
  }

  const jobId = sendJobs.createJob(userId, String(message), cleanNumbers);
  res.json({ jobId, numbers: cleanNumbers });
});

router.get("/stream/:jobId", (req, res) => {
  const job = sendJobs.getJob(req.params.jobId);
  if (!job || job.userId !== req.session.userId) {
    return res.status(404).end();
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // Replay anything that already happened before this client connected.
  job.events.forEach(send);
  if (job.done) {
    return res.end();
  }

  const listener = (event) => {
    send(event);
    if (event.type === "done") res.end();
  };
  job.emitter.on("event", listener);

  req.on("close", () => {
    job.emitter.off("event", listener);
  });
});

module.exports = router;
