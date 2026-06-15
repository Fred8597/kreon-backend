import mongoose from "mongoose";

// Configuration générale de la plateforme (singleton)
const settingsSchema = new mongoose.Schema(
  {
    // Numéros agents KREON pour recevoir les paiements MoMo
    numeroAgentMTN: {
      type: String,
      default: "672599783",
    },
    numeroAgentORANGE: {
      type: String,
      default: "696554872",
    },
    nomAgentMTN: {
      type: String,
      default: "KREON",
    },
    nomAgentORANGE: {
      type: String,
      default: "KREON",
    },
    // Pour gérer plus de paramètres à l'avenir
    actif: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Méthode statique : récupérer ou créer la config unique
settingsSchema.statics.getInstance = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const Settings = mongoose.model("Settings", settingsSchema);
export default Settings;