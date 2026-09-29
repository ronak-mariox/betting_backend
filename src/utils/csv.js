/** Minimal dependency-free CSV serializer for flat row objects. */
const escapeCell = (value) => {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const toCsv = (rows, columns) => {
  const header = columns.join(',');
  const lines = rows.map((row) => columns.map((col) => escapeCell(row[col])).join(','));
  return [header, ...lines].join('\n');
};

module.exports = { toCsv };
