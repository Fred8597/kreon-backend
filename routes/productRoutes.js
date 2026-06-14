import express from "express";
import {
  getProduits,
  getProduitById,
  creerProduit,
  modifierProduit,
  supprimerProduit,
} from "../controllers/productController.js";
import { protect } from "../middleware/authMiddleware.js";
import { admin } from "../middleware/adminMiddleware.js";

const router = express.Router();

// Routes publiques
router.get("/", getProduits);
router.get("/:id", getProduitById);

// Routes admin
router.post("/", protect, admin, creerProduit);
router.put("/:id", protect, admin, modifierProduit);
router.delete("/:id", protect, admin, supprimerProduit);

export default router;