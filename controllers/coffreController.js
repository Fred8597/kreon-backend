import asyncHandler from "express-async-handler";
import TreasureChest from "../models/TreasureChest.js";
import User from "../models/User.js";
import Investment from "../models/Investment.js";

// ===== GRILLE DES COFFRES =====
const COFFRES = [
  { palier: 1, montant: 500 },
  { palier: 3, montant: 1500 },
  { palier: 5, montant: 2500 },
  { palier: 10, montant: 6000 },
  { palier: 15, montant: 15000 },
  { palier: 20, montant: 35000 },
];

// Helper
const getAujourdhuiRange = () => {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 1);
  return { debut, fin };
};

// Compter les invités QUALIFIÉS (inscrits aujourd'hui ET ayant investi)
const compterInvitesQualifies = async (parrainId) => {
  const { debut, fin } = getAujourdhuiRange();

  const filleulsAujourdhui = await User.find({
    parrainId,
    createdAt: { $gte: debut, $lt: fin },
  }).select("_id");

  if (filleulsAujourdhui.length === 0) return 0;

  const filleulsIds = filleulsAujourdhui.map((f) => f._id);
  const investisseursIds = await Investment.distinct("userId", {
    userId: { $in: filleulsIds },
  });

  return investisseursIds.length;
};

// @desc    Statut du coffre du jour
// @route   GET /api/coffre/statut
// @access  Privé
export const getStatutCoffre = asyncHandler(async (req, res) => {
  const { debut, fin } = getAujourdhuiRange();

  const invitesAujourdhui = await compterInvitesQualifies(req.user._id);

  // Coffres déjà crédités aujourd'hui
  const coffresOuverts = await TreasureChest.find({
    userId: req.user._id,
    dateOuverture: { $gte: debut, $lt: fin },
  });
  const paliersOuverts = coffresOuverts.map((c) => c.palier);

  // Liste avec statut
  const coffresAvecStatut = COFFRES.map((c) => ({
    palier: c.palier,
    montant: c.montant,
    credite: paliersOuverts.includes(c.palier),
    debloque: invitesAujourdhui >= c.palier,
  }));

  const gagneAujourdhui = coffresOuverts.reduce((sum, c) => sum + c.montant, 0);

  // Stats globales
  const totalCoffresOuverts = await TreasureChest.countDocuments({
    userId: req.user._id,
  });
  const totalAgg = await TreasureChest.aggregate([
    { $match: { userId: req.user._id } },
    { $group: { _id: null, total: { $sum: "$montant" } } },
  ]);
  const totalGagne = totalAgg[0]?.total || 0;

  // Total filleuls du jour (qualifiés OU non) pour info
  const filleulsTotalAujourdhui = await User.countDocuments({
    parrainId: req.user._id,
    createdAt: { $gte: debut, $lt: fin },
  });

  res.json({
    invitesAujourdhui, // qualifiés (ayant investi)
    filleulsTotalAujourdhui, // tous les inscrits du jour
    coffres: coffresAvecStatut,
    gagneAujourdhui,
    totalCoffresOuverts,
    totalGagne,
  });
});

// @desc    Historique
// @route   GET /api/coffre/historique
// @access  Privé
export const getHistoriqueCoffres = asyncHandler(async (req, res) => {
  const coffres = await TreasureChest.find({ userId: req.user._id })
    .sort({ dateOuverture: -1 })
    .limit(30);
  res.json(coffres);
});