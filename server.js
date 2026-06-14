import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import investmentRoutes from "./routes/investmentRoutes.js";
import newsRoutes from "./routes/newsRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import pointageRoutes from "./routes/pointageRoutes.js";
import giftCodeRoutes from "./routes/giftCodeRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import { demarrerCronJobs } from "./utils/cronJobs.js";
import coffreRoutes from "./routes/coffreRoutes.js";
import tirageRoutes from "./routes/tirageRoutes.js";
import vipRoutes from "./routes/vipRoutes.js";

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

// Fichiers statiques (uploads)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.json({ message: "🚀 API KREON fonctionne !" });
});

// ===== ROUTES (TOUTES AVANT notFound/errorHandler) =====
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/investments", investmentRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/pointage", pointageRoutes);
app.use("/api/giftcodes", giftCodeRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/coffre", coffreRoutes);
app.use("/api/tirage", tirageRoutes);
app.use("/api/vip", vipRoutes);
// ===== MIDDLEWARES D'ERREUR (TOUJOURS EN DERNIER) =====
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

demarrerCronJobs();

app.listen(PORT, () => {
  console.log(`🔥 Serveur lancé sur le port ${PORT}`);
});