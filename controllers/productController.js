import asyncHandler from "express-async-handler";
import Product from "../models/Product.js";
import Investment from "../models/Investment.js";

// @desc    Récupérer tous les produits actifs (public)
// @route   GET /api/products
// @access  Public
export const getProduits = asyncHandler(async (req, res) => {
  const { categorie } = req.query;

  const filter = { estActif: true };
  if (categorie) filter.categorie = categorie;

  const produits = await Product.find(filter).sort({
    ordre: 1,
    createdAt: -1,
  });

  res.json(produits);
});

// @desc    Récupérer un produit par ID
// @route   GET /api/products/:id
// @access  Public
export const getProduitById = asyncHandler(async (req, res) => {
  const produit = await Product.findById(req.params.id);

  if (!produit) {
    res.status(404);
    throw new Error("Produit non trouvé");
  }

  // Si user connecté, ajouter le nombre d'achats de ce user
  let achatsUser = 0;
  if (req.user) {
    achatsUser = await Investment.countDocuments({
      userId: req.user._id,
      productId: produit._id,
    });
  }

  res.json({ ...produit.toJSON(), achatsUser });
});

// @desc    Créer un nouveau produit (admin)
// @route   POST /api/products
// @access  Privé/Admin
export const creerProduit = asyncHandler(async (req, res) => {
  const {
    nom,
    description,
    image,
    categorie,
    prix,
    montantRetour,
    dureeJours,
    stock,
    limiteAchat,
    niveauVIPRequis,
    filleulsRequis,
    dateDebut,
    dateFin,
    estActif,
    badge,
    ordre,
  } = req.body;

  // Validations basiques
  if (!nom || !prix || !montantRetour || !dureeJours || !categorie) {
    res.status(400);
    throw new Error(
      "Nom, prix, montant retour, durée et catégorie sont obligatoires"
    );
  }

  if (prix <= 0 || montantRetour < 0 || dureeJours < 1) {
    res.status(400);
    throw new Error("Valeurs invalides");
  }

  // Validations selon catégorie
  if (categorie === "NVIP" && (!niveauVIPRequis || niveauVIPRequis < 1)) {
    res.status(400);
    throw new Error("Pour la catégorie NVIP, un niveau VIP (1-10) est requis");
  }

  if (categorie === "SUPER_IA" && (!filleulsRequis || filleulsRequis < 1)) {
    res.status(400);
    throw new Error(
      "Pour la catégorie Super IA, le nombre de filleuls requis doit être >= 1"
    );
  }

  if (categorie === "DUREE_LIMITEE") {
    if (!dateDebut || !dateFin) {
      res.status(400);
      throw new Error(
        "Pour la catégorie Durée limitée, dateDebut et dateFin sont requises"
      );
    }
    if (new Date(dateDebut) >= new Date(dateFin)) {
      res.status(400);
      throw new Error("dateDebut doit être avant dateFin");
    }
  }

  const produit = await Product.create({
    nom,
    description,
    image,
    categorie,
    prix,
    montantRetour,
    dureeJours,
    stock: stock || 0,
    limiteAchat: limiteAchat || 0,
    niveauVIPRequis: niveauVIPRequis || 0,
    filleulsRequis: filleulsRequis || 0,
    dateDebut: dateDebut || null,
    dateFin: dateFin || null,
    estActif: estActif !== undefined ? estActif : true,
    badge: badge || null,
    ordre: ordre || 0,
    createurId: req.user._id,
  });

  res.status(201).json(produit);
});

// @desc    Modifier un produit (admin)
// @route   PUT /api/products/:id
// @access  Privé/Admin
export const modifierProduit = asyncHandler(async (req, res) => {
  const produit = await Product.findById(req.params.id);

  if (!produit) {
    res.status(404);
    throw new Error("Produit non trouvé");
  }

  // Mettre à jour tous les champs autorisés
  const champs = [
    "nom",
    "description",
    "image",
    "categorie",
    "prix",
    "montantRetour",
    "dureeJours",
    "stock",
    "limiteAchat",
    "niveauVIPRequis",
    "filleulsRequis",
    "dateDebut",
    "dateFin",
    "estActif",
    "badge",
    "ordre",
  ];

  champs.forEach((champ) => {
    if (req.body[champ] !== undefined) {
      produit[champ] = req.body[champ];
    }
  });

  const updated = await produit.save();
  res.json(updated);
});

// @desc    Supprimer un produit (admin)
// @route   DELETE /api/products/:id
// @access  Privé/Admin
export const supprimerProduit = asyncHandler(async (req, res) => {
  const produit = await Product.findById(req.params.id);

  if (!produit) {
    res.status(404);
    throw new Error("Produit non trouvé");
  }

  await produit.deleteOne();
  res.json({ message: "Produit supprimé" });
});