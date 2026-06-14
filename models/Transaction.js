import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "RECHARGE",       // Dépôt d'argent
        "RETRAIT",        // Retrait
        "INVESTISSEMENT", // Achat d'un produit
        "GAIN_ROI",       // Rendement reçu
        "COMMISSION",     // Commission parrainage
        "BONUS",          // Bonus (coffre, etc.)
        "REMBOURSEMENT",  // Remboursement
      ],
      required: true,
    },

    montant: {
      type: Number,
      required: true,
    },

    // Solde avant et après (traçabilité)
    soldeAvant: {
      type: Number,
      required: true,
    },
    soldeApres: {
      type: Number,
      required: true,
    },

    description: {
      type: String,
      default: "",
    },

    // Référence à un autre document (recharge, retrait, investissement)
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    referenceType: {
      type: String,
      enum: ["Recharge", "Withdrawal", "Investment", null],
      default: null,
    },

    statut: {
      type: String,
      enum: ["EN_ATTENTE", "COMPLETEE", "ECHOUEE", "ANNULEE"],
      default: "COMPLETEE",
    },
  },
  { timestamps: true }
);

const Transaction = mongoose.model("Transaction", transactionSchema);
export default Transaction;