// Vérifier si on est dans les horaires de retrait autorisés
export const estDansHorairesRetrait = () => {
  const maintenant = new Date();
  const jour = maintenant.getDay(); // 0 = dimanche, 1 = lundi, ..., 6 = samedi
  const heure = maintenant.getHours();

  // Dimanche : fermé
  if (jour === 0) {
    return {
      autorise: false,
      message: "Les retraits ne sont pas disponibles le dimanche",
    };
  }

  // Samedi : 6h - 14h
  if (jour === 6) {
    if (heure < 6 || heure >= 14) {
      return {
        autorise: false,
        message: "Le samedi, les retraits sont disponibles de 6h à 14h",
      };
    }
    return { autorise: true };
  }

  // Lundi à vendredi : 6h - 18h
  if (heure < 6 || heure >= 18) {
    return {
      autorise: false,
      message: "Les retraits sont disponibles de 6h à 18h (lundi-vendredi)",
    };
  }

  return { autorise: true };
};