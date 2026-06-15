import express from "express";
import {
  getPublicSettings,
  getSettings,
  updateSettings,
} from "../controllers/settingsController.js";
import { protect } from "../middleware/authMiddleware.js";
import { admin } from "../middleware/adminMiddleware.js";

const router = express.Router();

router.get("/public", protect, getPublicSettings);
router.get("/", protect, admin, getSettings);
router.put("/", protect, admin, updateSettings);

export default router;