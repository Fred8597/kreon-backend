import mongoose from "mongoose";

const treasureChestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Palier ouvert (nombre d'invités requis)
    palier: {
      type: Number,
      required: true,
    },
    montant: {
      type: Number,
      required: true,
    },
    dateOuverture: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

treasureChestSchema.index({ userId: 1, dateOuverture: -1 });

const TreasureChest = mongoose.model("TreasureChest", treasureChestSchema);
export default TreasureChest;