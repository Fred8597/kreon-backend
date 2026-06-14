import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { creerNotification } from "./creerNotification.js";

// Pourcentages des commissions par niveau
const COMMISSIONS = {
  1: 0.12, // 12%
  2: 0.08, // 8%
  3: 0.03, // 3%
  4: 0.01, // 1%
};

/**
 * Distribuer les commissions de parrainage sur 4 niveaux
 * @param {String} userId - ID de l'utilisateur qui investit
 * @param {Number} montantInvesti - Montant investi
 * @param {String} investmentId - ID de l'investissement (référence)
 */
export const distribuerCommissions = async (
  userId,
  montantInvesti,
  investmentId
) => {
  let utilisateurCourant = await User.findById(userId);

  // Parcourir les 4 niveaux
  for (let niveau = 1; niveau <= 4; niveau++) {
    if (!utilisateurCourant.parrainId) break; // Pas de parrain à ce niveau

    const parrain = await User.findById(utilisateurCourant.parrainId);
    if (!parrain) break;

    const pourcentage = COMMISSIONS[niveau];
    const commission = Math.floor(montantInvesti * pourcentage);

    if (commission > 0) {
      const soldeAvant = parrain.soldePrincipal;
      parrain.soldePrincipal += commission;
      parrain.totalGainsParrainage += commission;
      await parrain.save();

      // Créer la transaction
      await Transaction.create({
        userId: parrain._id,
        type: "COMMISSION",
        montant: commission,
        soldeAvant,
        soldeApres: parrain.soldePrincipal,
        description: `Commission N${niveau} (${pourcentage * 100}%) sur investissement de ${montantInvesti} XAF`,
        referenceId: investmentId,
        referenceType: "Investment",
        statut: "COMPLETEE",
      });

            // 🔔 Notification commission
      await creerNotification({
        userId: parrain._id,
        type: "COMMISSION_RECUE",
        titre: `💎 Commission N${niveau} reçue`,
        message: `Vous avez reçu ${commission} XAF de commission (${pourcentage * 100}%) sur un investissement.`,
        lien: "/gains",
        montant: commission,
      });
    }

    utilisateurCourant = parrain; // Remonter d'un niveau
  }
};