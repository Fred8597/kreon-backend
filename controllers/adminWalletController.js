import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Recharge from "../models/Recharge.js";
import Withdrawal from "../models/Withdrawal.js";
import { creerNotification } from "../utils/creerNotification.js";

// @desc    Voir toutes les recharges (admin)
// @route   GET /api/admin/recharges
// @access  Admin
export const getAllRecharges = asyncHandler(async (req, res) => {
  const { statut } = req.query;
  const filter = statut ? { statut } : {};

  const recharges = await Recharge.find(filter)
    .populate("userId", "nom email telephone")
    .sort({ createdAt: -1 });

  res.json(recharges);
});

// @desc    Valider une recharge (admin)
// @route   PUT /api/admin/recharges/:id/valider
// @access  Admin
export const validerRecharge = asyncHandler(async (req, res) => {
  const recharge = await Recharge.findById(req.params.id);

  if (!recharge) {
    res.status(404);
    throw new Error("Recharge non trouvée");
  }

  if (recharge.statut !== "EN_ATTENTE") {
    res.status(400);
    throw new Error("Cette recharge a déjà été traitée");
  }

  // Créditer le solde de l'utilisateur
  const user = await User.findById(recharge.userId);
  const soldeAvant = user.soldePrincipal;
  user.soldePrincipal += recharge.montant;
  await user.save();

  // Mettre à jour la recharge
  recharge.statut = "VALIDEE";
  recharge.valideePar = req.user._id;
  recharge.dateValidation = new Date();
  await recharge.save();

  // Créer une transaction
  await Transaction.create({
    userId: user._id,
    type: "RECHARGE",
    montant: recharge.montant,
    soldeAvant,
    soldeApres: user.soldePrincipal,
    description: `Recharge validée (${recharge.methode})`,
    referenceId: recharge._id,
    referenceType: "Recharge",
    statut: "COMPLETEE",
  });

  // 🔔 Notification
  await creerNotification({
    userId: user._id,
    type: "RECHARGE_VALIDEE",
    titre: "✅ Recharge validée",
    message: `Votre recharge de ${recharge.montant} XAF (${recharge.methode}) a été créditée sur votre compte.`,
    lien: "/recharges",
    montant: recharge.montant,
  });

  res.json({ message: "Recharge validée avec succès", recharge });
});

// @desc    Refuser une recharge (admin)
// @route   PUT /api/admin/recharges/:id/refuser
// @access  Admin
export const refuserRecharge = asyncHandler(async (req, res) => {
  const { commentaire } = req.body;
  const recharge = await Recharge.findById(req.params.id);

  if (!recharge) {
    res.status(404);
    throw new Error("Recharge non trouvée");
  }

  if (recharge.statut !== "EN_ATTENTE") {
    res.status(400);
    throw new Error("Cette recharge a déjà été traitée");
  }

  recharge.statut = "REFUSEE";
  recharge.commentaireAdmin = commentaire || "Refusé par l'administrateur";
  recharge.valideePar = req.user._id;
  recharge.dateValidation = new Date();
  await recharge.save();

  // 🔔 Notification
  await creerNotification({
    userId: recharge.userId,
    type: "RECHARGE_REFUSEE",
    titre: "❌ Recharge refusée",
    message: `Votre recharge de ${recharge.montant} XAF a été refusée. ${
      recharge.commentaireAdmin ? `Raison : ${recharge.commentaireAdmin}` : ""
    }`,
    lien: "/recharges",
    montant: recharge.montant,
  });

  res.json({ message: "Recharge refusée", recharge });
});

// @desc    Voir tous les retraits (admin)
// @route   GET /api/admin/withdrawals
// @access  Admin
export const getAllWithdrawals = asyncHandler(async (req, res) => {
  const { statut } = req.query;
  const filter = statut ? { statut } : {};

  const retraits = await Withdrawal.find(filter)
    .populate("userId", "nom email telephone")
    .sort({ createdAt: -1 });

  res.json(retraits);
});

// @desc    Valider un retrait (admin)
// @route   PUT /api/admin/withdrawals/:id/valider
// @access  Admin
export const validerRetrait = asyncHandler(async (req, res) => {
  const { referencePaiement } = req.body;
  const retrait = await Withdrawal.findById(req.params.id);

  if (!retrait) {
    res.status(404);
    throw new Error("Retrait non trouvé");
  }

  if (retrait.statut !== "EN_ATTENTE") {
    res.status(400);
    throw new Error("Ce retrait a déjà été traité");
  }

  retrait.statut = "PAYEE";
  retrait.referencePaiement = referencePaiement || "";
  retrait.valideePar = req.user._id;
  retrait.dateValidation = new Date();
  await retrait.save();

  // Mettre à jour la transaction associée
  await Transaction.findOneAndUpdate(
    { referenceId: retrait._id, referenceType: "Withdrawal" },
    { statut: "COMPLETEE" }
  );

  // 🔔 Notification
  await creerNotification({
    userId: retrait.userId,
    type: "RETRAIT_PAYE",
    titre: "💸 Retrait payé",
    message: `Votre retrait de ${retrait.montant} XAF vers ${retrait.numeroBeneficiaire} (${retrait.methode}) a été payé. ${
      referencePaiement ? `Référence : ${referencePaiement}` : ""
    }`,
    lien: "/retraits",
    montant: retrait.montant,
  });

  res.json({ message: "Retrait validé et payé", retrait });
});

// @desc    Refuser un retrait (admin) - rembourse l'utilisateur
// @route   PUT /api/admin/withdrawals/:id/refuser
// @access  Admin
export const refuserRetrait = asyncHandler(async (req, res) => {
  const { commentaire } = req.body;
  const retrait = await Withdrawal.findById(req.params.id);

  if (!retrait) {
    res.status(404);
    throw new Error("Retrait non trouvé");
  }

  if (retrait.statut !== "EN_ATTENTE") {
    res.status(400);
    throw new Error("Ce retrait a déjà été traité");
  }

  // Rembourser l'utilisateur
  const user = await User.findById(retrait.userId);
  const soldeAvant = user.soldePrincipal;
  user.soldePrincipal += retrait.montant;
  await user.save();

  // Mettre à jour le retrait
  retrait.statut = "REFUSEE";
  retrait.commentaireAdmin = commentaire || "Refusé par l'administrateur";
  retrait.valideePar = req.user._id;
  retrait.dateValidation = new Date();
  await retrait.save();

  // Créer une transaction de remboursement
  await Transaction.create({
    userId: user._id,
    type: "REMBOURSEMENT",
    montant: retrait.montant,
    soldeAvant,
    soldeApres: user.soldePrincipal,
    description: `Remboursement retrait refusé`,
    referenceId: retrait._id,
    referenceType: "Withdrawal",
    statut: "COMPLETEE",
  });

  // Annuler l'ancienne transaction
  await Transaction.findOneAndUpdate(
    { referenceId: retrait._id, referenceType: "Withdrawal", type: "RETRAIT" },
    { statut: "ANNULEE" }
  );

  // 🔔 Notification
  await creerNotification({
    userId: user._id,
    type: "RETRAIT_REFUSE",
    titre: "↩️ Retrait refusé et remboursé",
    message: `Votre retrait de ${retrait.montant} XAF a été refusé. Le montant a été recrédité sur votre solde. ${
      retrait.commentaireAdmin ? `Raison : ${retrait.commentaireAdmin}` : ""
    }`,
    lien: "/retraits",
    montant: retrait.montant,
  });

  res.json({ message: "Retrait refusé et utilisateur remboursé", retrait });
});