import User from "../models/User.js";
import Investment from "../models/Investment.js";
import TreasureChest from "../models/TreasureChest.js";
import Transaction from "../models/Transaction.js";
import { creerNotification } from "./creerNotification.js";

// Grille des coffres
const COFFRES = [
  { palier: 1, montant: 500 },
  { palier: 3, montant: 1500 },
  { palier: 5, montant: 2500 },
  { palier: 10, montant: 6000 },
  { palier: 15, montant: 15000 },
  { palier: 20, montant: 35000 },
];

// Helper : début + fin de la journée
const getAujourdhuiRange = () => {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 1);
  return { debut, fin };
};

/**
 * Crédite automatiquement le parrain si un palier coffre est débloqué
 * @param {ObjectId} filleulId - L'user qui vient d'investir
 */
export const crediterCoffreAuto = async (filleulId) => {
  try {
    // 1. Trouver le parrain du filleul
    const filleul = await User.findById(filleulId).select("parrainId");
    if (!filleul || !filleul.parrainId) return;

    const parrainId = filleul.parrainId;
    const { debut, fin } = getAujourdhuiRange();

    // 2. Vérifier que le filleul est inscrit AUJOURD'HUI
    const filleulFull = await User.findById(filleulId).select("createdAt");
    const inscritAujourdhui =
      filleulFull.createdAt >= debut && filleulFull.createdAt < fin;

    if (!inscritAujourdhui) return; // pas un invité du jour

    // 3. Compter les filleuls N1 inscrits aujourd'hui ET ayant investi
    const filleulsAujourdhui = await User.find({
      parrainId,
      createdAt: { $gte: debut, $lt: fin },
    }).select("_id");

    const filleulsIds = filleulsAujourdhui.map((f) => f._id);
    const investisseursIds = await Investment.distinct("userId", {
      userId: { $in: filleulsIds },
    });
    const invitesQualifies = investisseursIds.length;

    // 4. Récupérer les coffres déjà crédités aujourd'hui
    const coffresOuverts = await TreasureChest.find({
      userId: parrainId,
      dateOuverture: { $gte: debut, $lt: fin },
    });
    const paliersOuverts = coffresOuverts.map((c) => c.palier);

    // 5. Pour chaque palier débloqué non encore crédité → créditer
    for (const coffre of COFFRES) {
      if (invitesQualifies >= coffre.palier && !paliersOuverts.includes(coffre.palier)) {
        // Créditer le parrain
        const parrain = await User.findById(parrainId);
        if (!parrain) continue;

        const soldeAvant = parrain.soldePrincipal;
        parrain.soldePrincipal += coffre.montant;
        await parrain.save();

        // Enregistrer le coffre
        const treasureChest = await TreasureChest.create({
          userId: parrainId,
          palier: coffre.palier,
          montant: coffre.montant,
        });

        // Transaction
        await Transaction.create({
          userId: parrainId,
          type: "BONUS",
          montant: coffre.montant,
          soldeAvant,
          soldeApres: parrain.soldePrincipal,
          description: `Coffre auto-crédité (${coffre.palier} invité${coffre.palier > 1 ? "s" : ""} qualifié${coffre.palier > 1 ? "s" : ""})`,
          referenceId: treasureChest._id,
          statut: "COMPLETEE",
        });

        // Notification au parrain
        await creerNotification({
          userId: parrainId,
          type: "COFFRE_OUVERT",
          titre: "🎁 Coffre débloqué !",
          message: `Bravo ! Vous avez ${invitesQualifies} invité(s) qualifié(s) aujourd'hui. +${coffre.montant} XAF crédités !`,
          lien: "/coffre",
          montant: coffre.montant,
        });

        console.log(`🎁 Coffre auto-crédité : ${parrain.nom} +${coffre.montant} XAF (palier ${coffre.palier})`);
      }
    }
  } catch (error) {
    console.error("Erreur crediterCoffreAuto :", error.message);
  }
};