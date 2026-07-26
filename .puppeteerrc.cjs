const path = require("path");

// Pin Chrome's download location to a fixed, project-local folder instead of
// relying on Puppeteer's OS/environment-dependent default resolution. Some
// hosting setups (e.g. shared hosting process runners) don't expose a
// reliable $HOME to the app process, which caused Puppeteer to look for
// Chrome in a different folder than where it actually got installed.
module.exports = {
  cacheDirectory: path.join(__dirname, ".cache", "puppeteer"),
};
