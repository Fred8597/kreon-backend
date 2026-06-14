import asyncHandler from "express-async-handler";
import User from "../models/User.js";

// Vérifier le PIN avant une action sensible
export const requirePin = asyncHandler(async (req, res, next) => {
  const { pin } = req.body;

  if (!pin) {
    res.status(400);
    throw new Error("Code PIN requis pour cette action");
  }

  const user = await User.findById(req.user._id);

  if (!user.pin) {
    res.status(400);
    throw new Error("Veuillez d'abord créer un code PIN dans votre profil");
  }

  const valid = await user.comparerPin(pin);

  if (!valid) {
    res.status(400);
    throw new Error("Code PIN incorrect");
  }

  next();
});