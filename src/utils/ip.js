/** Express reports IPv4 clients as "::ffff:1.2.3.4"; store the plain address people recognise. */
const cleanIp = (ip) => String(ip || '').replace(/^::ffff:/, '');

module.exports = { cleanIp };
