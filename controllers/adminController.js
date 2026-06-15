import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Investment from "../models/Investment.js";
import Transaction from "../models/Transaction.js";
import Recharge from "../models/Recharge.js";
import Withdrawal from "../models/Withdrawal.js";
import { creerNotification } from "../utils/creerNotification.js";

// @desc    Dashboard admin : stats globales
// @route   GET /api/admin/dashboard
// @access  Admin
export const getDashboard = asyncHandler(async (req, res) => {
  // 👥 Utilisateurs
  const totalUsers = await User.countDocuments();
  const usersActifs = await User.countDocuments({ estActif: true });
  const usersInactifs = await User.countDocuments({ estActif: false });
  const admins = await User.countDocuments({ role: "admin" });
  const moderateurs = await User.countDocuments({ role: "moderator" });

  // Nouveaux inscrits (dernières 24h)
  const hier = new Date();
  hier.setDate(hier.getDate() - 1);
  const nouveauxUsers24h = await User.countDocuments({
    createdAt: { $gte: hier },
  });

  // 📦 Produits
  const totalProduits = await Product.countDocuments();
  const produitsActifs = await Product.countDocuments({ estActif: true });

  // 📊 Investissements
  const totalInvestissements = await Investment.countDocuments();
  const investissementsActifs = await Investment.countDocuments({
    statut: "ACTIF",
  });
  const investissementsTermines = await Investment.countDocuments({
    statut: "TERMINE",
  });

  // Montant total investi
  const montantsInvestis = await Investment.aggregate([
    { $group: { _id: null, total: { $sum: "$montantInvesti" } } },
  ]);
  const totalMontantInvesti = montantsInvestis[0]?.total || 0;

  // Montant total ROI distribué
  const montantsROI = await Transaction.aggregate([
    { $match: { type: "GAIN_ROI", statut: "COMPLETEE" } },
    { $group: { _id: null, total: { $sum: "$montant" } } },
  ]);
  const totalROIDistribue = montantsROI[0]?.total || 0;

  // 💰 Recharges
  const rechargesEnAttente = await Recharge.countDocuments({
    statut: "EN_ATTENTE",
  });
  const rechargesValidees = await Recharge.countDocuments({
    statut: "VALIDEE",
  });
  const rechargesRefusees = await Recharge.countDocuments({
    statut: "REFUSEE",
  });

  const montantRecharges = await Recharge.aggregate([
    { $match: { statut: "VALIDEE" } },
    { $group: { _id: null, total: { $sum: "$montant" } } },
  ]);
  const totalRechargesValidees = montantRecharges[0]?.total || 0;

  // 💸 Retraits
  const retraitsEnAttente = await Withdrawal.countDocuments({
    statut: "EN_ATTENTE",
  });
  const retraitsValides = await Withdrawal.countDocuments({
    statut: "PAYEE",
  });
  const retraitsRefuses = await Withdrawal.countDocuments({
    statut: "REFUSEE",
  });

  const montantRetraits = await Withdrawal.aggregate([
    { $match: { statut: "PAYEE" } },
    { $group: { _id: null, total: { $sum: "$montant" } } },
  ]);
  const totalRetraitsPaies = montantRetraits[0]?.total || 0;

  // 🎁 Commissions
  const montantCommissions = await Transaction.aggregate([
    { $match: { type: "COMMISSION", statut: "COMPLETEE" } },
    { $group: { _id: null, total: { $sum: "$montant" } } },
  ]);
  const totalCommissionsDistribuees = montantCommissions[0]?.total || 0;

  // 📈 Derniers inscrits (10)
  const derniersInscrits = await User.find()
    .select("nom email telephone role createdAt totalInvites")
    .sort({ createdAt: -1 })
    .limit(10);

  // 📊 Dernières transactions (10)
  const dernieresTransactions = await Transaction.find()
    .populate("userId", "nom email")
    .sort({ createdAt: -1 })
    .limit(10);

  res.json({
    utilisateurs: {
      total: totalUsers,
      actifs: usersActifs,
      inactifs: usersInactifs,
      admins,
      moderateurs,
      nouveaux24h: nouveauxUsers24h,
    },
    produits: {
      total: totalProduits,
      actifs: produitsActifs,
    },
    investissements: {
      total: totalInvestissements,
      actifs: investissementsActifs,
      termines: investissementsTermines,
      montantTotalInvesti: totalMontantInvesti,
      roiTotalDistribue: totalROIDistribue,
    },
    recharges: {
      enAttente: rechargesEnAttente,
      validees: rechargesValidees,
      refusees: rechargesRefusees,
      montantTotalValide: totalRechargesValidees,
    },
    retraits: {
      enAttente: retraitsEnAttente,
      valides: retraitsValides,
      refuses: retraitsRefuses,
      montantTotalPaye: totalRetraitsPaies,
    },
    commissions: {
      totalDistribuees: totalCommissionsDistribuees,
    },
    recents: {
      inscrits: derniersInscrits,
      transactions: dernieresTransactions,
    },
  });
});

