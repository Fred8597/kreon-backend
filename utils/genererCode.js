// Génère un code de parrainage unique (ex: KRN8X29P)
const genererCodeParrainage = () => {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "KRN";
  for (let i = 0; i < 5; i++) {
    code += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return code;
};

export default genererCodeParrainage;