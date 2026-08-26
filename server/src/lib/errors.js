/** One error shape for the whole API, so the client only parses one thing. */
export class HttpError extends Error {
  constructor(status, message, fields = null) {
    super(message); this.status = status; this.fields = fields;
  }
}

export const notFound     = (what = 'Resource') => new HttpError(404, `${what} not found.`);
export const badRequest   = (message, fields)   => new HttpError(400, message, fields);
export const conflict     = (message)           => new HttpError(409, message);
export const unauthorized = (m = 'You need to sign in to do that.') => new HttpError(401, m);
export const forbidden    = (m = 'Your account cannot do that.')    => new HttpError(403, m);

export function errorHandler(err, _req, res, _next) {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: {
      message: status >= 500 ? 'Something broke at our end. Try again shortly.' : err.message,
      fields: err.fields ?? undefined,
    },
  });
}

export const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
