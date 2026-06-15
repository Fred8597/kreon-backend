import mongoose from "mongoose";

// Stocke les numéros de transaction reçus par l'admin de l'opérateur
// → utilisés pour le matching avec les recharges des users
const transactionReferenceSchema = new mongoose.Schema(
  {
    referencePaiement: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    methode: {
      type: String,
      enum: ["MTN", "ORANGE"],
      required: true,
    },
    // Montant fourni dans l'inventaire (optionnel - pour vérif)
    montant: {
      type: Number,
      default: 0,
    },
    // A-t-il été utilisé pour matcher une recharge ?
    utilise: {
      type: Boolean,
      default: false,
    },
    rechargeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recharge",
      default: null,
    },
    importePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

transactionReferenceSchema.index({ referencePaiement: 1 });
transactionReferenceSchema.index({ utilise: 1, methode: 1 });

const TransactionReference = mongoose.model(
  "TransactionReference",
  transactionReferenceSchema
);
export default TransactionReference;