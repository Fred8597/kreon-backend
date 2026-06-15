import express from "express";
import {
  getAllRecharges,
  validerRecharge,
  refuserRecharge,
  getAllWithdrawals,
  validerRetrait,
  refuserRetrait,
} from "../controllers/adminWalletController.js";
import {
  getDashboard,
  getAllUsers,
  getUserById,
  modifierRole,
  toggleStatutUser,
  modifierSolde,
  getCompteurAdminNotifs,
  getApercuTaches,
} from "../controllers/adminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { admin } from "../middleware/adminMiddleware.js";

const router = express.Router();

// Dashboard
router.get("/dashboard", protect, admin, getDashboard);

// Notifications admin (cloche)
router.get("/notifications/compteur", protect, admin, getCompteurAdminNotifs);
router.get("/notifications/apercu", protect, admin, getApercuTaches);

// Gestion utilisateurs
router.get("/users", protect, admin, getAllUsers);
router.get("/users/:id", protect, admin, getUserById);
router.put("/users/:id/role", protect, admin, modifierRole);
router.put("/users/:id/statut", protect, admin, toggleStatutUser);
router.put("/users/:id/solde", protect, admin, modifierSolde);

// Recharges
router.get("/recharges", protect, admin, getAllRecharges);
router.put("/recharges/:id/valider", protect, admin, validerRecharge);
router.put("/recharges/:id/refuser", protect, admin, refuserRecharge);

// Retraits
router.get("/withdrawals", protect, admin, getAllWithdrawals);
router.put("/withdrawals/:id/valider", protect, admin, validerRetrait);
router.put("/withdrawals/:id/refuser", protect, admin, refuserRetrait);

export default router;