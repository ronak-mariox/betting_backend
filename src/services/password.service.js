const bcrypt = require('bcrypt');
const env = require('../config/env');

const hashPassword = (plainPassword) => bcrypt.hash(plainPassword, env.bcryptSaltRounds);

const verifyPassword = (plainPassword, passwordHash) => bcrypt.compare(plainPassword, passwordHash);

module.exports = { hashPassword, verifyPassword };
