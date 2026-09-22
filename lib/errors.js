export class AppError extends Error {
  constructor(message, statusCode = 500, details = undefined) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

export function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

export function errorMiddleware(err, req, res, _next) {
  const status = err.statusCode || err.status || 500;
  const payload = {
    error: err.name || "Error",
    message: err.message || "Internal server error",
  };

  if (err.details) {
    payload.details = err.details;
  }

  if (process.env.NODE_ENV === "development" && status >= 500) {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
}
