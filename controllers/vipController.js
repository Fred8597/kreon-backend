import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import Recharge from "../models/Recharge.js";
import Investment from "../models/Investment.js";
import Transaction from "../models/Transaction.js";
import VipWeeklyTracker from "../models/VipWeeklyTracker.js";
import {
  VIP_LEVELS,
  getNiveauById,
  getProchainNiveau,
} from "../config/vipLevels.js";
import { creerNotification } from "../utils/creerNotification.js";
import {
  updateTrackerSemaineCourante,
  compterNouveauxSubDirects,
} from "../utils/verifierQuotasVIP.js";
import {
  getSemaineCourante,
  getSemaineDerniere,
  joursRestantsSemaine,
} from "../utils/hebdoHelpers.js";

// ===== HELPER : Calculer les stats VIP =====
const calculerStatsVIP = async (userId) => {
  const rechargeAgg = await Recharge.aggregate([
    { $match: { userId, statut: "VALIDEE" } },
    { $group: { _id: null, total: { $sum: "$montant" } } },
  ]);
  const rechargePerso = rechargeAgg[0]?.total || 0;

  const membresEquipe = await User.find({ parrainId: userId }).select("_id");
  const membresEquipeIds = membresEquipe.map((m) => m._id);
  const nbMembresEquipe = membresEquipe.length;

  let subDirects = 0;
  if (membresEquipeIds.length > 0) {
    const investisseursIds = await Investment.distinct("userId", {
      userId: { $in: membresEquipeIds },
    });
    subDirects = investisseursIds.length;
  }

  const rechargeEquipeAgg = await Recharge.aggregate([
    { $match: { userId: { $in: membresEquipeIds }, statut: "VALIDEE" } },
    { $group: { _id: null, total: { $sum: "$montant" } } },
  ]);
  const rechargeEquipe = rechargeEquipeAgg[0]?.total || 0;

  return {
    rechargePerso,
    subDirects,
    membresEquipe: nbMembresEquipe,
    rechargeEquipe,
  };
};

const verifierConditions = (stats, niveauConfig) => {
  const conditions = {
    recharge: {
      ok: stats.rechargePerso >= niveauConfig.rechargeMin,
      actuel: stats.rechargePerso,
      requis: niveauConfig.rechargeMin,
    },
    subDirects: {
      ok:
        niveauConfig.subDirectsMin === 0 ||
        stats.subDirects >= niveauConfig.subDirectsMin,
      actuel: stats.subDirects,
      requis: niveauConfig.subDirectsMin,
    },
    membresEquipe: {
      ok:
        niveauConfig.membresEquipeMin === 0 ||
        stats.membresEquipe >= niveauConfig.membresEquipeMin,
      actuel: stats.membresEquipe,
      requis: niveauConfig.membresEquipeMin,
    },
    rechargeEquipe: {
      ok: stats.rechargeEquipe >= niveauConfig.rechargeEquipeMin,
      actuel: stats.rechargeEquipe,
      requis: niveauConfig.rechargeEquipeMin,
    },
  };

  const toutesValides = Object.values(conditions).every((c) => c.ok);
  return { conditions, toutesValides };
};

// @desc    Statut VIP complet (avec quota hebdo)
// @route   GET /api/vip/statut
// @access  Privé
export const getStatutVIP = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  const stats = await calculerStatsVIP(req.user._id);
  const niveauActuel = getNiveauById(user.niveauVIP);
  const prochainNiveau = getProchainNiveau(user.niveauVIP);

  let progression = null;
  if (prochainNiveau) {
    const { conditions, toutesValides } = verifierConditions(
      stats,
      prochainNiveau
    );
    progression = {
      niveau: prochainNiveau,
      conditions,
      eligible: toutesValides,
    };
  }

  // ===== QUOTA HEBDO =====
  let quotaHebdo = null;
  if (user.niveauVIP >= 1) {
    // Mettre à jour le tracker
    await updateTrackerSemaineCourante(req.user._id);

    const { debut, fin, cle } = getSemaineCourante();
    const trackerActuel = await VipWeeklyTracker.findOne({
      userId: req.user._id,
      cleSemaine: cle,
    });

    // Tracker semaine dernière (pour info)
    const { cle: cleDerniere } = getSemaineDerniere();
    const trackerDerniere = await VipWeeklyTracker.findOne({
      userId: req.user._id,
      cleSemaine: cleDerniere,
    });

    quotaHebdo = {
      semaineEnCours: {
        actuel: trackerActuel?.nouveauxSubDirects || 0,
        requis: niveauActuel.quotaHebdo,
        atteint: (trackerActuel?.nouveauxSubDirects || 0) >= niveauActuel.quotaHebdo,
        dateDebut: debut,
        dateFin: fin,
        joursRestants: joursRestantsSemaine(),
      },
      semaineDerniere: trackerDerniere
        ? {
            actuel: trackerDerniere.nouveauxSubDirects,
            requis: trackerDerniere.quotaRequis,
            atteint: trackerDerniere.quotaAtteint,
            verifiee: trackerDerniere.verifiee,
          }
        : null,
    };
  }

  res.json({
    niveauActuel,
    prochainNiveau: progression,
    statutVIP: user.statutVIP,
    stats,
    quotaHebdo,
    salaireDernierVerse: user.dateDernierSalaireVIP,
    tousNiveaux: VIP_LEVELS,
  });
});

// @desc    Demander la mise à niveau
// @route   POST /api/vip/upgrade
// @access  Privé
export const upgradeVIP = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const prochainNiveau = getProchainNiveau(user.niveauVIP);

  if (!prochainNiveau) {
    res.status(400);
    throw new Error("Vous êtes déjà au niveau maximum (NVIP10)");
  }

  const stats = await calculerStatsVIP(req.user._id);
  const { toutesValides } = verifierConditions(stats, prochainNiveau);

  if (!toutesValides) {
    res.status(400);
    throw new Error(
      "Vous ne remplissez pas toutes les conditions pour cette mise à niveau"
    );
  }

  user.niveauVIP = prochainNiveau.niveau;
  user.statutVIP = "ACTIF";
  await user.save();

  await creerNotification({
    userId: user._id,
    type: "BONUS_RECU",
    titre: `👑 Promotion ${prochainNiveau.nom} !`,
    message: `Félicitations ! Vous êtes maintenant ${prochainNiveau.nom}. Vous toucherez ${prochainNiveau.salaireJour} XAF/jour avec votre pointage. Quota hebdo : ${prochainNiveau.quotaHebdo} nouveaux sub directs.`,
    lien: "/vip",
  });

  res.json({
    message: `🎉 Promotion vers ${prochainNiveau.nom} réussie !`,
    nouveauNiveau: prochainNiveau,
  });
});

// @desc    Historique salaires
// @route   GET /api/vip/historique-salaire
// @access  Privé
export const getHistoriqueSalaire = asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({
    userId: req.user._id,
    description: { $regex: /salaire VIP/i },
  })
    .sort({ createdAt: -1 })
    .limit(30);

  res.json(transactions);
});