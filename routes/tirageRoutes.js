import express from "express";
import {
  getStatutTirage,
  tournerRoue,
  accorderTirage,
  getAllGrants,
  annulerGrant,
  supprimerGrant,
} from "../controllers/tirageController.js";
import { protect } from "../middleware/authMiddleware.js";
import { admin } from "../middleware/adminMiddleware.js";

const router = express.Router();

// User
router.get("/statut", protect, getStatutTirage);
router.post("/tourner", protect, tournerRoue);

// Admin
router.get("/admin/grants", protect, admin, getAllGrants);
router.post("/admin/accorder", protect, admin, accorderTirage);
router.put("/admin/grants/:id/annuler", protect, admin, annulerGrant);
router.delete("/admin/grants/:id", protect, admin, supprimerGrant);

export default router;