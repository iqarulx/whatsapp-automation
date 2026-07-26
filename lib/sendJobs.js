/**
 * Runs a bulk-send job in the background and emits per-number progress
 * events so an SSE route can stream them to the browser in real time.
 */
const crypto = require("crypto");
const { EventEmitter } = require("events");
const whatsapp = require("./whatsapp");

const MIN_DELAY_MS = 5000;
const MAX_DELAY_MS = 8000;

const jobs = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay() {
  return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
}

function createJob(userId, message, numbers) {
  const id = crypto.randomUUID();
  const job = {
    id,
    userId,
    message,
    numbers,
    events: [],
    sent: [],
    failed: [],
    done: false,
    emitter: new EventEmitter(),
  };
  jobs.set(id, job);
  runJob(job);
  return id;
}

function record(job, event) {
  job.events.push(event);
  job.emitter.emit("event", event);
}

async function runJob(job) {
  for (const number of job.numbers) {
    try {
      await whatsapp.sendMessage(job.userId, number, job.message);
      job.sent.push(number);
      record(job, { type: "sent", number });
    } catch (err) {
      job.failed.push(number);
      record(job, { type: "failed", number, reason: err.message });
    }
    await sleep(randomDelay());
  }
  job.done = true;
  record(job, { type: "done", sent: job.sent, failed: job.failed });
}

function getJob(id) {
  return jobs.get(id);
}

module.exports = { createJob, getJob };
