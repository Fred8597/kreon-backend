import express from "express";
import {
  inscription,
  connexion,
  getProfile,
  definirPin,
  modifierPin,
  verifierPin,
  statutPin,
  updateMobileMoney,
  getMobileMoney,
  updateProfile,
  getMonEquipe,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", inscription);
router.post("/login", connexion);

// Profil
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);

// PIN
router.post("/pin", protect, definirPin);
router.put("/pin", protect, modifierPin);
router.post("/pin/verifier", protect, verifierPin);
router.get("/pin/statut", protect, statutPin);

// Mobile Money
router.get("/mobile-money", protect, getMobileMoney);
router.put("/mobile-money", protect, updateMobileMoney);

// Équipe (parrainage)
router.get("/mon-equipe", protect, getMonEquipe);

export default router;