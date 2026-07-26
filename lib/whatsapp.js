/**
 * Manages one whatsapp-web.js client per user (multi-tenant). Each user's
 * browser session is kept separate on disk via LocalAuth's clientId, so
 * their linked WhatsApp device and login state persist independently.
 */
const { Client, LocalAuth } = require("whatsapp-web.js");
const QRCode = require("qrcode");
const { EventEmitter } = require("events");
const users = require("./users");

const emitter = new EventEmitter(); // emits { userId, status, qrDataUrl, error }

// userId -> { client, status, qrDataUrl, error }
const sessions = new Map();

function getStatus(userId) {
  const s = sessions.get(userId);
  if (!s) return { status: "disconnected", qrDataUrl: null, error: null };
  return { status: s.status, qrDataUrl: s.qrDataUrl, error: s.error };
}

function setState(userId, patch) {
  const s = sessions.get(userId) || { client: null, status: "disconnected", qrDataUrl: null, error: null };
  Object.assign(s, patch);
  sessions.set(userId, s);
  emitter.emit("update", { userId, ...getStatus(userId) });
}

function initClient(userId) {
  const existing = sessions.get(userId);
  if (existing && (existing.client || existing.status === "initializing")) {
    return getStatus(userId);
  }

  setState(userId, { status: "initializing", qrDataUrl: null, error: null });

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: `user-${userId}` }),
    puppeteer: {
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        // Constrained/shared hosting often has a tiny /dev/shm; Chromium
        // crashes on launch without this unless shared memory is bumped.
        "--disable-dev-shm-usage",
      ],
    },
  });
  sessions.get(userId).client = client;

  client.on("qr", async (qr) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(qr);
      setState(userId, { status: "qr", qrDataUrl, error: null });
    } catch (err) {
      console.error(`[whatsapp:${userId}] QR encode failed:`, err);
      setState(userId, { status: "auth_failure", error: err.message });
    }
  });

  client.on("authenticated", () => {
    setState(userId, { status: "authenticated", qrDataUrl: null, error: null });
  });

  client.on("ready", () => {
    setState(userId, { status: "ready", qrDataUrl: null, error: null });
    const number = client.info && client.info.wid ? client.info.wid.user : null;
    if (number) users.setWhatsappNumber(userId, number);
  });

  client.on("auth_failure", (msg) => {
    console.error(`[whatsapp:${userId}] auth_failure:`, msg);
    setState(userId, { status: "auth_failure", error: String(msg) });
  });

  client.on("disconnected", (reason) => {
    if (reason) console.error(`[whatsapp:${userId}] disconnected:`, reason);
    setState(userId, { status: "disconnected", qrDataUrl: null, error: reason ? String(reason) : null });
    const s = sessions.get(userId);
    if (s && s.client) {
      const dead = s.client;
      s.client = null;
      dead.destroy().catch(() => {});
    }
  });

  client.initialize().catch((err) => {
    console.error(`[whatsapp:${userId}] initialize() failed:`, err);
    setState(userId, { status: "auth_failure", error: err.message });
    const s = sessions.get(userId);
    if (s) s.client = null;
  });

  return getStatus(userId);
}

async function sendMessage(userId, number, message) {
  const s = sessions.get(userId);
  if (!s || !s.client || s.status !== "ready") {
    throw new Error("WhatsApp is not connected");
  }
  const chatId = `${number}@c.us`;
  const isRegistered = await s.client.isRegisteredUser(chatId);
  if (!isRegistered) {
    const err = new Error("Number is not on WhatsApp");
    err.code = "NOT_REGISTERED";
    throw err;
  }
  await s.client.sendMessage(chatId, message);
}

function destroySession(userId) {
  const s = sessions.get(userId);
  if (!s) return;
  sessions.delete(userId);
  if (s.client) s.client.destroy().catch(() => {});
}

module.exports = { initClient, getStatus, sendMessage, emitter, destroySession };
