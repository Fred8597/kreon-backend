import express from "express";
import {
  getStatutVIP,
  upgradeVIP,
  getHistoriqueSalaire,
} from "../controllers/vipController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/statut", protect, getStatutVIP);
router.post("/upgrade", protect, upgradeVIP);
router.get("/historique-salaire", protect, getHistoriqueSalaire);

export default router;