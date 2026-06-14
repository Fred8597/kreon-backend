import asyncHandler from "express-async-handler";
import Investment from "../models/Investment.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { distribuerCommissions } from "../utils/distribuerCommissions.js";
import { creerNotification } from "../utils/creerNotification.js";
import { crediterCoffreAuto } from "../utils/crediterCoffreAuto.js";

// @desc    Créer un nouvel investissement
// @route   POST /api/investments
// @access  Privé
export const investir = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  if (!productId) {
    res.status(400);
    throw new Error("Produit requis");
  }

  // ===== 1. Vérifier le produit =====
  const produit = await Product.findById(productId);
  if (!produit || !produit.estActif) {
    res.status(404);
    throw new Error("Produit introuvable ou inactif");
  }

  // ===== 2. Vérifier le stock =====
  if (produit.stock <= 0) {
    res.status(400);
    throw new Error("Ce produit est épuisé");
  }

  // ===== 3. Récupérer l'utilisateur =====
  const user = await User.findById(req.user._id);

  // ===== 4. Vérifications selon catégorie =====

  // --- Catégorie NVIP ---
  if (produit.categorie === "NVIP") {
    if (produit.niveauVIPRequis > 0 && user.niveauVIP < produit.niveauVIPRequis) {
      res.status(403);
      throw new Error(
        `Ce produit est réservé aux NVIP${produit.niveauVIPRequis} et plus. Votre niveau actuel : ${user.niveauVIP === 0 ? "Normal User" : `NVIP${user.niveauVIP}`}`
      );
    }
  }

  // --- Catégorie SUPER_IA ---
  if (produit.categorie === "SUPER_IA") {
    const nbFilleuls = await User.countDocuments({ parrainId: user._id });
    if (nbFilleuls < produit.filleulsRequis) {
      res.status(403);
      throw new Error(
        `Ce produit nécessite ${produit.filleulsRequis} filleuls. Vous en avez ${nbFilleuls}.`
      );
    }
  }

  // --- Catégorie DUREE_LIMITEE ---
  if (produit.categorie === "DUREE_LIMITEE") {
    const now = new Date();

    if (produit.dateDebut && now < new Date(produit.dateDebut)) {
      res.status(400);
      throw new Error(
        "Ce produit n'est pas encore disponible. Patientez jusqu'au lancement."
      );
    }

    if (produit.dateFin && now > new Date(produit.dateFin)) {
      res.status(400);
      throw new Error("Ce produit n'est plus disponible.");
    }
  }

  // ===== 5. Vérifier limite d'achat =====
  if (produit.limiteAchat > 0) {
    const nbAchats = await Investment.countDocuments({
      userId: user._id,
      productId: produit._id,
    });

    if (nbAchats >= produit.limiteAchat) {
      res.status(400);
      throw new Error(
        `Vous avez atteint la limite de ${produit.limiteAchat} achat(s) pour ce produit.`
      );
    }
  }

  // ===== 6. Vérifier le solde =====
  if (user.soldePrincipal < produit.prix) {
    res.status(400);
    throw new Error(
      `Solde insuffisant. Vous avez ${user.soldePrincipal} XAF, il vous faut ${produit.prix} XAF.`
    );
  }

  // ===== 7. Calculer le retour total =====
  // User reçoit à la fin : prix (mise) + montantRetour (revenu)
  const montantTotal = produit.prix + produit.montantRetour;

  // ===== 8. Date d'expiration =====
  const dateExpiration = new Date();
  dateExpiration.setDate(dateExpiration.getDate() + produit.dureeJours);

  // ===== 9. Déduire du solde =====
  const soldeAvant = user.soldePrincipal;
  user.soldePrincipal -= produit.prix;
  await user.save();

  // ===== 10. Décrémenter le stock =====
  produit.stock -= 1;
  await produit.save();

  // ===== 11. Calculer le ROI % pour stockage (compatibilité historique) =====
  const roiPourcentage = Math.round((produit.montantRetour / produit.prix) * 100);

  // ===== 12. Créer l'investissement =====
  const investment = await Investment.create({
    userId: user._id,
    productId: produit._id,
    nomProduit: produit.nom,
    montantInvesti: produit.prix,
    dureeJours: produit.dureeJours,
    roiPourcentage,
    montantTotalARecevoir: montantTotal,
    dateExpiration,
  });

  // ===== 13. Transaction =====
  await Transaction.create({
    userId: user._id,
    type: "INVESTISSEMENT",
    montant: -produit.prix,
    soldeAvant,
    soldeApres: user.soldePrincipal,
    description: `Investissement dans ${produit.nom}`,
    referenceId: investment._id,
    referenceType: "Investment",
    statut: "COMPLETEE",
  });

  // ===== 14. Distribuer commissions parrainage =====
  await distribuerCommissions(user._id, produit.prix, investment._id);

  // ===== 15. Notification =====
  await creerNotification({
    userId: user._id,
    type: "INVESTISSEMENT_CREE",
    titre: "📦 Investissement créé",
    message: `Votre location de ${produit.nom} pour ${produit.prix} XAF est active. Vous recevrez ${montantTotal} XAF dans ${produit.dureeJours} jour(s).`,
    lien: "/commandes",
    montant: produit.prix,
  });

  // ===== 16. Créditer coffre auto si applicable =====
  await crediterCoffreAuto(user._id);

  res.status(201).json({
    message: "Investissement créé avec succès",
    investment,
    montantTotalARecevoir: montantTotal,
    dateExpiration,
  });
});

// @desc    Mes investissements
// @route   GET /api/investments
// @access  Privé
export const mesInvestissements = asyncHandler(async (req, res) => {
  const investments = await Investment.find({ userId: req.user._id })
    .populate("productId", "nom image categorie badge")
    .sort({ createdAt: -1 });
  res.json(investments);
});

// @desc    Détails d'un investissement
// @route   GET /api/investments/:id
// @access  Privé
export const getInvestment = asyncHandler(async (req, res) => {
  const investment = await Investment.findById(req.params.id).populate("productId");

  if (!investment) {
    res.status(404);
    throw new Error("Investissement introuvable");
  }

  if (investment.userId.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Accès refusé");
  }

  res.json(investment);
});

// @desc    Vérifier et créditer les investissements expirés (auto)
export const traiterInvestissementsExpires = async (userId = null) => {
  const filter = {
    statut: "ACTIF",
    dateExpiration: { $lte: new Date() },
  };

  if (userId) filter.userId = userId;

  const expires = await Investment.find(filter);

  for (const inv of expires) {
    const user = await User.findById(inv.userId);
    if (!user) continue;

    const soldeAvant = user.soldePrincipal;
    user.soldePrincipal += inv.montantTotalARecevoir;
    await user.save();

    inv.statut = "TERMINE";
    inv.dateCompletion = new Date();
    await inv.save();

    await Transaction.create({
      userId: user._id,
      type: "GAIN_ROI",
      montant: inv.montantTotalARecevoir,
      soldeAvant,
      soldeApres: user.soldePrincipal,
      description: `Gain ROI de ${inv.nomProduit} (${inv.roiPourcentage}%)`,
      referenceId: inv._id,
      referenceType: "Investment",
      statut: "COMPLETEE",
    });

    await creerNotification({
      userId: user._id,
      type: "ROI_VERSE",
      titre: "💰 ROI versé !",
      message: `${inv.montantTotalARecevoir} XAF ont été crédités sur votre compte pour ${inv.nomProduit}.`,
      lien: "/gains",
      montant: inv.montantTotalARecevoir,
    });
  }

  return expires.length;
};