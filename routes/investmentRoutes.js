import express from "express";
import {
  investir,
  mesInvestissements,
  getInvestment,
} from "../controllers/investmentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requirePin } from "../middleware/pinMiddleware.js";

const router = express.Router();

router.post("/", protect, requirePin, investir); // PIN requis
router.get("/", protect, mesInvestissements);
router.get("/:id", protect, getInvestment);

export default router;