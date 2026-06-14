import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "RECHARGE_VALIDEE",
        "RECHARGE_REFUSEE",
        "RETRAIT_VALIDE",
        "RETRAIT_REFUSE",
        "RETRAIT_PAYE",
        "ROI_VERSE",
        "COMMISSION_RECUE",
        "BONUS_RECU",
        "INVESTISSEMENT_CREE",
        "POINTAGE",
        "GIFTCODE",
        "TIRAGE_GAIN",
        "COFFRE_OUVERT",
        "ANNONCE",
        "SYSTEM",
      ],
      required: true,
    },
    titre: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    // Lien optionnel pour rediriger l'user au clic
    lien: {
      type: String,
      default: null,
    },
    // Montant lié (pour les notifs financières)
    montant: {
      type: Number,
      default: null,
    },
    lu: {
      type: Boolean,
      default: false,
    },
    dateLecture: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Index pour requêtes rapides
notificationSchema.index({ userId: 1, lu: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;