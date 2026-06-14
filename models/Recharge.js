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
      min: 1000, // Minimum 1000 XAF
    },

    methode: {
      type: String,
      enum: ["MTN", "ORANGE", "AUTRE"],
      required: true,
    },

    numeroPayeur: {
      type: String,
      required: true,
    },

    // Numéro de transaction Mobile Money fourni par l'utilisateur
    referencePaiement: {
      type: String,
      default: "",
    },

    // Preuve de paiement (URL de l'image uploadée)
    preuvePaiement: {
      type: String,
      default: "",
    },

    statut: {
      type: String,
      enum: ["EN_ATTENTE", "VALIDEE", "REFUSEE"],
      default: "EN_ATTENTE",
    },

    // Commentaire admin (raison du refus, etc.)
    commentaireAdmin: {
      type: String,
      default: "",
    },

    // Qui a validé/refusé
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

const Recharge = mongoose.model("Recharge", rechargeSchema);
export default Recharge;