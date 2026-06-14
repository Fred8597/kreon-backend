import express from "express";
import {
  getAllNews,
  getNewsById,
  creerNews,
  modifierNews,
  supprimerNews,
} from "../controllers/newsController.js";
import { protect } from "../middleware/authMiddleware.js";
import { admin } from "../middleware/adminMiddleware.js";

const router = express.Router();

// Public
router.get("/", getAllNews);
router.get("/:id", getNewsById);

// Admin
router.post("/", protect, admin, creerNews);
router.put("/:id", protect, admin, modifierNews);
router.delete("/:id", protect, admin, supprimerNews);

export default router;