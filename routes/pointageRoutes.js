import express from "express";
import {
  getStatutPointage,
  faireCheckin,
  getHistorique,
} from "../controllers/pointageController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/statut", protect, getStatutPointage);
router.post("/", protect, faireCheckin);
router.get("/historique", protect, getHistorique);

export default router;