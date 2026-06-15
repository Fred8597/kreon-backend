import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import genererCodeParrainage from "../utils/genererCode.js";
import genererToken from "../utils/genererToken.js";

// @desc    Inscription d'un nouvel utilisateur
// @route   POST /api/auth/register
// @access  Public
export const inscription = asyncHandler(async (req, res) => {
  const { nom, email, telephone, password, codeParrainage } = req.body;

  // 1. Vérifier que tous les champs sont remplis (CODE PARRAINAGE OBLIGATOIRE)
  if (!nom || !email || !telephone || !password || !codeParrainage) {
    res.status(400);
    throw new Error(
      "Tous les champs sont obligatoires, y compris le code de parrainage"
    );
  }

  // 2. Vérifier que l'email n'existe pas déjà
  const emailExiste = await User.findOne({ email });
  if (emailExiste) {
    res.status(400);
    throw new Error("Cet email est déjà utilisé");
  }

  // 3. Vérifier que le téléphone n'existe pas déjà
  const telExiste = await User.findOne({ telephone });
  if (telExiste) {
    res.status(400);
    throw new Error("Ce numéro est déjà utilisé");
  }

  // 4. Vérifier le code de parrainage (OBLIGATOIRE)
  const codeNet = codeParrainage.trim().toUpperCase();
  const parrain = await User.findOne({ codeParrainage: codeNet });
  if (!parrain) {
    res.status(400);
    throw new Error("Code de parrainage invalide ou inexistant");
  }
  const parrainId = parrain._id;

  // Incrémenter le compteur du parrain
  parrain.totalInvites += 1;
  await parrain.save();

  // 5. Générer un code de parrainage unique pour le nouveau user
  let nouveauCode;
  let codeUnique = false;
  while (!codeUnique) {
    nouveauCode = genererCodeParrainage();
    const existeDeja = await User.findOne({ codeParrainage: nouveauCode });
    if (!existeDeja) codeUnique = true;
  }

  // 6. Créer l'utilisateur
  const user = await User.create({
    nom,
    email,
    telephone,
    password,
    codeParrainage: nouveauCode,
    parrainId,
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      nom: user.nom,
      email: user.email,
      telephone: user.telephone,
      codeParrainage: user.codeParrainage,
      soldePrincipal: user.soldePrincipal,
      role: user.role,
      token: genererToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error("Données invalides");
  }
});

// @desc    Connexion d'un utilisateur (par téléphone)
// @route   POST /api/auth/login
// @access  Public
export const connexion = asyncHandler(async (req, res) => {
  const { telephone, password } = req.body;

  if (!telephone || !password) {
    res.status(400);
    throw new Error("Téléphone et mot de passe requis");
  }

  // Nettoyer le téléphone (enlever espaces et +237)
  const numeroNettoye = telephone
    .toString()
    .replace(/\s/g, "")
    .replace(/^\+?237/, "");

  // Trouver l'utilisateur par téléphone
  const user = await User.findOne({ telephone: numeroNettoye });

  if (user && (await user.comparerPassword(password))) {
    user.derniereConnexion = new Date();
    await user.save();

    res.json({
      _id: user._id,
      nom: user.nom,
      email: user.email,
      telephone: user.telephone,
      codeParrainage: user.codeParrainage,
      soldePrincipal: user.soldePrincipal,
      soldeBonus: user.soldeBonus,
      role: user.role,
      token: genererToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error("Téléphone ou mot de passe incorrect");
  }
});
// @desc    Récupérer le profil de l'utilisateur connecté
// @route   GET /api/auth/profile
// @access  Privé
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  
  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error("Utilisateur non trouvé");
  }
});

// @desc    Créer/Définir le PIN (première fois)
// @route   POST /api/auth/pin
// @access  Privé
export const definirPin = asyncHandler(async (req, res) => {
  const { pin } = req.body;

  if (!pin) {
    res.status(400);
    throw new Error("Code PIN requis");
  }

  if (!/^\d{6}$/.test(pin)) {
    res.status(400);
    throw new Error("Le PIN doit contenir exactement 6 chiffres");
  }

  const user = await User.findById(req.user._id);

  if (user.pin) {
    res.status(400);
    throw new Error("Vous avez déjà un PIN. Utilisez la route de modification.");
  }

  const bcrypt = await import("bcryptjs");
  const salt = await bcrypt.default.genSalt(10);
  user.pin = await bcrypt.default.hash(pin, salt);
  await user.save();

  res.json({ message: "Code PIN créé avec succès" });
});

// @desc    Modifier le PIN
// @route   PUT /api/auth/pin
// @access  Privé
export const modifierPin = asyncHandler(async (req, res) => {
  const { ancienPin, nouveauPin } = req.body;

  if (!ancienPin || !nouveauPin) {
    res.status(400);
    throw new Error("Ancien et nouveau PIN requis");
  }

  if (!/^\d{6}$/.test(nouveauPin)) {
    res.status(400);
    throw new Error("Le nouveau PIN doit contenir exactement 6 chiffres");
  }

  const user = await User.findById(req.user._id);

  if (!user.pin) {
    res.status(400);
    throw new Error("Vous n'avez pas encore de PIN. Créez-en un d'abord.");
  }

  const valid = await user.comparerPin(ancienPin);
  if (!valid) {
    res.status(400);
    throw new Error("Ancien PIN incorrect");
  }

  const bcrypt = await import("bcryptjs");
  const salt = await bcrypt.default.genSalt(10);
  user.pin = await bcrypt.default.hash(nouveauPin, salt);
  await user.save();

  res.json({ message: "Code PIN modifié avec succès" });
});

