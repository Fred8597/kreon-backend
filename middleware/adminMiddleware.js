// Vérifie que l'utilisateur est admin
export const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403);
    throw new Error("Accès refusé : admin requis");
  }
};

// Vérifie que l'utilisateur est admin OU modérateur
export const adminOuModerateur = (req, res, next) => {
  if (
    req.user &&
    (req.user.role === "admin" || req.user.role === "moderator")
  ) {
    next();
  } else {
    res.status(403);
    throw new Error("Accès refusé : admin ou modérateur requis");
  }
};