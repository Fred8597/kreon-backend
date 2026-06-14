import mongoose from "mongoose";

const tirageHistoriqueSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    grantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TirageGrant",
      required: true,
    },
    montant: {
      type: Number,
      required: true,
    },
    dateTour: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

tirageHistoriqueSchema.index({ userId: 1, dateTour: -1 });

const TirageHistorique = mongoose.model("TirageHistorique", tirageHistoriqueSchema);
export default TirageHistorique;