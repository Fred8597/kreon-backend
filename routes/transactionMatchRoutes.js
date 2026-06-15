import express from "express";
import {
  importerReferences,
  getReferences,
  getStatsReferences,
  supprimerReference,
} from "../controllers/transactionMatchController.js";
import { protect } from "../middleware/authMiddleware.js";
import { admin } from "../middleware/adminMiddleware.js";

const router = express.Router();

router.get("/", protect, admin, getReferences);
router.get("/stats", protect, admin, getStatsReferences);
router.post("/import", protect, admin, importerReferences);
router.delete("/:id", protect, admin, supprimerReference);

export default router;