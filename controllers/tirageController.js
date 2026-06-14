import asyncHandler from "express-async-handler";
import TirageGrant from "../models/TirageGrant.js";
import TirageHistorique from "../models/TirageHistorique.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { creerNotification } from "../utils/creerNotification.js";

// ============================================
// ===== USER =====
// ============================================

// @desc    Statut du tirage (mes tours dispo + historique récent)
// @route   GET /api/tirage/statut
// @access  Privé
export const getStatutTirage = asyncHandler(async (req, res) => {
  // Récupérer tous les grants ACTIFS de l'user
  const grants = await TirageGrant.find({
    userId: req.user._id,
    statut: "ACTIF",
  }).sort({ createdAt: 1 });

  // Calculer le total de tours restants
  let toursRestants = 0;
  let prochaineMontant = null;

  for (const g of grants) {
    const restants = g.montants.length - g.indexCourant;
    toursRestants += restants;

    // Le prochain montant à gagner = celui du grant actif le plus ancien
    if (prochaineMontant === null && restants > 0) {
      prochaineMontant = g.montants[g.indexCourant];
    }
  }

  // Stats globales
  const totalTours = await TirageHistorique.countDocuments({
    userId: req.user._id,
  });
  const totalAgg = await TirageHistorique.aggregate([
    { $match: { userId: req.user._id } },
    { $group: { _id: null, total: { $sum: "$montant" } } },
  ]);
  const totalGagne = totalAgg[0]?.total || 0;

  // Derniers tirages
  const historique = await TirageHistorique.find({ userId: req.user._id })
    .sort({ dateTour: -1 })
    .limit(20);

  res.json({
    toursRestants,
    prochaineMontant, // pour le suspense côté UI
    totalTours,
    totalGagne,
    historique,
  });
});

// @desc    Tourner la roue
// @route   POST /api/tirage/tourner
// @access  Privé
export const tournerRoue = asyncHandler(async (req, res) => {
  // 1. Trouver le grant ACTIF le plus ancien
  const grant = await TirageGrant.findOne({
    userId: req.user._id,
    statut: "ACTIF",
  }).sort({ createdAt: 1 });

  if (!grant) {
    res.status(400);
    throw new Error("Aucun tour disponible. Demandez à l'admin de vous en accorder.");
  }

  // 2. Vérifier qu'il reste des tours
  if (grant.indexCourant >= grant.montants.length) {
    grant.statut = "TERMINE";
    await grant.save();
    res.status(400);
    throw new Error("Ce grant est terminé. Demandez à l'admin d'en accorder un nouveau.");
  }

  // 3. Récupérer le montant à gagner
  const montantGagne = grant.montants[grant.indexCourant];

  // 4. Créditer l'user
  const user = await User.findById(req.user._id);
  const soldeAvant = user.soldePrincipal;
  user.soldePrincipal += montantGagne;
  await user.save();

  // 5. Incrémenter le compteur
  grant.indexCourant += 1;
  grant.toursUtilises += 1;
  if (grant.indexCourant >= grant.montants.length) {
    grant.statut = "TERMINE";
  }
  await grant.save();

  // 6. Enregistrer dans l'historique
  const tour = await TirageHistorique.create({
    userId: req.user._id,
    grantId: grant._id,
    montant: montantGagne,
  });

  // 7. Transaction
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

  // 8. Notification
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

// @desc    Accorder des tours à un user
// @route   POST /api/tirage/admin/accorder
// @access  Admin
export const accorderTirage = asyncHandler(async (req, res) => {
  const { userId, montants, note } = req.body;

  if (!userId || !montants || !Array.isArray(montants) || montants.length === 0) {
    res.status(400);
    throw new Error("userId et tableau de montants requis");
  }

  // Vérifier chaque montant > 0
  const tousValides = montants.every((m) => Number.isFinite(m) && m > 0);
  if (!tousValides) {
    res.status(400);
    throw new Error("Tous les montants doivent être > 0");
  }

  // Vérifier que l'user existe
  const user = await User.findById(userId);
  if (!user) {
    res.status(404);
    throw new Error("Utilisateur introuvable");
  }

  // Créer le grant
  const grant = await TirageGrant.create({
    userId,
    montants,
    note: note || "",
    creePar: req.user._id,
  });

  // Notification à l'user
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

// @desc    Liste de tous les grants (admin)
// @route   GET /api/tirage/admin/grants
// @access  Admin
export const getAllGrants = asyncHandler(async (req, res) => {
  const grants = await TirageGrant.find()
    .populate("userId", "nom telephone email")
    .populate("creePar", "nom")
    .sort({ createdAt: -1 });
  res.json(grants);
});

// @desc    Annuler un grant (admin)
// @route   PUT /api/tirage/admin/grants/:id/annuler
// @access  Admin
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

// @desc    Supprimer un grant (admin)
// @route   DELETE /api/tirage/admin/grants/:id
// @access  Admin
export const supprimerGrant = asyncHandler(async (req, res) => {
  const grant = await TirageGrant.findById(req.params.id);
  if (!grant) {
    res.status(404);
    throw new Error("Grant introuvable");
  }
  await grant.deleteOne();
  res.json({ message: "Grant supprimé" });
});