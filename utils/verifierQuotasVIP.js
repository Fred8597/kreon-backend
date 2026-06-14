import User from "../models/User.js";
import Investment from "../models/Investment.js";
import VipWeeklyTracker from "../models/VipWeeklyTracker.js";
import { getNiveauById } from "../config/vipLevels.js";
import { creerNotification } from "./creerNotification.js";
import {
  getDebutSemaine,
  getFinSemaine,
  getCleSemaine,
  getSemaineDerniere,
  getSemaineCourante,
} from "./hebdoHelpers.js";

/**
 * Compte les nouveaux sub directs ramenés par un user (+ son équipe complète)
 * pendant une période donnée
 * @param {ObjectId} userId - VIP à analyser
 * @param {Date} debut - début de la période
 * @param {Date} fin - fin de la période
 */
export const compterNouveauxSubDirects = async (userId, debut, fin) => {
  // 1. Récupérer toute l'équipe du user (N1 à N4)
  const filleulsN1 = await User.find({ parrainId: userId }).select("_id");
  const idsN1 = filleulsN1.map((f) => f._id);

  const filleulsN2 = await User.find({ parrainId: { $in: idsN1 } }).select("_id");
  const idsN2 = filleulsN2.map((f) => f._id);

  const filleulsN3 = await User.find({ parrainId: { $in: idsN2 } }).select("_id");
  const idsN3 = filleulsN3.map((f) => f._id);

  const filleulsN4 = await User.find({ parrainId: { $in: idsN3 } }).select("_id");
  const idsN4 = filleulsN4.map((f) => f._id);

  // Tous les membres de l'équipe + le user lui-même (peut aussi inviter directement)
  const tousMembres = [userId, ...idsN1, ...idsN2, ...idsN3, ...idsN4];

  // 2. Pour chaque membre, trouver leurs filleuls N1 qui ont investi PENDANT la période
  let nouveauxSubDirects = 0;

  for (const membreId of tousMembres) {
    // Filleuls N1 directs de ce membre
    const filleulsDuMembre = await User.find({ parrainId: membreId }).select("_id");
    const idsFilleulsDuMembre = filleulsDuMembre.map((f) => f._id);

    if (idsFilleulsDuMembre.length === 0) continue;

    // Compter ceux qui ont leur PREMIER investissement pendant la période
    for (const filleulId of idsFilleulsDuMembre) {
      const premierInvest = await Investment.findOne({
        userId: filleulId,
      })
        .sort({ createdAt: 1 })
        .select("createdAt");

      if (
        premierInvest &&
        premierInvest.createdAt >= debut &&
        premierInvest.createdAt < fin
      ) {
        nouveauxSubDirects++;
      }
    }
  }

  return nouveauxSubDirects;
};

/**
 * Crée ou met à jour le tracker de la semaine en cours pour un VIP
 */
export const updateTrackerSemaineCourante = async (userId) => {
  const user = await User.findById(userId);
  if (!user || user.niveauVIP === 0) return null;

  const niveau = getNiveauById(user.niveauVIP);
  const { debut, fin, cle } = getSemaineCourante();

  const nb = await compterNouveauxSubDirects(userId, debut, fin);

  // Upsert
  const tracker = await VipWeeklyTracker.findOneAndUpdate(
    { userId, cleSemaine: cle },
    {
      $set: {
        dateDebut: debut,
        dateFin: fin,
        nouveauxSubDirects: nb,
        quotaRequis: niveau.quotaHebdo,
        niveauVIPSnapshot: user.niveauVIP,
      },
    },
    { upsert: true, new: true }
  );

  return tracker;
};

/**
 * Vérifie le quota de la SEMAINE DERNIÈRE pour tous les VIP
 * → Lance la suspension si quota non atteint
 * À exécuter chaque lundi à 00h05
 */
