export interface ExtraItem {
  id: string;
  name: string;
  price: number;
  allergens: string[];
}

export interface ExtraCategory {
  id: string;
  name: string;
  emoji: string;
  items: ExtraItem[];
}

export const extraCategories: ExtraCategory[] = [
  {
    id: "embutidos",
    name: "Embutidos",
    emoji: "🥩",
    items: [
      { id: "jamon_dulce", name: "Jamón dulce", price: 3, allergens: ["gluten", "sulfitos"] },
      { id: "jamon_serrano", name: "Jamón serrano", price: 3, allergens: ["gluten", "sulfitos"] },
      { id: "bacon", name: "Bacon", price: 3, allergens: ["sulfitos"] },
      { id: "salami_milano", name: "Salami milano", price: 3, allergens: ["sulfitos"] },
      { id: "salami_picante", name: "Salami picante", price: 3, allergens: ["sulfitos"] },
      { id: "embutido_calabres", name: "Embutido calabrés", price: 3, allergens: ["sulfitos"] },
      { id: "bresaola", name: "Bresaola", price: 3, allergens: ["sulfitos"] },
      { id: "longaniza", name: "Longaniza", price: 3, allergens: ["sulfitos"] },
      { id: "speck", name: "Speck", price: 3, allergens: ["sulfitos"] },
      { id: "nduja", name: "'Nduja", price: 3, allergens: ["sulfitos"] },
      { id: "porchetta", name: "Porchetta", price: 4, allergens: ["sulfitos"] },
    ],
  },
  {
    id: "quesos",
    name: "Quesos",
    emoji: "🧀",
    items: [
      { id: "mozzarella_extra", name: "Mozzarella extra", price: 3, allergens: ["lacteos"] },
      { id: "fior_di_latte", name: "Fior di latte", price: 5, allergens: ["lacteos"] },
      { id: "mozzarella_bufala", name: "Mozzarella búfala", price: 5, allergens: ["lacteos"] },
      { id: "burrata", name: "Burrata", price: 5, allergens: ["lacteos"] },
      { id: "scamorza", name: "Scamorza", price: 3, allergens: ["lacteos"] },
      { id: "gorgonzola", name: "Gorgonzola", price: 3, allergens: ["lacteos"] },
      { id: "fontina", name: "Fontina", price: 3, allergens: ["lacteos"] },
      { id: "emmental", name: "Emmental", price: 3, allergens: ["lacteos"] },
      { id: "grana_padano", name: "Grana Padano", price: 3, allergens: ["lacteos"] },
      { id: "queso_cabra", name: "Queso de cabra", price: 3, allergens: ["lacteos"] },
    ],
  },
  {
    id: "verduras",
    name: "Verduras",
    emoji: "🥦",
    items: [
      { id: "tomate_fresco", name: "Tomate fresco", price: 2, allergens: [] },
      { id: "tomate_seco", name: "Tomate seco", price: 2, allergens: [] },
      { id: "champinones", name: "Champiñones", price: 2, allergens: [] },
      { id: "cebolla", name: "Cebolla", price: 2, allergens: [] },
      { id: "cebolla_roja", name: "Cebolla roja", price: 2, allergens: [] },
      { id: "pimiento_rojo", name: "Pimiento rojo", price: 2, allergens: [] },
      { id: "calabacin", name: "Calabacín", price: 2, allergens: [] },
      { id: "berenjena", name: "Berenjena", price: 2, allergens: [] },
      { id: "alcachofas", name: "Alcachofas", price: 2, allergens: [] },
      { id: "friarielli", name: "Friarielli", price: 2, allergens: [] },
    ],
  },
  {
    id: "pescado",
    name: "Pescado",
    emoji: "🐟",
    items: [
      { id: "anchoas", name: "Anchoas", price: 3, allergens: ["pescado"] },
      { id: "atun", name: "Atún", price: 3, allergens: ["pescado"] },
      { id: "salmon_ahumado", name: "Salmón ahumado", price: 5, allergens: ["pescado", "sulfitos"] },
    ],
  },
  {
    id: "otros",
    name: "Otros",
    emoji: "✨",
    items: [
      { id: "huevo", name: "Huevo", price: 2, allergens: ["huevo"] },
      { id: "frankfurt", name: "Frankfurt", price: 2, allergens: ["soja", "mostaza", "sulfitos"] },
      { id: "pina", name: "Piña", price: 2, allergens: [] },
      { id: "maiz", name: "Maíz", price: 2, allergens: [] },
      { id: "olivas_negras", name: "Olivas negras", price: 2, allergens: [] },
      { id: "rucula", name: "Rúcula", price: 2, allergens: [] },
      { id: "guindilla", name: "Guindilla", price: 2, allergens: [] },
    ],
  },
];

export const getExtraCategoryEmoji = (categoryId: string): string => {
  return extraCategories.find((c) => c.id === categoryId)?.emoji ?? "➕";
};