// @desc    Liste tous les utilisateurs
// @route   GET /api/admin/users
// @access  Admin
export const getAllUsers = asyncHandler(async (req, res) => {
  const { role, search, page = 1, limit = 20 } = req.query;

  const filter = {};

  // Filtrer par rôle
  if (role) filter.role = role;

  // Recherche par nom, email ou téléphone
  if (search) {
    filter.$or = [
      { nom: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { telephone: { $regex: search, $options: "i" } },
      { codeParrainage: { $regex: search, $options: "i" } },
    ];
  }

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .select("-password -pin")
    .populate("parrainId", "nom email codeParrainage")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.json({
    users,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
  });
});

// @desc    Détails d'un utilisateur
// @route   GET /api/admin/users/:id
// @access  Admin
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select("-password -pin")
    .populate("parrainId", "nom email codeParrainage");

  if (!user) {
    res.status(404);
    throw new Error("Utilisateur non trouvé");
  }

  // Récupérer ses filleuls
  const filleuls = await User.find({ parrainId: user._id })
    .select("nom email telephone createdAt totalInvites")
    .sort({ createdAt: -1 });

  // Récupérer ses investissements
  const investissements = await Investment.find({ userId: user._id })
    .sort({ createdAt: -1 });

  // Récupérer ses transactions récentes
  const transactions = await Transaction.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(20);

  res.json({
    user,
    filleuls,
    investissements,
    transactions,
  });
});

// @desc    Modifier le rôle d'un utilisateur
// @route   PUT /api/admin/users/:id/role
// @access  Admin
export const modifierRole = asyncHandler(async (req, res) => {
  const { role } = req.body;

  if (!["user", "moderator", "admin"].includes(role)) {
    res.status(400);
    throw new Error("Rôle invalide. Choix : user, moderator, admin");
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("Utilisateur non trouvé");
  }

  user.role = role;
  await user.save();

  res.json({
    message: `Rôle de ${user.nom} changé en ${role}`,
    user: {
      _id: user._id,
      nom: user.nom,
      email: user.email,
      role: user.role,
    },
  });
});

// @desc    Suspendre / Réactiver un utilisateur
// @route   PUT /api/admin/users/:id/statut
// @access  Admin
export const toggleStatutUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("Utilisateur non trouvé");
  }

  user.estActif = !user.estActif;
  await user.save();

  const action = user.estActif ? "réactivé" : "suspendu";

  res.json({
    message: `${user.nom} a été ${action}`,
    user: {
      _id: user._id,
      nom: user.nom,
      email: user.email,
      estActif: user.estActif,
    },
  });
});

// @desc    Créditer/Débiter manuellement un utilisateur
// @route   PUT /api/admin/users/:id/solde
// @access  Admin
export const modifierSolde = asyncHandler(async (req, res) => {
  const { montant, description } = req.body;

  if (!montant) {
    res.status(400);
    throw new Error("Montant requis (positif pour créditer, négatif pour débiter)");
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("Utilisateur non trouvé");
  }

  if (user.soldePrincipal + montant < 0) {
    res.status(400);
    throw new Error("Le solde ne peut pas être négatif");
  }

  const soldeAvant = user.soldePrincipal;
  user.soldePrincipal += montant;
  await user.save();

  // Créer une transaction
  await Transaction.create({
    userId: user._id,
    type: montant > 0 ? "BONUS" : "RETRAIT",
    montant,
    soldeAvant,
    soldeApres: user.soldePrincipal,
    description: description || `Modification manuelle par admin`,
    statut: "COMPLETEE",
  });

  res.json({
    message: `Solde de ${user.nom} modifié : ${soldeAvant} → ${user.soldePrincipal} XAF`,
    user: {
      _id: user._id,
      nom: user.nom,
      soldePrincipal: user.soldePrincipal,
    },
  });
});

// @desc    Compteur des tâches admin en attente (cloche)
// @route   GET /api/admin/notifications/compteur
// @access  Admin
export const getCompteurAdminNotifs = asyncHandler(async (req, res) => {
  const rechargesEnAttente = await Recharge.countDocuments({
    statut: "EN_ATTENTE",
  });

  const retraitsEnAttente = await Withdrawal.countDocuments({
    statut: "EN_ATTENTE",
  });

  res.json({
    rechargesEnAttente,
    retraitsEnAttente,
    total: rechargesEnAttente + retraitsEnAttente,
  });
});

// @desc    Aperçu des tâches en attente (5 dernières)
// @route   GET /api/admin/notifications/apercu
// @access  Admin
export const getApercuTaches = asyncHandler(async (req, res) => {
  const recharges = await Recharge.find({ statut: "EN_ATTENTE" })
    .populate("userId", "nom telephone")
    .sort({ createdAt: -1 })
    .limit(5);

  const retraits = await Withdrawal.find({ statut: "EN_ATTENTE" })
    .populate("userId", "nom telephone")
    .sort({ createdAt: -1 })
    .limit(5);

  res.json({ recharges, retraits });
});

// @desc    Réinitialiser le mot de passe d'un user (admin)
// @route   PUT /api/admin/users/:id/reset-password
// @access  Admin
export const resetPasswordUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("Utilisateur non trouvé");
  }

  // Empêcher de reset un autre admin (sécurité)
  if (user.role === "admin" && user._id.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Vous ne pouvez pas réinitialiser le mot de passe d'un autre admin");
  }

  // Générer un mot de passe temporaire aléatoire
  const genererPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let pwd = "KRN-";
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };

  const nouveauPassword = genererPassword();

  // Mettre à jour (le hook pre-save du modèle va le hasher automatiquement)
  user.password = nouveauPassword;
  await user.save();

  // Notification au user (optionnelle, car il ne peut pas se connecter)
  try {
    await creerNotification({
      userId: user._id,
      type: "SYSTEM",
      titre: "🔐 Mot de passe réinitialisé",
      message: `Un administrateur a réinitialisé votre mot de passe. Contactez le support pour le récupérer.`,
    });
  } catch (e) {
    // silencieux
  }

  res.json({
    message: `Mot de passe de ${user.nom} réinitialisé avec succès`,
    nouveauPassword,
    user: {
      _id: user._id,
      nom: user.nom,
      telephone: user.telephone,
      email: user.email,
    },
  });
});