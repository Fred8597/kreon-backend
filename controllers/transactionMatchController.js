import asyncHandler from "express-async-handler";
import TransactionReference from "../models/TransactionReference.js";
import Recharge from "../models/Recharge.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { creerNotification } from "../utils/creerNotification.js";

// @desc    Admin importe une liste de numéros de transaction
// @route   POST /api/admin/transaction-references/import
// @access  Admin
export const importerReferences = asyncHandler(async (req, res) => {
  const { references, methode } = req.body;

  if (!references || !Array.isArray(references) || references.length === 0) {
    res.status(400);
    throw new Error("Liste de références requise");
  }

  if (!methode || !["MTN", "ORANGE"].includes(methode)) {
    res.status(400);
    throw new Error("Méthode invalide (MTN ou ORANGE)");
  }

  let ajoutees = 0;
  let dejaExistantes = 0;
  let matches = 0;
  const matchesDetails = [];

  for (const ref of references) {
    const refNet = ref.trim();
    if (!refNet) continue;

    // Vérifier si existe déjà
    const existe = await TransactionReference.findOne({
      referencePaiement: refNet,
    });
    if (existe) {
      dejaExistantes++;
      continue;
    }

    // Ajouter dans l'inventaire
    const newRef = await TransactionReference.create({
      referencePaiement: refNet,
      methode,
      importePar: req.user._id,
    });
    ajoutees++;

    // ===== TENTER MATCHING avec recharges en attente =====
    const rechargeEnAttente = await Recharge.findOne({
      referencePaiement: refNet,
      methode,
      statut: "EN_ATTENTE",
    });

    if (rechargeEnAttente) {
      // MATCH ! Valider auto
      const user = await User.findById(rechargeEnAttente.userId);
      if (user) {
        const soldeAvant = user.soldePrincipal;
        user.soldePrincipal += rechargeEnAttente.montant;
        await user.save();

        rechargeEnAttente.statut = "VALIDEE";
        rechargeEnAttente.valideeAutomatiquement = true;
        rechargeEnAttente.valideePar = req.user._id;
        rechargeEnAttente.dateValidation = new Date();
        await rechargeEnAttente.save();

        newRef.utilise = true;
        newRef.rechargeId = rechargeEnAttente._id;
        await newRef.save();

        await Transaction.create({
          userId: user._id,
          type: "RECHARGE",
          montant: rechargeEnAttente.montant,
          soldeAvant,
          soldeApres: user.soldePrincipal,
          description: `Recharge validée par matching (${methode}) - Ref: ${refNet}`,
          referenceId: rechargeEnAttente._id,
          referenceType: "Recharge",
          statut: "COMPLETEE",
        });

        await creerNotification({
          userId: user._id,
          type: "RECHARGE_VALIDEE",
          titre: "⚡ Recharge validée !",
          message: `Votre recharge de ${rechargeEnAttente.montant} XAF (${methode}) a été validée par matching automatique.`,
          lien: "/recharges",
          montant: rechargeEnAttente.montant,
        });

        matches++;
        matchesDetails.push({
          reference: refNet,
          montant: rechargeEnAttente.montant,
          user: user.nom,
        });
      }
    }
  }

  res.json({
    message: `Import terminé : ${ajoutees} ajoutées, ${dejaExistantes} déjà existantes, ${matches} match(s) trouvé(s)`,
    stats: {
      ajoutees,
      dejaExistantes,
      matches,
      total: references.length,
    },
    matchesDetails,
  });
});

// @desc    Liste de l'inventaire des références admin
// @route   GET /api/admin/transaction-references
// @access  Admin
export const getReferences = asyncHandler(async (req, res) => {
  const { methode, utilise } = req.query;

  const filter = {};
  if (methode) filter.methode = methode;
  if (utilise !== undefined) filter.utilise = utilise === "true";

  const refs = await TransactionReference.find(filter)
    .populate("importePar", "nom")
    .populate("rechargeId", "userId montant statut")
    .sort({ createdAt: -1 })
    .limit(500);

  res.json(refs);
});

// @desc    Stats de l'inventaire
// @route   GET /api/admin/transaction-references/stats
// @access  Admin
export const getStatsReferences = asyncHandler(async (req, res) => {
  const totalMTN = await TransactionReference.countDocuments({ methode: "MTN" });
  const totalORANGE = await TransactionReference.countDocuments({ methode: "ORANGE" });
  const utiliseesMTN = await TransactionReference.countDocuments({
    methode: "MTN",
    utilise: true,
  });
  const utiliseesORANGE = await TransactionReference.countDocuments({
    methode: "ORANGE",
    utilise: true,
  });

  res.json({
    MTN: { total: totalMTN, utilisees: utiliseesMTN, disponibles: totalMTN - utiliseesMTN },
    ORANGE: { total: totalORANGE, utilisees: utiliseesORANGE, disponibles: totalORANGE - utiliseesORANGE },
  });
});

// @desc    Supprimer une référence
// @route   DELETE /api/admin/transaction-references/:id
// @access  Admin
export const supprimerReference = asyncHandler(async (req, res) => {
  const ref = await TransactionReference.findById(req.params.id);
  if (!ref) {
    res.status(404);
    throw new Error("Référence introuvable");
  }
  await ref.deleteOne();
  res.json({ message: "Référence supprimée" });
});