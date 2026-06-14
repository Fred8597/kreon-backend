import express from "express";
import {
  getMesNotifications,
  getCompteurNonLues,
  marquerLue,
  marquerToutesLues,
  supprimerNotification,
  supprimerToutesLues,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getMesNotifications);
router.get("/compteur", protect, getCompteurNonLues);
router.put("/lues", protect, marquerToutesLues);
router.put("/:id/lue", protect, marquerLue);
router.delete("/lues", protect, supprimerToutesLues);
router.delete("/:id", protect, supprimerNotification);

export default router;