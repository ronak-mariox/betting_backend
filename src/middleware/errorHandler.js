const ApiError = require('../utils/ApiError');

const notFound = (req, _res, next) => {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, details: err.details },
    });
  }

  if (err.name === 'ValidationError') {
    // Mongoose schema validation error.
    return res.status(400).json({ error: { message: err.message } });
  }

  if (err.name === 'CastError') {
    // Malformed ObjectId (or similar) passed as a path/query param.
    return res.status(400).json({ error: { message: `Invalid value for "${err.path}"` } });
  }

  if (err.code === 11000) {
    return res.status(409).json({ error: { message: 'That value is already in use' } });
  }

  console.error(err); // eslint-disable-line no-console
  const status = err.statusCode || 500;
  res.status(status).json({
    error: { message: status === 500 ? 'Internal server error' : err.message },
  });
};

module.exports = { notFound, errorHandler };
