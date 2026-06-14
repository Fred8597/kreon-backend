import mongoose from "mongoose";

const tirageGrantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Tableau des montants prévus pour chaque tour
    // Ex: [1000, 2500, 800] = 3 tours qui rapporteront ces sommes dans l'ordre
    montants: {
      type: [Number],
      required: true,
      validate: [(arr) => arr.length > 0, "Au moins 1 montant requis"],
    },
    // Index du prochain tour (incrémenté après chaque tour)
    indexCourant: {
      type: Number,
      default: 0,
    },
    // Compteur de tours utilisés
    toursUtilises: {
      type: Number,
      default: 0,
    },
    // Statut
    statut: {
      type: String,
      enum: ["ACTIF", "TERMINE", "ANNULE"],
      default: "ACTIF",
    },
    // Note interne pour l'admin (optionnel)
    note: {
      type: String,
      default: "",
    },
    // Créé par quel admin
    creePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Méthode helper : nb de tours restants
tirageGrantSchema.virtual("toursRestants").get(function () {
  return this.montants.length - this.indexCourant;
});

// Méthode helper : montant total prévu
tirageGrantSchema.virtual("montantTotal").get(function () {
  return this.montants.reduce((sum, m) => sum + m, 0);
});

// Inclure les virtuals dans toJSON
tirageGrantSchema.set("toJSON", { virtuals: true });

tirageGrantSchema.index({ userId: 1, statut: 1 });

const TirageGrant = mongoose.model("TirageGrant", tirageGrantSchema);
export default TirageGrant;