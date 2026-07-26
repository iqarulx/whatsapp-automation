function normalizeNumbers(rawNumbers) {
  const seen = new Set();
  const numbers = [];
  for (const raw of rawNumbers) {
    const digits = String(raw).replace(/[^\d]/g, "");
    if (digits.length >= 8 && !seen.has(digits)) {
      seen.add(digits);
      numbers.push(digits);
    }
  }
  return numbers;
}

module.exports = { normalizeNumbers };
