import asyncHandler from "express-async-handler";
import News from "../models/News.js";

// @desc    Liste des actualités (public)
// @route   GET /api/news
// @access  Public
export const getAllNews = asyncHandler(async (req, res) => {
  const { categorie, limit = 20 } = req.query;

  const filter = { estPublie: true };
  if (categorie) filter.categorie = categorie;

  const news = await News.find(filter)
    .populate("auteur", "nom")
    .sort({ epingle: -1, createdAt: -1 })
    .limit(parseInt(limit));

  res.json(news);
});

// @desc    Détails d'une actualité + incrément des vues
// @route   GET /api/news/:id
// @access  Public
export const getNewsById = asyncHandler(async (req, res) => {
  const news = await News.findById(req.params.id).populate("auteur", "nom");

  if (!news) {
    res.status(404);
    throw new Error("Actualité non trouvée");
  }

  // Incrémenter les vues
  news.vues += 1;
  await news.save();

  res.json(news);
});

// @desc    Créer une actualité (admin)
// @route   POST /api/news
// @access  Admin
export const creerNews = asyncHandler(async (req, res) => {
  const { titre, contenu, extrait, image, categorie, badge, epingle } = req.body;

  if (!titre || !contenu) {
    res.status(400);
    throw new Error("Titre et contenu requis");
  }

  const news = await News.create({
    titre,
    contenu,
    extrait,
    image,
    categorie,
    badge,
    epingle: epingle || false,
    auteur: req.user._id,
  });

  res.status(201).json(news);
});

// @desc    Modifier une actualité (admin)
// @route   PUT /api/news/:id
// @access  Admin
export const modifierNews = asyncHandler(async (req, res) => {
  const news = await News.findById(req.params.id);

  if (!news) {
    res.status(404);
    throw new Error("Actualité non trouvée");
  }

  news.titre = req.body.titre || news.titre;
  news.contenu = req.body.contenu || news.contenu;
  news.extrait = req.body.extrait ?? news.extrait;
  news.image = req.body.image ?? news.image;
  news.categorie = req.body.categorie || news.categorie;
  news.badge = req.body.badge ?? news.badge;
  news.estPublie = req.body.estPublie ?? news.estPublie;
  news.epingle = req.body.epingle ?? news.epingle;

  const updated = await news.save();
  res.json(updated);
});

// @desc    Supprimer une actualité (admin)
// @route   DELETE /api/news/:id
// @access  Admin
export const supprimerNews = asyncHandler(async (req, res) => {
  const news = await News.findById(req.params.id);

  if (!news) {
    res.status(404);
    throw new Error("Actualité non trouvée");
  }

  await news.deleteOne();
  res.json({ message: "Actualité supprimée" });
});