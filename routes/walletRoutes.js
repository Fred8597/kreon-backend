import express from "express";
import {
  getSolde,
  demanderRecharge,
  demanderRetrait,
  mesRecharges,
  mesRetraits,
  mesTransactions,
  getStats,
} from "../controllers/walletController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requirePin } from "../middleware/pinMiddleware.js";

const router = express.Router();

router.get("/solde", protect, getSolde);
router.get("/stats", protect, getStats);
router.post("/recharge", protect, demanderRecharge);
router.post("/withdrawal", protect, requirePin, demanderRetrait); // PIN requis
router.get("/recharges", protect, mesRecharges);
router.get("/withdrawals", protect, mesRetraits);
router.get("/transactions", protect, mesTransactions);

export default router;