import mongoose from "mongoose";

const dailyCheckinSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    montant: {
      type: Number,
      default: 50,
    },
    dateCheckin: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index pour rechercher rapidement les checkins par jour
dailyCheckinSchema.index({ userId: 1, dateCheckin: -1 });

const DailyCheckin = mongoose.model("DailyCheckin", dailyCheckinSchema);
export default DailyCheckin;