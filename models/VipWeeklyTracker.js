import mongoose from "mongoose";

const vipWeeklyTrackerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Clé unique de la semaine (ex: "2026-W24")
    cleSemaine: {
      type: String,
      required: true,
    },
    // Début et fin de la semaine
    dateDebut: {
      type: Date,
      required: true,
    },
    dateFin: {
      type: Date,
      required: true,
    },
    // Nombre de sub directs ramenés cette semaine (par lui ou son équipe)
    nouveauxSubDirects: {
      type: Number,
      default: 0,
    },
    // Quota requis pour cette semaine (selon le niveau VIP au moment)
    quotaRequis: {
      type: Number,
      default: 0,
    },
    // Niveau VIP au moment de la création du tracker
    niveauVIPSnapshot: {
      type: Number,
      default: 0,
    },
    // Cette semaine a-t-elle été vérifiée ?
    verifiee: {
      type: Boolean,
      default: false,
    },
    // Résultat de la vérification
    quotaAtteint: {
      type: Boolean,
      default: false,
    },
    dateVerification: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Index unique : 1 tracker par user par semaine
vipWeeklyTrackerSchema.index({ userId: 1, cleSemaine: 1 }, { unique: true });

const VipWeeklyTracker = mongoose.model("VipWeeklyTracker", vipWeeklyTrackerSchema);
export default VipWeeklyTracker;