import express from "express";
import {
  creerGiftCode,
  getAllGiftCodes,
  toggleGiftCode,
  supprimerGiftCode,
  reclamerGiftCode,
} from "../controllers/giftCodeController.js";
import { protect } from "../middleware/authMiddleware.js";
import { admin } from "../middleware/adminMiddleware.js";

const router = express.Router();

// User
router.post("/reclamer", protect, reclamerGiftCode);

// Admin
router.get("/", protect, admin, getAllGiftCodes);
router.post("/", protect, admin, creerGiftCode);
router.put("/:id/toggle", protect, admin, toggleGiftCode);
router.delete("/:id", protect, admin, supprimerGiftCode);

export default router;