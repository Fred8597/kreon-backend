import asyncHandler from "express-async-handler";
import DailyCheckin from "../models/DailyCheckin.js";
import User from "../models/User.js";
import Investment from "../models/Investment.js";
import Transaction from "../models/Transaction.js";
import { creerNotification } from "../utils/creerNotification.js";
import { getNiveauById } from "../config/vipLevels.js";

const MONTANT_POINTAGE = 50;
const LIMITE_POINTAGES_SANS_INVEST = 10;
const SEUIL_AVERTISSEMENT = 8;

const getAujourdhuiRange = () => {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 1);
  return { debut, fin };
};

// ===== HELPER : Calculer le compteur de pointages valides =====
// Retourne :
// - hasActiveInvest : true si un invest est encore actif
// - compteur : nb de pointages depuis le dernier invest (terminé)
// - peutPointer : true/false
// - pointagesRestants : combien il en reste avant blocage
const calculerStatutPointages = async (userId) => {
  // 1. Vérifier s'il y a un investissement ACTIF
  const investActif = await Investment.findOne({
    userId,
    statut: "ACTIF",
  });

  if (investActif) {
    // Si un invest est actif → pointages illimités
    return {
      hasActiveInvest: true,
      compteur: 0,
      peutPointer: true,
      pointagesRestants: Infinity,
      limite: LIMITE_POINTAGES_SANS_INVEST,
    };
  }

  // 2. Trouver le dernier investissement TERMINÉ (ou ANNULÉ)
  const dernierInvest = await Investment.findOne({
    userId,
    statut: { $in: ["TERMINE", "ANNULE"] },
  }).sort({ dateCompletion: -1, createdAt: -1 });

  // Date de référence : fin du dernier invest (si existe) sinon date d'inscription
  let dateReference;
  if (dernierInvest) {
    dateReference =
      dernierInvest.dateCompletion ||
      dernierInvest.dateExpiration ||
      dernierInvest.updatedAt;
  } else {
    // Pas d'invest → on prend la date d'inscription
    const user = await User.findById(userId).select("createdAt");
    dateReference = user.createdAt;
  }

  // 3. Compter les pointages depuis cette date
  const compteur = await DailyCheckin.countDocuments({
    userId,
    dateCheckin: { $gte: dateReference },
  });

  const pointagesRestants = Math.max(0, LIMITE_POINTAGES_SANS_INVEST - compteur);
  const peutPointer = compteur < LIMITE_POINTAGES_SANS_INVEST;

  return {
    hasActiveInvest: false,
    compteur,
    peutPointer,
    pointagesRestants,
    limite: LIMITE_POINTAGES_SANS_INVEST,
  };
};

// @desc    Statut du pointage (avec limite + salaire VIP)
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

  // ===== LIMITE POINTAGES =====
  const statutPointages = await calculerStatutPointages(req.user._id);

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
    // LIMITE
    limitePointages: statutPointages,
  });
});

// @desc    Effectuer le pointage (avec vérif limite)
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

  // ===== VÉRIFIER LA LIMITE =====
  const statutPointages = await calculerStatutPointages(req.user._id);

  if (!statutPointages.peutPointer) {
    res.status(403);
    throw new Error(
      `Limite de ${LIMITE_POINTAGES_SANS_INVEST} pointages atteinte. Investissez sur un produit pour continuer à pointer.`
    );
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

  // Créer le checkin
  const checkin = await DailyCheckin.create({
    userId: req.user._id,
    montant: totalCredit,
  });

  // Transaction pointage
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

  // Transaction salaire VIP
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

  // Notification de base
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

  // ===== AVERTISSEMENT SI PROCHE DE LA LIMITE =====
  // On recalcule après le pointage
  const nouveauStatut = await calculerStatutPointages(req.user._id);

  if (!nouveauStatut.hasActiveInvest && nouveauStatut.compteur >= SEUIL_AVERTISSEMENT) {
    const restants = nouveauStatut.pointagesRestants;

    if (restants === 0) {
      await creerNotification({
        userId: req.user._id,
        type: "SYSTEM",
        titre: "🚫 Limite pointage atteinte",
        message: `Vous avez atteint la limite de ${LIMITE_POINTAGES_SANS_INVEST} pointages sans investissement. Investissez sur un produit pour continuer.`,
        lien: "/",
      });
    } else {
      await creerNotification({
        userId: req.user._id,
        type: "SYSTEM",
        titre: "⚠️ Attention : limite proche",
        message: `Plus que ${restants} pointage${restants > 1 ? "s" : ""} sans investissement. Pensez à investir pour ne pas perdre l'accès au pointage.`,
        lien: "/",
      });
    }
  }

  res.json({
    message: `+${totalCredit} XAF crédités ! Revenez demain.`,
    montant: totalCredit,
    montantPointage: MONTANT_POINTAGE,
    salaireVIP,
    soldeApres: user.soldePrincipal,
    checkin,
    limitePointages: nouveauStatut,
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