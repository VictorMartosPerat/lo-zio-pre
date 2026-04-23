import cocaColaImg from "@/assets/coca-cola.png";
import cocaColaZeroImg from "@/assets/coca-cola-zero.png";
import fantaNaranjaImg from "@/assets/fanta-naranja.png";
import fantaLimonImg from "@/assets/fanta-limon.png";
import fuzeTeaImg from "@/assets/fuze-tea-limon.png";
import aquariusImg from "@/assets/aquarius-limon.png";
import aguaImg from "@/assets/agua-logo.png";
import cervezaImg from "@/assets/estrella-damm.png";
import vinoImg from "@/assets/botella-vino.png";

const TIRAMISU_IMG =
  "https://lnrnyahzkqqnvlpzrdlv.supabase.co/storage/v1/object/public/media/videos/TIRAMISU.jpg";

export interface UpsellItem {
  id: string;
  name: string;
  price: number;
  image: string;
}

export const ALL_UPSELL: UpsellItem[] = [
  { id: "coca-cola",      name: "Coca-Cola",      price: 2.5, image: cocaColaImg },
  { id: "coca-cola-zero", name: "Coca-Cola Zero",  price: 2.5, image: cocaColaZeroImg },
  { id: "fanta-naranja",  name: "Fanta Naranja",   price: 2.5, image: fantaNaranjaImg },
  { id: "fanta-limon",    name: "Fanta Limón",     price: 2.5, image: fantaLimonImg },
  { id: "fuze-tea",       name: "Fuze Tea Limón",  price: 2.5, image: fuzeTeaImg },
  { id: "aquarius",       name: "Aquarius Limón",  price: 2.5, image: aquariusImg },
  { id: "agua",           name: "Agua",            price: 2.5, image: aguaImg },
  { id: "cerveza",        name: "Cerveza",         price: 3,   image: cervezaImg },
  { id: "vino",           name: "Vino botella",    price: 20,  image: vinoImg },
  { id: "tiramisu",       name: "Tiramisú",        price: 6,   image: TIRAMISU_IMG },
];

export const UPSELL_IDS = ALL_UPSELL.map((i) => i.id);
