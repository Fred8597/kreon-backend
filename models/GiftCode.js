import mongoose from "mongoose";

const giftCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    montant: {
      type: Number,
      required: true,
      min: 1,
    },
    description: {
      type: String,
      default: "",
    },
    // Date d'expiration (par défaut minuit du jour de création)
    dateExpiration: {
      type: Date,
      required: true,
    },
    // Nombre maximum d'utilisations (0 = illimité)
    utilisationsMax: {
      type: Number,
      default: 0,
    },
    // Compteur d'utilisations
    utilisationsActuelles: {
      type: Number,
      default: 0,
    },
    // Liste des users qui ont utilisé ce code
    utilisateursIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Créé par quel admin
    creePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Actif ou désactivé manuellement
    estActif: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Méthode helper : vérifier si le code est encore valide
giftCodeSchema.methods.estValide = function () {
  if (!this.estActif) return false;
  if (new Date() > this.dateExpiration) return false;
  if (
    this.utilisationsMax > 0 &&
    this.utilisationsActuelles >= this.utilisationsMax
  )
    return false;
  return true;
};

// Méthode helper : vérifier si un user a déjà utilisé
giftCodeSchema.methods.dejaUtilisePar = function (userId) {
  return this.utilisateursIds.some((id) => id.toString() === userId.toString());
};

const GiftCode = mongoose.model("GiftCode", giftCodeSchema);
export default GiftCode;