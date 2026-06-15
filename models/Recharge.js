import mongoose from "mongoose";

const rechargeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    montant: {
      type: Number,
      required: true,
      min: 1000,
    },

    methode: {
      type: String,
      enum: ["MTN", "ORANGE"],
      required: true,
    },

    // Numéro de l'agent KREON qui a reçu le paiement
    numeroAgent: {
      type: String,
      default: "",
    },

    // Numéro Mobile Money de l'user qui a payé (depuis lequel le paiement vient)
    numeroPayeur: {
      type: String,
      required: true,
    },

    // ⭐ Numéro de transaction OBLIGATOIRE (fourni par MTN/Orange)
    referencePaiement: {
      type: String,
      required: true,
      trim: true,
    },

    // Preuve image OPTIONNELLE (URL de l'image uploadée)
    preuvePaiement: {
      type: String,
      default: "",
    },

    statut: {
      type: String,
      enum: ["EN_ATTENTE", "VALIDEE", "REFUSEE"],
      default: "EN_ATTENTE",
    },

    // Validation auto via matching numéros
    valideeAutomatiquement: {
      type: Boolean,
      default: false,
    },

    commentaireAdmin: {
      type: String,
      default: "",
    },

    valideePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    dateValidation: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Index pour recherche rapide par référence
rechargeSchema.index({ referencePaiement: 1, statut: 1 });

const Recharge = mongoose.model("Recharge", rechargeSchema);
export default Recharge;