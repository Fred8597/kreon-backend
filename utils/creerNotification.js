import Notification from "../models/Notification.js";

/**
 * Helper pour créer une notification facilement
 * @param {Object} params - { userId, type, titre, message, lien?, montant? }
 */
export const creerNotification = async ({
  userId,
  type,
  titre,
  message,
  lien = null,
  montant = null,
}) => {
  try {
    const notif = await Notification.create({
      userId,
      type,
      titre,
      message,
      lien,
      montant,
    });
    return notif;
  } catch (error) {
    console.error("Erreur création notification :", error.message);
    return null;
  }
};