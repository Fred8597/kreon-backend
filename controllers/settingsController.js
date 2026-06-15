import asyncHandler from "express-async-handler";
import Settings from "../models/Settings.js";

// @desc    Récupérer les paramètres publics (numéros agents)
// @route   GET /api/settings/public
// @access  Privé (user connecté)
export const getPublicSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getInstance();
  res.json({
    numeroAgentMTN: settings.numeroAgentMTN,
    numeroAgentORANGE: settings.numeroAgentORANGE,
    nomAgentMTN: settings.nomAgentMTN,
    nomAgentORANGE: settings.nomAgentORANGE,
  });
});

// @desc    Récupérer toutes les settings (admin)
// @route   GET /api/settings
// @access  Admin
export const getSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getInstance();
  res.json(settings);
});

// @desc    Mettre à jour les settings (admin)
// @route   PUT /api/settings
// @access  Admin
export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getInstance();

  const champs = [
    "numeroAgentMTN",
    "numeroAgentORANGE",
    "nomAgentMTN",
    "nomAgentORANGE",
    "actif",
  ];

  champs.forEach((champ) => {
    if (req.body[champ] !== undefined) {
      settings[champ] = req.body[champ];
    }
  });

  const updated = await settings.save();
  res.json({
    message: "Paramètres mis à jour",
    settings: updated,
  });
});