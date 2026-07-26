/**
 * Google OAuth + Contacts (People API), scoped per user. Tokens live in the
 * google_tokens table and contacts are cached in the contacts table so a
 * dashboard visit never has to hit the Google API unless the user asks for
 * a refresh.
 */
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const tokenStore = require("./googleTokens");
const contactsStore = require("./contactsStore");

const ROOT = path.join(__dirname, "..");
const SCOPES = ["https://www.googleapis.com/auth/contacts.readonly"];

function loadClientCredentials() {
  const file = fs
    .readdirSync(ROOT)
    .find((f) => f.startsWith("client_secret_") && f.endsWith(".json"));
  if (!file) {
    throw new Error("Google client secret JSON file not found in project root");
  }
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
  return raw.web || raw.installed;
}

function createOAuthClient() {
  const creds = loadClientCredentials();
  // const redirectUri = (creds.redirect_uris && creds.redirect_uris[0]) ||
  //   "http://localhost:3000/callback";
  const redirectUri = (creds.redirect_uris && creds.redirect_uris[0]) ||
      "https://whatsapp.dtsbilling.in/callback";
  return new google.auth.OAuth2(creds.client_id, creds.client_secret, redirectUri);
}

function getStatus(userId) {
  const tokens = tokenStore.getTokens(userId);
  return { connected: !!(tokens && (tokens.refresh_token || tokens.access_token)) };
}

// `state` carries the user id through the Google redirect so /callback can
// verify it matches the session that initiated the request.
function getAuthUrl(userId) {
  const oAuth2Client = createOAuthClient();
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: String(userId),
  });
}

async function handleCallback(userId, code) {
  const oAuth2Client = createOAuthClient();
  const { tokens } = await oAuth2Client.getToken(code);
  tokenStore.saveTokens(userId, tokens);
  return tokens;
}

async function getAuthenticatedClient(userId) {
  const tokens = tokenStore.getTokens(userId);
  if (!tokens) throw new Error("Google account is not connected");
  const oAuth2Client = createOAuthClient();
  oAuth2Client.setCredentials(tokens);
  oAuth2Client.on("tokens", (newTokens) => {
    tokenStore.saveTokens(userId, newTokens);
  });
  return oAuth2Client;
}

function normalizePhone(raw) {
  return raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
}

async function fetchContactsFromGoogle(userId) {
  const auth = await getAuthenticatedClient(userId);
  const people = google.people({ version: "v1", auth });

  const contacts = [];
  let pageToken;
  do {
    const res = await people.people.connections.list({
      resourceName: "people/me",
      pageSize: 1000,
      personFields: "names,phoneNumbers",
      pageToken,
    });
    for (const person of res.data.connections || []) {
      const name =
        (person.names && person.names[0] && person.names[0].displayName) ||
        "Unknown";
      for (const ph of person.phoneNumbers || []) {
        const value = ph.canonicalForm || ph.value;
        if (!value) continue;
        contacts.push({ name, phone: normalizePhone(value) });
      }
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return contacts;
}

// Cache-first: only calls the Google API when there's nothing cached yet,
// or when the caller explicitly asks for a refresh.
async function getContacts(userId, { forceRefresh = false } = {}) {
  if (!forceRefresh && contactsStore.hasContacts(userId)) {
    return contactsStore.getContacts(userId);
  }
  const fresh = await fetchContactsFromGoogle(userId);
  contactsStore.saveContacts(userId, fresh);
  return contactsStore.getContacts(userId);
}

module.exports = { getStatus, getAuthUrl, handleCallback, getContacts };
