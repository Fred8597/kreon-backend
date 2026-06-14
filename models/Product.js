import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    image: {
      type: String,
      default: "",
    },

    // ===== CATÉGORIE =====
    categorie: {
      type: String,
      enum: ["IA", "NVIP", "SUPER_IA", "DUREE_LIMITEE"],
      required: true,
      default: "IA",
    },

    // ===== PRIX & RENDEMENT =====
    prix: {
      type: Number,
      required: true,
      min: 1,
    },
    // Montant retour = le revenu seul (hors mise)
    // User recevra à la fin : prix + montantRetour
    montantRetour: {
      type: Number,
      required: true,
      min: 0,
    },

    // ===== DURÉE =====
    dureeJours: {
      type: Number,
      required: true,
      min: 1,
    },

    // ===== STOCK =====
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    // ===== LIMITE D'ACHAT PAR USER =====
    // 0 = illimité
    limiteAchat: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ===== POUR CATÉGORIE NVIP =====
    // Niveau VIP minimum requis (1-10)
    // VIP supérieur peut acheter (>=)
    niveauVIPRequis: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },

    // ===== POUR CATÉGORIE SUPER_IA =====
    // Nombre de filleuls N1 requis pour débloquer
    filleulsRequis: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ===== POUR CATÉGORIE DUREE_LIMITEE =====
    // Date de début de disponibilité (compte à rebours avant cette date)
    dateDebut: {
      type: Date,
      default: null,
    },
    // Date de fin de disponibilité
    dateFin: {
      type: Date,
      default: null,
    },

    // ===== STATUT =====
    estActif: {
      type: Boolean,
      default: true,
    },

    // Badge marketing (optionnel)
    badge: {
      type: String,
      enum: ["HOT", "NOUVEAU", "POPULAIRE", "VIP", null],
      default: null,
    },

    ordre: {
      type: Number,
      default: 0,
    },

    createurId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// ===== VIRTUELS =====

// Rendement % calculé automatiquement
productSchema.virtual("rendementPourcentage").get(function () {
  if (!this.prix || this.prix === 0) return 0;
  return Math.round((this.montantRetour / this.prix) * 100);
});

// Montant total reçu à l'échéance
productSchema.virtual("montantTotal").get(function () {
  return this.prix + this.montantRetour;
});

// Pour catégorie DUREE_LIMITEE : statut du produit
productSchema.virtual("statutTemporel").get(function () {
  if (this.categorie !== "DUREE_LIMITEE") return null;

  const now = new Date();
  if (this.dateDebut && now < this.dateDebut) {
    return "AVANT_LANCEMENT"; // compte à rebours visible
  }
  if (this.dateFin && now > this.dateFin) {
    return "TERMINE";
  }
  return "DISPONIBLE";
});

// Pour stock = 0
productSchema.virtual("estEpuise").get(function () {
  return this.stock === 0;
});

// Inclure les virtuals dans JSON
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

const Product = mongoose.model("Product", productSchema);
export default Product;