export const verifierQuotasSemaineDerniere = async () => {
  const { debut, fin, cle } = getSemaineDerniere();

  // Récupérer tous les VIP actifs (niveau >= 1)
  const vipUsers = await User.find({ niveauVIP: { $gte: 1 } });

  let nbSuspendus = 0;
  let nbReactives = 0;

  for (const user of vipUsers) {
    // Calculer nb réel de la semaine dernière
    const nbReel = await compterNouveauxSubDirects(user._id, debut, fin);
    const niveau = getNiveauById(user.niveauVIP);
    const quotaAtteint = nbReel >= niveau.quotaHebdo;

    // Mettre à jour ou créer le tracker
    await VipWeeklyTracker.findOneAndUpdate(
      { userId: user._id, cleSemaine: cle },
      {
        $set: {
          dateDebut: debut,
          dateFin: fin,
          nouveauxSubDirects: nbReel,
          quotaRequis: niveau.quotaHebdo,
          niveauVIPSnapshot: user.niveauVIP,
          verifiee: true,
          quotaAtteint,
          dateVerification: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    // Décider du nouveau statut
    if (!quotaAtteint && user.statutVIP === "ACTIF") {
      // SUSPENDRE
      user.statutVIP = "SUSPENDU";
      await user.save();
      nbSuspendus++;

      await creerNotification({
        userId: user._id,
        type: "SYSTEM",
        titre: "⚠️ Salaire VIP suspendu",
        message: `Vous n'avez pas atteint votre quota hebdomadaire (${nbReel}/${niveau.quotaHebdo}). Votre salaire et vos bonus sont suspendus. Continuez à inviter pour les réactiver.`,
        lien: "/vip",
      });
    } else if (quotaAtteint && user.statutVIP === "SUSPENDU") {
      // RÉACTIVER
      user.statutVIP = "ACTIF";
      await user.save();
      nbReactives++;

      await creerNotification({
        userId: user._id,
        type: "BONUS_RECU",
        titre: "✅ Salaire VIP réactivé",
        message: `Bravo ! Vous avez atteint votre quota hebdomadaire. Votre salaire ${niveau.nom} est de nouveau actif.`,
        lien: "/vip",
      });
    }
  }

  console.log(
    `📊 Vérification quotas VIP : ${nbSuspendus} suspendu(s), ${nbReactives} réactivé(s)`
  );
  return { nbSuspendus, nbReactives };
};

/**
 * Vérifie la semaine en cours pour réactivation immédiate si rattrapage
 * À exécuter quotidiennement
 */
export const verifierRattrapageVIP = async () => {
  const { debut, fin, cle } = getSemaineCourante();

  const vipSuspendus = await User.find({
    niveauVIP: { $gte: 1 },
    statutVIP: "SUSPENDU",
  });

  let nbReactives = 0;

  for (const user of vipSuspendus) {
    const nbReel = await compterNouveauxSubDirects(user._id, debut, fin);
    const niveau = getNiveauById(user.niveauVIP);

    if (nbReel >= niveau.quotaHebdo) {
      user.statutVIP = "ACTIF";
      await user.save();
      nbReactives++;

      await creerNotification({
        userId: user._id,
        type: "BONUS_RECU",
        titre: "✅ Salaire VIP réactivé !",
        message: `Vous avez atteint le quota cette semaine (${nbReel}/${niveau.quotaHebdo}). Votre salaire ${niveau.nom} reprend immédiatement.`,
        lien: "/vip",
      });

      // Mettre à jour le tracker
      await VipWeeklyTracker.findOneAndUpdate(
        { userId: user._id, cleSemaine: cle },
        {
          $set: {
            nouveauxSubDirects: nbReel,
            quotaAtteint: true,
          },
        },
        { upsert: true }
      );
    }
  }

  return nbReactives;
};

/**
 * Notification 3 jours avant fin de semaine pour les VIP qui n'ont pas atteint le quota
 * À exécuter le jeudi
 */
export const notifierQuotaProche = async () => {
  const { debut, fin, cle } = getSemaineCourante();

  const vipUsers = await User.find({ niveauVIP: { $gte: 1 } });

  let nbNotifies = 0;

  for (const user of vipUsers) {
    const nbReel = await compterNouveauxSubDirects(user._id, debut, fin);
    const niveau = getNiveauById(user.niveauVIP);

    if (nbReel < niveau.quotaHebdo) {
      const manque = niveau.quotaHebdo - nbReel;
      await creerNotification({
        userId: user._id,
        type: "SYSTEM",
        titre: "⏰ Quota VIP en cours",
        message: `Plus que 3 jours pour ramener encore ${manque} sub direct(s) et conserver votre salaire ${niveau.nom}.`,
        lien: "/vip",
      });
      nbNotifies++;
    }
  }

  console.log(`📨 ${nbNotifies} notification(s) de rappel envoyées`);
  return nbNotifies;
};