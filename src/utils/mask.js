/** Masks a secret (API key, etc.) for display, keeping only the first/last few characters. */
const maskKey = (key) => {
  if (!key) return '';
  const str = String(key);
  if (str.length <= 8) return '••••••••';
  return `${str.slice(0, 4)}••••${str.slice(-4)}`;
};

module.exports = { maskKey };
