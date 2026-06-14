import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    telephone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    pin: {
      type: String,
      default: null,
    },
    codeParrainage: {
      type: String,
      unique: true,
      required: true,
    },
    parrainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    soldePrincipal: {
      type: Number,
      default: 0,
    },
    soldeBonus: {
      type: Number,
      default: 0,
    },
    totalInvites: {
      type: Number,
      default: 0,
    },
    totalGainsParrainage: {
      type: Number,
      default: 0,
    },
    niveauVIP: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },
    statutVIP: {
      type: String,
      enum: ["ACTIF", "SUSPENDU"],
      default: "ACTIF",
    },
    dateDernierSalaireVIP: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: ["user", "moderator", "admin"],
      default: "user",
    },
    estActif: {
      type: Boolean,
      default: true,
    },
    estVerifie: {
      type: Boolean,
      default: false,
    },
    numeroMobileMoney: {
      type: String,
      default: null,
    },
    operateurMobileMoney: {
      type: String,
      enum: ["MTN", "ORANGE", null],
      default: null,
    },
    derniereConnexion: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Hash du password avant sauvegarde
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Méthode pour comparer le mot de passe
userSchema.methods.comparerPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Méthode pour comparer le PIN
userSchema.methods.comparerPin = async function (pin) {
  if (!this.pin) return false;
  return await bcrypt.compare(pin, this.pin);
};

const User = mongoose.model("User", userSchema);
export default User;