// Helpers pour gérer les semaines (Lundi 00h00 → Dimanche 23h59)

// Retourne le lundi 00h00 de la semaine d'une date donnée
export const getDebutSemaine = (date = new Date()) => {
  const d = new Date(date);
  const jour = d.getDay(); // 0 = dimanche, 1 = lundi, ..., 6 = samedi
  const diff = jour === 0 ? -6 : 1 - jour; // si dimanche, recule de 6
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Retourne le dimanche 23h59:59 de la semaine d'une date donnée
export const getFinSemaine = (date = new Date()) => {
  const debut = getDebutSemaine(date);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 6);
  fin.setHours(23, 59, 59, 999);
  return fin;
};

// Retourne la clé unique d'une semaine (ex: "2026-W24")
export const getCleSemaine = (date = new Date()) => {
  const debut = getDebutSemaine(date);
  const year = debut.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const numberOfDays = Math.floor((debut - oneJan) / (24 * 60 * 60 * 1000));
  const weekNum = Math.ceil((debut.getDay() + 1 + numberOfDays) / 7);
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
};

// Retourne le début/fin de la semaine PRÉCÉDENTE
export const getSemaineDerniere = () => {
  const aujourdhui = new Date();
  const semaineDerniere = new Date(aujourdhui);
  semaineDerniere.setDate(aujourdhui.getDate() - 7);
  return {
    debut: getDebutSemaine(semaineDerniere),
    fin: getFinSemaine(semaineDerniere),
    cle: getCleSemaine(semaineDerniere),
  };
};

// Retourne le début/fin de la semaine en cours
export const getSemaineCourante = () => {
  return {
    debut: getDebutSemaine(),
    fin: getFinSemaine(),
    cle: getCleSemaine(),
  };
};

// Jours restants avant fin de semaine
export const joursRestantsSemaine = () => {
  const fin = getFinSemaine();
  const diff = fin.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};