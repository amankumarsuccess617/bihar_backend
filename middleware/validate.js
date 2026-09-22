import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

/**
 * Express middleware factory that validates req.body / req.params / req.query
 * against a Zod schema before controller logic runs.
 */
export function validate(schema, source = "body") {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(
          new AppError("Validation failed", 400, err.flatten())
        );
      }
      return next(err);
    }
  };
}
