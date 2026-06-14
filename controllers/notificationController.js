import asyncHandler from "express-async-handler";
import Notification from "../models/Notification.js";

// @desc    Récupérer mes notifications
// @route   GET /api/notifications
// @access  Privé
export const getMesNotifications = asyncHandler(async (req, res) => {
  const { filtre } = req.query; // ?filtre=non-lues

  const query = { userId: req.user._id };
  if (filtre === "non-lues") query.lu = false;

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(100);

  res.json(notifications);
});

// @desc    Compteur de notifications non lues
// @route   GET /api/notifications/compteur
// @access  Privé
export const getCompteurNonLues = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    userId: req.user._id,
    lu: false,
  });

  res.json({ count });
});

// @desc    Marquer une notification comme lue
// @route   PUT /api/notifications/:id/lue
// @access  Privé
export const marquerLue = asyncHandler(async (req, res) => {
  const notif = await Notification.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!notif) {
    res.status(404);
    throw new Error("Notification introuvable");
  }

  if (!notif.lu) {
    notif.lu = true;
    notif.dateLecture = new Date();
    await notif.save();
  }

  res.json(notif);
});

// @desc    Marquer toutes comme lues
// @route   PUT /api/notifications/lues
// @access  Privé
export const marquerToutesLues = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { userId: req.user._id, lu: false },
    { $set: { lu: true, dateLecture: new Date() } }
  );

  res.json({ message: "Toutes les notifications ont été marquées comme lues" });
});

// @desc    Supprimer une notification
// @route   DELETE /api/notifications/:id
// @access  Privé
export const supprimerNotification = asyncHandler(async (req, res) => {
  const notif = await Notification.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!notif) {
    res.status(404);
    throw new Error("Notification introuvable");
  }

  await notif.deleteOne();
  res.json({ message: "Notification supprimée" });
});

// @desc    Supprimer toutes les notifications lues
// @route   DELETE /api/notifications/lues
// @access  Privé
export const supprimerToutesLues = asyncHandler(async (req, res) => {
  await Notification.deleteMany({ userId: req.user._id, lu: true });
  res.json({ message: "Notifications lues supprimées" });
});