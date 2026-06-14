import asyncHandler from "express-async-handler";
import GiftCode from "../models/GiftCode.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { creerNotification } from "../utils/creerNotification.js";

// Helper : générer un code aléatoire (ex : KRN-A1B2C3)
const genererCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0, O, I, 1 (lisibilité)
  let code = "KRN-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Helper : minuit du jour (fin de validité par défaut)
const minuitProchain = () => {
  const minuit = new Date();
  minuit.setHours(23, 59, 59, 999);
  return minuit;
};

// ============================================
// ===== ROUTES ADMIN =====
// ============================================

// @desc    Créer un code cadeau (admin)
// @route   POST /api/giftcodes
// @access  Admin
export const creerGiftCode = asyncHandler(async (req, res) => {
  const { montant, description, utilisationsMax, codePersonnalise } = req.body;

  if (!montant || montant <= 0) {
    res.status(400);
    throw new Error("Montant requis (>0)");
  }

  // Générer un code unique
  let code = codePersonnalise
    ? codePersonnalise.toUpperCase().trim()
    : genererCode();

  // Vérifier unicité (max 5 tentatives si auto)
  let tentative = 0;
  while ((await GiftCode.findOne({ code })) && tentative < 5) {
    if (codePersonnalise) {
      res.status(400);
      throw new Error("Ce code existe déjà. Choisissez un autre.");
    }
    code = genererCode();
    tentative++;
  }

  const giftCode = await GiftCode.create({
    code,
    montant: parseInt(montant),
    description: description || "",
    dateExpiration: minuitProchain(),
    utilisationsMax: utilisationsMax || 0,
    creePar: req.user._id,
  });

  res.status(201).json({
    message: "Code cadeau créé avec succès",
    giftCode,
  });
});

// @desc    Liste de tous les codes cadeaux (admin)
// @route   GET /api/giftcodes
// @access  Admin
export const getAllGiftCodes = asyncHandler(async (req, res) => {
  const codes = await GiftCode.find()
    .populate("creePar", "nom")
    .sort({ createdAt: -1 });
  res.json(codes);
});

// @desc    Désactiver un code cadeau (admin)
// @route   PUT /api/giftcodes/:id/toggle
// @access  Admin
export const toggleGiftCode = asyncHandler(async (req, res) => {
  const code = await GiftCode.findById(req.params.id);
  if (!code) {
    res.status(404);
    throw new Error("Code introuvable");
  }

  code.estActif = !code.estActif;
  await code.save();

  res.json({
    message: code.estActif ? "Code activé" : "Code désactivé",
    code,
  });
});

// @desc    Supprimer un code cadeau (admin)
// @route   DELETE /api/giftcodes/:id
// @access  Admin
export const supprimerGiftCode = asyncHandler(async (req, res) => {
  const code = await GiftCode.findById(req.params.id);
  if (!code) {
    res.status(404);
    throw new Error("Code introuvable");
  }
  await code.deleteOne();
  res.json({ message: "Code supprimé" });
});

// ============================================
// ===== ROUTES USER =====
// ============================================

// @desc    Réclamer un code cadeau
// @route   POST /api/giftcodes/reclamer
// @access  Privé
export const reclamerGiftCode = asyncHandler(async (req, res) => {
  const { code } = req.body;

  if (!code) {
    res.status(400);
    throw new Error("Code requis");
  }

  const codeNet = code.toUpperCase().trim();
  const giftCode = await GiftCode.findOne({ code: codeNet });

  if (!giftCode) {
    res.status(404);
    throw new Error("Code invalide ou inexistant");
  }

  // Vérifier validité
  if (!giftCode.estActif) {
    res.status(400);
    throw new Error("Ce code a été désactivé");
  }

  if (new Date() > giftCode.dateExpiration) {
    res.status(400);
    throw new Error("Ce code a expiré");
  }

  if (
    giftCode.utilisationsMax > 0 &&
    giftCode.utilisationsActuelles >= giftCode.utilisationsMax
  ) {
    res.status(400);
    throw new Error("Ce code a atteint sa limite d'utilisations");
  }

  // Vérifier si l'user a déjà utilisé ce code
  if (giftCode.dejaUtilisePar(req.user._id)) {
    res.status(400);
    throw new Error("Vous avez déjà utilisé ce code");
  }

  // Créditer
  const user = await User.findById(req.user._id);
  const soldeAvant = user.soldePrincipal;
  user.soldePrincipal += giftCode.montant;
  await user.save();

  // Mettre à jour le code
  giftCode.utilisationsActuelles += 1;
  giftCode.utilisateursIds.push(req.user._id);
  await giftCode.save();

  // Créer transaction
  await Transaction.create({
    userId: req.user._id,
    type: "BONUS",
    montant: giftCode.montant,
    soldeAvant,
    soldeApres: user.soldePrincipal,
    description: `Code cadeau : ${giftCode.code}`,
    referenceId: giftCode._id,
    statut: "COMPLETEE",
  });

  // 🔔 Notification : code cadeau réclamé
    // 🔔 Notification
  await creerNotification({
    userId: req.user._id,
    type: "GIFTCODE",
    titre: "🎁 Code cadeau utilisé",
    message: `Vous avez reçu ${giftCode.montant} XAF avec le code ${giftCode.code}.`,
    montant: giftCode.montant,
  });

  res.json({
    message: `🎁 +${giftCode.montant} XAF crédités !`,
    montant: giftCode.montant,
    soldeApres: user.soldePrincipal,
    code: giftCode.code,
  });
});