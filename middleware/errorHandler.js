import { AppError } from "../lib/errors.js";

export default function errorHandler(err, req, res, _next) {
  if (!(err instanceof AppError) && !err.statusCode) {
    err = new AppError(err.message || "Internal server error", 500);
  }

  const status = err.statusCode || 500;
  const payload = {
    error: err.name || "Error",
    message: err.message || "Internal server error",
  };

  if (err.details) payload.details = err.details;

  if (process.env.NODE_ENV === "development" && status >= 500) {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
}
