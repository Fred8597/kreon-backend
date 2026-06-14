import asyncHandler from "express-async-handler";

export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("Aucun fichier envoyé");
  }

  const url = `/uploads/${req.file.filename}`;

  res.json({
    message: "Image uploadée avec succès",
    url,
    nomFichier: req.file.filename,
    taille: req.file.size,
  });
});