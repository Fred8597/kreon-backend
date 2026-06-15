import asyncHandler from "express-async-handler";
import TirageGrant from "../models/TirageGrant.js";
import TirageHistorique from "../models/TirageHistorique.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { creerNotification } from "../utils/creerNotification.js";

// ============================================
// ===== USER =====
// ============================================

// @desc    Statut du tirage (mes tours dispo + historique)
// @route   GET /api/tirage/statut
// @access  Privé
export const getStatutTirage = asyncHandler(async (req, res) => {
  const grants = await TirageGrant.find({
    userId: req.user._id,
    statut: "ACTIF",
  }).sort({ createdAt: 1 });

  let toursRestants = 0;
  for (const g of grants) {
    const restants = g.montants.length - g.indexCourant;
    toursRestants += restants;
  }

  const totalTours = await TirageHistorique.countDocuments({
    userId: req.user._id,
  });
  const totalAgg = await TirageHistorique.aggregate([
    { $match: { userId: req.user._id } },
    { $group: { _id: null, total: { $sum: "$montant" } } },
  ]);
  const totalGagne = totalAgg[0]?.total || 0;

  const historique = await TirageHistorique.find({ userId: req.user._id })
    .sort({ dateTour: -1 })
    .limit(20);

  res.json({
    toursRestants,
    // ❌ prochaineMontant SUPPRIMÉ - on ne révèle plus à l'avance
    totalTours,
    totalGagne,
    historique,
  });
});

// @desc    Tourner la roue
// @route   POST /api/tirage/tourner
// @access  Privé
export const tournerRoue = asyncHandler(async (req, res) => {
  const grant = await TirageGrant.findOne({
    userId: req.user._id,
    statut: "ACTIF",
  }).sort({ createdAt: 1 });

  if (!grant) {
    res.status(400);
    throw new Error("Aucun tour disponible. Demandez à l'admin de vous en accorder.");
  }

  if (grant.indexCourant >= grant.montants.length) {
    grant.statut = "TERMINE";
    await grant.save();
    res.status(400);
    throw new Error("Ce grant est terminé. Demandez à l'admin d'en accorder un nouveau.");
  }

  const montantGagne = grant.montants[grant.indexCourant];

  const user = await User.findById(req.user._id);
  const soldeAvant = user.soldePrincipal;
  user.soldePrincipal += montantGagne;
  await user.save();

  grant.indexCourant += 1;
  grant.toursUtilises += 1;
  if (grant.indexCourant >= grant.montants.length) {
    grant.statut = "TERMINE";
  }
  await grant.save();

  const tour = await TirageHistorique.create({
    userId: req.user._id,
    grantId: grant._id,
    montant: montantGagne,
  });

  await Transaction.create({
    userId: req.user._id,
    type: "BONUS",
    montant: montantGagne,
    soldeAvant,
    soldeApres: user.soldePrincipal,
    description: `Tirage Roue Fortune (gain : ${montantGagne} XAF)`,
    referenceId: tour._id,
    statut: "COMPLETEE",
  });

  await creerNotification({
    userId: req.user._id,
    type: "TIRAGE_GAIN",
    titre: "🎰 Tirage gagnant !",
    message: `Vous avez gagné ${montantGagne} XAF à la roue de la fortune !`,
    lien: "/tirage",
    montant: montantGagne,
  });

  res.json({
    message: `🎉 +${montantGagne} XAF !`,
    montant: montantGagne,
    soldeApres: user.soldePrincipal,
    toursRestants: grant.montants.length - grant.indexCourant,
  });
});

// ============================================
// ===== ADMIN =====
// ============================================

export const accorderTirage = asyncHandler(async (req, res) => {
  const { userId, montants, note } = req.body;

  if (!userId || !montants || !Array.isArray(montants) || montants.length === 0) {
    res.status(400);
    throw new Error("userId et tableau de montants requis");
  }

  const tousValides = montants.every((m) => Number.isFinite(m) && m > 0);
  if (!tousValides) {
    res.status(400);
    throw new Error("Tous les montants doivent être > 0");
  }

  const user = await User.findById(userId);
  if (!user) {
    res.status(404);
    throw new Error("Utilisateur introuvable");
  }

  const grant = await TirageGrant.create({
    userId,
    montants,
    note: note || "",
    creePar: req.user._id,
  });

  await creerNotification({
    userId,
    type: "TIRAGE_GAIN",
    titre: "🎰 Tirage débloqué !",
    message: `Vous avez ${montants.length} tour${montants.length > 1 ? "s" : ""} disponible${montants.length > 1 ? "s" : ""} à la roue de la fortune !`,
    lien: "/tirage",
  });

  res.status(201).json({
    message: `${montants.length} tour(s) accordé(s) à ${user.nom}`,
    grant,
  });
});

export const getAllGrants = asyncHandler(async (req, res) => {
  const grants = await TirageGrant.find()
    .populate("userId", "nom telephone email")
    .populate("creePar", "nom")
    .sort({ createdAt: -1 });
  res.json(grants);
});

export const annulerGrant = asyncHandler(async (req, res) => {
  const grant = await TirageGrant.findById(req.params.id);
  if (!grant) {
    res.status(404);
    throw new Error("Grant introuvable");
  }

  if (grant.statut === "TERMINE") {
    res.status(400);
    throw new Error("Ce grant est déjà terminé");
  }

  grant.statut = "ANNULE";
  await grant.save();

  res.json({ message: "Grant annulé", grant });
});

export const supprimerGrant = asyncHandler(async (req, res) => {
  const grant = await TirageGrant.findById(req.params.id);
  if (!grant) {
    res.status(404);
    throw new Error("Grant introuvable");
  }
  await grant.deleteOne();
  res.json({ message: "Grant supprimé" });
});