import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Recharge from "../models/Recharge.js";
import Withdrawal from "../models/Withdrawal.js";
import { estDansHorairesRetrait } from "../utils/verifierHoraires.js";
import { traiterInvestissementsExpires } from "./investmentController.js";

// @desc    Récupérer le solde
// @route   GET /api/wallet/solde
// @access  Privé
export const getSolde = asyncHandler(async (req, res) => {
  // ✅ Auto-traiter les investissements expirés de cet utilisateur
  await traiterInvestissementsExpires(req.user._id);

  const user = await User.findById(req.user._id).select(
    "soldePrincipal soldeBonus totalGainsParrainage"
  );
  res.json(user);
});

// @desc    Demander une recharge
// @route   POST /api/wallet/recharge
// @access  Privé
export const demanderRecharge = asyncHandler(async (req, res) => {
  const { montant, methode, numeroPayeur, referencePaiement, preuvePaiement } =
    req.body;

  if (!montant || !methode || !numeroPayeur) {
    res.status(400);
    throw new Error("Montant, méthode et numéro requis");
  }

  if (montant < 1000) {
    res.status(400);
    throw new Error("Le montant minimum est de 1000 XAF");
  }

  const recharge = await Recharge.create({
    userId: req.user._id,
    montant,
    methode,
    numeroPayeur,
    referencePaiement,
    preuvePaiement,
  });

  res.status(201).json({
    message: "Demande de recharge envoyée. En attente de validation.",
    recharge,
  });
});

// @desc    Demander un retrait
// @route   POST /api/wallet/withdrawal
// @access  Privé
export const demanderRetrait = asyncHandler(async (req, res) => {
  const { montant, methode, numeroBeneficiaire } = req.body;

  if (!montant || !methode || !numeroBeneficiaire) {
    res.status(400);
    throw new Error("Montant, méthode et numéro requis");
  }

  if (montant < 1000) {
    res.status(400);
    throw new Error("Le montant minimum est de 1000 XAF");
  }

  // ✅ Vérifier les horaires de retrait
  const horaires = estDansHorairesRetrait();
  if (!horaires.autorise) {
    res.status(400);
    throw new Error(horaires.message);
  }

  // ✅ Vérifier le nombre de retraits aujourd'hui
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  const demain = new Date(aujourdhui);
  demain.setDate(demain.getDate() + 1);

  const retraitsAujourdhui = await Withdrawal.countDocuments({
    userId: req.user._id,
    createdAt: { $gte: aujourdhui, $lt: demain },
  });

  if (retraitsAujourdhui >= 2) {
    res.status(400);
    throw new Error(
      "Vous avez atteint la limite de 2 retraits par jour. Réessayez demain."
    );
  }

  const user = await User.findById(req.user._id);

  if (user.soldePrincipal < montant) {
    res.status(400);
    throw new Error("Solde insuffisant");
  }

  // Bloquer le montant
  const soldeAvant = user.soldePrincipal;
  user.soldePrincipal -= montant;
  await user.save();

  // Créer la demande
  const withdrawal = await Withdrawal.create({
    userId: req.user._id,
    montant,
    methode,
    numeroBeneficiaire,
  });

  // Créer la transaction
  await Transaction.create({
    userId: req.user._id,
    type: "RETRAIT",
    montant: -montant,
    soldeAvant,
    soldeApres: user.soldePrincipal,
    description: `Demande de retrait de ${montant} XAF`,
    referenceId: withdrawal._id,
    referenceType: "Withdrawal",
    statut: "EN_ATTENTE",
  });

  res.status(201).json({
    message: "Demande de retrait envoyée. En attente de validation.",
    withdrawal,
  });
});

// @desc    Voir mes recharges
// @route   GET /api/wallet/recharges
// @access  Privé
export const mesRecharges = asyncHandler(async (req, res) => {
  const recharges = await Recharge.find({ userId: req.user._id }).sort({
    createdAt: -1,
  });
  res.json(recharges);
});

// @desc    Voir mes retraits
// @route   GET /api/wallet/withdrawals
// @access  Privé
export const mesRetraits = asyncHandler(async (req, res) => {
  const retraits = await Withdrawal.find({ userId: req.user._id }).sort({
    createdAt: -1,
  });
  res.json(retraits);
});

// @desc    Voir mes transactions
// @route   GET /api/wallet/transactions
// @access  Privé
export const mesTransactions = asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({ userId: req.user._id }).sort({
    createdAt: -1,
  });
  res.json(transactions);
});

// @desc    Statistiques du wallet (pour la page Profil)
// @route   GET /api/wallet/stats
// @access  Privé
export const getStats = asyncHandler(async (req, res) => {
  // Auto-traiter les investissements expirés
  await traiterInvestissementsExpires(req.user._id);

  const user = await User.findById(req.user._id).select(
    "soldePrincipal soldeBonus totalGainsParrainage"
  );

  // Date d'aujourd'hui (minuit)
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  const demain = new Date(aujourdhui);
  demain.setDate(demain.getDate() + 1);

  // ===== Aggregation des transactions =====
  const transactions = await Transaction.find({
    userId: req.user._id,
    statut: "COMPLETEE",
  });

  let totalRecharges = 0;
  let totalRetraits = 0;
  let totalRecompenses = 0; // GAIN_ROI + COMMISSION + BONUS
  let revenuAujourdhui = 0;

  transactions.forEach((tx) => {
    const montantAbs = Math.abs(tx.montant);

    if (tx.type === "RECHARGE") {
      totalRecharges += montantAbs;
    } else if (tx.type === "RETRAIT") {
      totalRetraits += montantAbs;
    } else if (["GAIN_ROI", "COMMISSION", "BONUS"].includes(tx.type)) {
      totalRecompenses += montantAbs;

      // Revenu d'aujourd'hui
      if (tx.createdAt >= aujourdhui && tx.createdAt < demain) {
        revenuAujourdhui += montantAbs;
      }
    }
  });

  // Revenu total = ROI + commissions + bonus
  const revenuTotal = totalRecompenses;

  res.json({
    soldePrincipal: user.soldePrincipal,
    soldeBonus: user.soldeBonus,
    revenuTotal,
    totalRecharges,
    totalRecompenses,
    totalRetraits,
    revenuAujourdhui,
    totalGainsParrainage: user.totalGainsParrainage,
  });
});