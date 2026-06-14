import cron from "node-cron";
import { traiterInvestissementsExpires } from "../controllers/investmentController.js";
import {
  verifierQuotasSemaineDerniere,
  verifierRattrapageVIP,
  notifierQuotaProche,
} from "./verifierQuotasVIP.js";

export const demarrerCronJobs = () => {
  // ===== INVESTISSEMENTS EXPIRÉS =====
  // Toutes les 10 minutes
  cron.schedule("*/10 * * * *", async () => {
    try {
      const nombre = await traiterInvestissementsExpires();
      if (nombre > 0) {
        console.log(`✅ [CRON] ${nombre} investissement(s) traité(s)`);
      }
    } catch (error) {
      console.error("❌ [CRON Invest] Erreur :", error.message);
    }
  });

  // ===== VIP : Vérification quotas semaine dernière (Lundi 00h05) =====
  cron.schedule("5 0 * * 1", async () => {
    try {
      console.log("⏰ [CRON LUNDI] Vérification quotas VIP semaine dernière...");
      const result = await verifierQuotasSemaineDerniere();
      console.log(
        `✅ [CRON VIP S-1] ${result.nbSuspendus} suspendu(s), ${result.nbReactives} réactivé(s)`
      );
    } catch (error) {
      console.error("❌ [CRON VIP S-1] Erreur :", error.message);
    }
  });

  // ===== VIP : Vérification rattrapage (chaque jour à 06h00) =====
  cron.schedule("0 6 * * *", async () => {
    try {
      console.log("⏰ [CRON QUOTIDIEN] Vérification rattrapage VIP...");
      const nb = await verifierRattrapageVIP();
      if (nb > 0) {
        console.log(`✅ [CRON VIP Rattrapage] ${nb} VIP réactivé(s)`);
      }
    } catch (error) {
      console.error("❌ [CRON VIP Rattrapage] Erreur :", error.message);
    }
  });

  // ===== VIP : Notification quota proche (Jeudi 10h00) =====
  cron.schedule("0 10 * * 4", async () => {
    try {
      console.log("⏰ [CRON JEUDI] Notification quota VIP proche...");
      const nb = await notifierQuotaProche();
      console.log(`✅ [CRON VIP Notif] ${nb} notification(s) envoyée(s)`);
    } catch (error) {
      console.error("❌ [CRON VIP Notif] Erreur :", error.message);
    }
  });

  console.log("⏰ Cron jobs démarrés");
  console.log("   - Investissements expirés : toutes les 10 min");
  console.log("   - VIP vérif quotas S-1 : Lundi 00h05");
  console.log("   - VIP rattrapage : chaque jour 06h00");
  console.log("   - VIP notif rappel : Jeudi 10h00");
};