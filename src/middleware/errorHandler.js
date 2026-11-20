export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}
export function errorHandler(err, _req, res, _next) {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    message: status === 500 ? "Internal server error." : err.message,
    ...(process.env.NODE_ENV === "development" && status === 500 ? { detail: err.message } : {})
  });
}
