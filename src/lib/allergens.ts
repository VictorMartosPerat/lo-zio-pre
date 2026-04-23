export const EU_ALLERGENS = [
  { id: "gluten", emoji: "🌾", name: "Gluten" },
  { id: "cacahuetes", emoji: "🥜", name: "Cacahuetes" },
  { id: "frutos_cascara", emoji: "🌰", name: "Frutos de cáscara" },
  { id: "crustaceos", emoji: "🦀", name: "Crustáceos" },
  { id: "pescado", emoji: "🐟", name: "Pescado" },
  { id: "huevo", emoji: "🥚", name: "Huevo" },
  { id: "lacteos", emoji: "🥛", name: "Lácteos" },
  { id: "soja", emoji: "🌱", name: "Soja" },
  { id: "apio", emoji: "🌿", name: "Apio" },
  { id: "moluscos", emoji: "🐚", name: "Moluscos" },
  { id: "mostaza", emoji: "🐝", name: "Mostaza" },
  { id: "sesamo", emoji: "🌻", name: "Sésamo" },
  { id: "altramuces", emoji: "☘️", name: "Altramuces" },
  { id: "sulfitos", emoji: "🍷", name: "Sulfitos" },
] as const;

export const getAllergenById = (id: string) =>
  EU_ALLERGENS.find((a) => a.id === id);
