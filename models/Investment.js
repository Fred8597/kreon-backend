import mongoose from "mongoose";

const investmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // Détails du produit au moment de l'investissement (snapshot)
    nomProduit: {
      type: String,
      required: true,
    },

    montantInvesti: {
      type: Number,
      required: true,
    },

    dureeJours: {
      type: Number,
      required: true,
    },

    roiPourcentage: {
      type: Number,
      required: true,
    },

    // Montant total à recevoir : montantInvesti + (montantInvesti × roi/100)
    montantTotalARecevoir: {
      type: Number,
      required: true,
    },

    // Dates
    dateDebut: {
      type: Date,
      default: Date.now,
    },
    dateExpiration: {
      type: Date,
      required: true,
    },
    dateCompletion: {
      type: Date,
      default: null,
    },

    statut: {
      type: String,
      enum: ["ACTIF", "TERMINE", "ANNULE"],
      default: "ACTIF",
    },
  },
  { timestamps: true }
);

const Investment = mongoose.model("Investment", investmentSchema);
export default Investment;