// @desc    Vérifier le PIN
// @route   POST /api/auth/pin/verifier
// @access  Privé
export const verifierPin = asyncHandler(async (req, res) => {
  const { pin } = req.body;

  if (!pin) {
    res.status(400);
    throw new Error("PIN requis");
  }

  const user = await User.findById(req.user._id);

  if (!user.pin) {
    res.status(400);
    throw new Error("Aucun PIN défini");
  }

  const valid = await user.comparerPin(pin);

  if (!valid) {
    res.status(400);
    throw new Error("PIN incorrect");
  }

  res.json({ message: "PIN correct", valide: true });
});

// @desc    Statut du PIN (défini ou non)
// @route   GET /api/auth/pin/statut
// @access  Privé
export const statutPin = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("pin");
  res.json({ pinDefini: !!user.pin });
});

// @desc    Mettre à jour les infos Mobile Money
// @route   PUT /api/auth/mobile-money
// @access  Privé
export const updateMobileMoney = asyncHandler(async (req, res) => {
  const { numeroMobileMoney, operateurMobileMoney } = req.body;

  if (!numeroMobileMoney || !operateurMobileMoney) {
    res.status(400);
    throw new Error("Numéro et opérateur requis");
  }

  if (!["MTN", "ORANGE"].includes(operateurMobileMoney)) {
    res.status(400);
    throw new Error("Opérateur invalide. Choix : MTN ou ORANGE");
  }

  // Validation simple du format (chiffres + indicatif optionnel)
  const numeroNettoye = numeroMobileMoney.replace(/\s/g, "");
  if (!/^(\+?237)?[6-9]\d{8}$/.test(numeroNettoye)) {
    res.status(400);
    throw new Error("Numéro de téléphone invalide");
  }

  const user = await User.findById(req.user._id);
  user.numeroMobileMoney = numeroNettoye;
  user.operateurMobileMoney = operateurMobileMoney;
  await user.save();

  res.json({
    message: "Numéro Mobile Money enregistré avec succès",
    numeroMobileMoney: user.numeroMobileMoney,
    operateurMobileMoney: user.operateurMobileMoney,
  });
});

// @desc    Récupérer les infos Mobile Money
// @route   GET /api/auth/mobile-money
// @access  Privé
export const getMobileMoney = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "numeroMobileMoney operateurMobileMoney"
  );
  res.json(user);
});

// @desc    Mettre à jour les infos générales du profil (nom, etc.)
// @route   PUT /api/auth/profile
// @access  Privé
export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("Utilisateur non trouvé");
  }

  user.nom = req.body.nom || user.nom;

  // Email modifiable mais doit rester unique
  if (req.body.email && req.body.email !== user.email) {
    const existe = await User.findOne({ email: req.body.email });
    if (existe) {
      res.status(400);
      throw new Error("Cet email est déjà utilisé");
    }
    user.email = req.body.email;
  }

  // Mot de passe modifiable
  if (req.body.password) {
    if (req.body.password.length < 6) {
      res.status(400);
      throw new Error("Le mot de passe doit contenir au moins 6 caractères");
    }
    user.password = req.body.password; // Sera hashé automatiquement
  }

  const updated = await user.save();

  res.json({
    _id: updated._id,
    nom: updated.nom,
    email: updated.email,
    telephone: updated.telephone,
    codeParrainage: updated.codeParrainage,
    soldePrincipal: updated.soldePrincipal,
    role: updated.role,
    message: "Profil mis à jour avec succès",
  });
});

// @desc    Récupérer mes filleuls par niveau
// @route   GET /api/auth/mon-equipe
// @access  Privé
export const getMonEquipe = asyncHandler(async (req, res) => {
  const monId = req.user._id;

  // Niveau 1 : mes filleuls directs
  const niveau1 = await User.find({ parrainId: monId })
    .select("nom telephone codeParrainage createdAt totalInvites soldePrincipal")
    .sort({ createdAt: -1 });

  // Niveau 2 : filleuls de mes filleuls
  const idsN1 = niveau1.map((u) => u._id);
  const niveau2 = await User.find({ parrainId: { $in: idsN1 } })
    .select("nom telephone codeParrainage createdAt totalInvites parrainId")
    .populate("parrainId", "nom")
    .sort({ createdAt: -1 });

  // Niveau 3
  const idsN2 = niveau2.map((u) => u._id);
  const niveau3 = await User.find({ parrainId: { $in: idsN2 } })
    .select("nom telephone codeParrainage createdAt totalInvites parrainId")
    .populate("parrainId", "nom")
    .sort({ createdAt: -1 });

  // Niveau 4
  const idsN3 = niveau3.map((u) => u._id);
  const niveau4 = await User.find({ parrainId: { $in: idsN3 } })
    .select("nom telephone codeParrainage createdAt totalInvites parrainId")
    .populate("parrainId", "nom")
    .sort({ createdAt: -1 });

  res.json({
    total: niveau1.length + niveau2.length + niveau3.length + niveau4.length,
    niveau1,
    niveau2,
    niveau3,
    niveau4,
    stats: {
      n1: niveau1.length,
      n2: niveau2.length,
      n3: niveau3.length,
      n4: niveau4.length,
    },
  });
});