const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/** Runs after a chain of express-validator checks; turns failures into a 400 ApiError. */
const validate = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const details = result.array().map((err) => ({ field: err.path, message: err.msg }));
  // The first problem, in words a form can show as-is; `details` lists them all.
  const [first] = details;
  const message = first.message && first.message !== 'Invalid value' ? first.message : `Invalid ${first.field}`;
  next(ApiError.badRequest(message, details));
};

module.exports = validate;
