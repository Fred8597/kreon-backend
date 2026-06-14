import mongoose from "mongoose";

const withdrawalSchema = new mongoose.Schema(
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

    numeroBeneficiaire: {
      type: String,
      required: true,
    },

    statut: {
      type: String,
      enum: ["EN_ATTENTE", "VALIDEE", "REFUSEE", "PAYEE"],
      default: "EN_ATTENTE",
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

    // Référence du paiement effectué par l'admin
    referencePaiement: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const Withdrawal = mongoose.model("Withdrawal", withdrawalSchema);
export default Withdrawal;