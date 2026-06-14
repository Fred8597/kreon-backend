import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/User.js";

// Protéger les routes : vérifie qu'un user est connecté
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // 1. Récupérer le token depuis le header Authorization
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      // 2. Vérifier la validité du token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. Récupérer l'utilisateur (sans le password)
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        res.status(401);
        throw new Error("Utilisateur introuvable");
      }

      next();
    } catch (error) {
      res.status(401);
      throw new Error("Token invalide ou expiré");
    }
  }

  if (!token) {
    res.status(401);
    throw new Error("Non autorisé, token manquant");
  }
});