// Pour les routes qui n'existent pas
export const notFound = (req, res, next) => {
  const error = new Error(`Route non trouvée : ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Pour les erreurs générales
export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};