/** Escapes user input so it matches literally inside a RegExp. */
module.exports = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
