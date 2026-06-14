import express from "express";
import {
  getStatutCoffre,
  getHistoriqueCoffres,
} from "../controllers/coffreController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/statut", protect, getStatutCoffre);
router.get("/historique", protect, getHistoriqueCoffres);

export default router;