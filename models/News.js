import mongoose from "mongoose";

const newsSchema = new mongoose.Schema(
  {
    titre: {
      type: String,
      required: true,
      trim: true,
    },
    contenu: {
      type: String,
      required: true,
    },
    extrait: {
      type: String,
      default: "",
    },
    image: {
      type: String,
      default: "",
    },
    categorie: {
      type: String,
      enum: ["NOUVEAUTE", "TECH", "MARCHE", "PROMO", "ANNONCE"],
      default: "ANNONCE",
    },
    badge: {
      type: String,
      enum: ["HOT", "NOUVEAU", "URGENT", null],
      default: null,
    },
    auteur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    estPublie: {
      type: Boolean,
      default: true,
    },
    vues: {
      type: Number,
      default: 0,
    },
    epingle: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const News = mongoose.model("News", newsSchema);
export default News;