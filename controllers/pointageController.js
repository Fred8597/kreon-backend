import asyncHandler from "express-async-handler";
import DailyCheckin from "../models/DailyCheckin.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { creerNotification } from "../utils/creerNotification.js";
import { getNiveauById } from "../config/vipLevels.js";

const MONTANT_POINTAGE = 50;

const getAujourdhuiRange = () => {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 1);
  return { debut, fin };
};

// @desc    Statut du pointage (avec salaire VIP)
// @route   GET /api/pointage/statut
// @access  Privé
export const getStatutPointage = asyncHandler(async (req, res) => {
  const { debut, fin } = getAujourdhuiRange();

  const user = await User.findById(req.user._id);

  const checkin = await DailyCheckin.findOne({
    userId: req.user._id,
    dateCheckin: { $gte: debut, $lt: fin },
  });

  const totalCheckins = await DailyCheckin.countDocuments({
    userId: req.user._id,
  });
  const totalAgg = await DailyCheckin.aggregate([
    { $match: { userId: req.user._id } },
    { $group: { _id: null, total: { $sum: "$montant" } } },
  ]);
  const totalGagne = totalAgg[0]?.total || 0;

  // ===== SALAIRE VIP =====
  const niveauVIP = getNiveauById(user.niveauVIP);
  const isVIP = user.niveauVIP > 0;
  const isVIPActif = isVIP && user.statutVIP === "ACTIF";
  const salaireVIP = isVIPActif ? niveauVIP.salaireJour : 0;
  const totalAujourdhui = MONTANT_POINTAGE + salaireVIP;

  res.json({
    pointeAujourdhui: !!checkin,
    montantPointage: MONTANT_POINTAGE,
    derniereDate: checkin?.dateCheckin || null,
    totalCheckins,
    totalGagne,
    // VIP
    niveauVIP: user.niveauVIP,
    nomVIP: niveauVIP?.nom || "Normal User",
    statutVIP: user.statutVIP,
    salaireVIP,
    isVIP,
    isVIPActif,
    totalAujourdhui,
  });
});

// @desc    Effectuer le pointage (avec salaire VIP)
// @route   POST /api/pointage
// @access  Privé
export const faireCheckin = asyncHandler(async (req, res) => {
  const { debut, fin } = getAujourdhuiRange();

  const existe = await DailyCheckin.findOne({
    userId: req.user._id,
    dateCheckin: { $gte: debut, $lt: fin },
  });

  if (existe) {
    res.status(400);
    throw new Error("Vous avez déjà pointé aujourd'hui. Revenez demain !");
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error("Utilisateur introuvable");
  }

  // Calcul total = pointage + salaire VIP
  const niveauVIP = getNiveauById(user.niveauVIP);
  const isVIPActif = user.niveauVIP > 0 && user.statutVIP === "ACTIF";
  const salaireVIP = isVIPActif ? niveauVIP.salaireJour : 0;
  const totalCredit = MONTANT_POINTAGE + salaireVIP;

  // Créditer
  const soldeAvant = user.soldePrincipal;
  user.soldePrincipal += totalCredit;
  if (isVIPActif) {
    user.dateDernierSalaireVIP = new Date();
  }
  await user.save();

  // Créer le checkin (montant total)
  const checkin = await DailyCheckin.create({
    userId: req.user._id,
    montant: totalCredit,
  });

  // Transaction pointage de base
  await Transaction.create({
    userId: req.user._id,
    type: "BONUS",
    montant: MONTANT_POINTAGE,
    soldeAvant,
    soldeApres: soldeAvant + MONTANT_POINTAGE,
    description: "Pointage journalier",
    referenceId: checkin._id,
    statut: "COMPLETEE",
  });

  // Transaction salaire VIP (si applicable)
  if (salaireVIP > 0) {
    await Transaction.create({
      userId: req.user._id,
      type: "BONUS",
      montant: salaireVIP,
      soldeAvant: soldeAvant + MONTANT_POINTAGE,
      soldeApres: user.soldePrincipal,
      description: `Salaire VIP journalier (${niveauVIP.nom})`,
      referenceId: checkin._id,
      statut: "COMPLETEE",
    });
  }

  // Notification
  let message = `+${MONTANT_POINTAGE} XAF de pointage`;
  if (salaireVIP > 0) {
    message += ` + ${salaireVIP} XAF salaire ${niveauVIP.nom}`;
  }
  message += ` = ${totalCredit} XAF crédités !`;

  await creerNotification({
    userId: req.user._id,
    type: "POINTAGE",
    titre: "📅 Pointage validé",
    message,
    montant: totalCredit,
  });

  res.json({
    message: `+${totalCredit} XAF crédités ! Revenez demain.`,
    montant: totalCredit,
    montantPointage: MONTANT_POINTAGE,
    salaireVIP,
    soldeApres: user.soldePrincipal,
    checkin,
  });
});

// @desc    Historique
// @route   GET /api/pointage/historique
// @access  Privé
export const getHistorique = asyncHandler(async (req, res) => {
  const checkins = await DailyCheckin.find({ userId: req.user._id })
    .sort({ dateCheckin: -1 })
    .limit(30);
  res.json(checkins);
});