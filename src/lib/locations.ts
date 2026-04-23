export interface LocationData {
  slug: string;
  name: string;
  type: string;
  address: string;
  street: string;
  city: string;
  postalCode: string;
  phone: string;
  hours: string;
  hoursSpec: { dayOfWeek: string[]; opens: string; closes: string }[];
  description: string;
  h1: string;
  mapEmbed: string;
  image: string;
  images?: string[];
}

export const locationsData: Record<string, LocationData> = {
  tarragona: {
    slug: "tarragona",
    name: "Lo Zio Tarragona",
    type: "Pizzería italiana",
    address: "Carrer Reding 32 Bajos, Tarragona",
    street: "Carrer Reding 32 Bajos",
    city: "Tarragona",
    postalCode: "43001",
    phone: "+34 687 605 647",
    hours: "Miércoles - Lunes 19:00 - 23:30",
    hoursSpec: [
      {
        dayOfWeek: ["Monday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "19:00",
        closes: "23:30",
      },
    ],
    description:
      "Lo Zio Tarragona es nuestra pizzería artesanal ubicada en el corazón de Tarragona, delante del emblemático mercado de Tarragona del 1915. Disfruta de auténtica pizza italiana elaborada con ingredientes frescos.",
    h1: "Lo Zio Tarragona — Pizzería en Carrer Reding",
    mapEmbed:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3019.8!2d1.2456!3d41.1167!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sCarrer+Reding+32+Tarragona!5e0!3m2!1ses!2ses",
    image: "/placeholder.svg",
  },
  arrabassada: {
    slug: "arrabassada",
    name: "Lo Zio Arrabassada",
    type: "Pizzería italiana",
    address: "Carrer Joan Fuster 28, Tarragona",
    street: "Carrer Joan Fuster 28",
    city: "Tarragona",
    postalCode: "43007",
    phone: "+34 682 239 035",
    hours: "Martes - Domingo 19:00 - 23:30",
    hoursSpec: [
      {
        dayOfWeek: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "19:00",
        closes: "23:30",
      },
    ],
    description:
      "Lo Zio Arrabassada se encuentra en la zona residencial del barrio de Arrabassada, a 1 minuto de una de las mejores playas de Tarragona.",
    h1: "Lo Zio Arrabassada — Pizzería en Carrer Joan Fuster",
    mapEmbed:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3019.8!2d1.2656!3d41.1267!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sCarrer+Joan+Fuster+28+Tarragona!5e0!3m2!1ses!2ses",
    image: "https://lnrnyahzkqqnvlpzrdlv.supabase.co/storage/v1/object/public/media/videos/LOCAL_ARRABASSADA.jpg",
    images: [
      "https://lnrnyahzkqqnvlpzrdlv.supabase.co/storage/v1/object/public/media/videos/LOCAL_ARRABASSADA.jpg",
      "https://lnrnyahzkqqnvlpzrdlv.supabase.co/storage/v1/object/public/media/videos/LOCAL_ARRABASSADA_HORNO.jpg",
    ],
  },
  rincon: {
    slug: "rincon",
    name: "El Rincón de Lo Zio",
    type: "Bar de paninis artesanales",
    address: "Carrer dels Castellers de Tarragona 3, Tarragona",
    street: "Carrer dels Castellers de Tarragona 3",
    city: "Tarragona",
    postalCode: "43003",
    phone: "+34 687 605 647",
    hours: "Lunes - Sábado 8:00 - 22:00",
    hoursSpec: [
      {
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "08:00",
        closes: "22:00",
      },
    ],
    description:
      "El Rincón de Lo Zio es nuestro bar de paninis artesanales en Tarragona. Perfecto para desayunos, almuerzos y meriendas.",
    h1: "El Rincón de Lo Zio — Bar de Paninis en Tarragona",
    mapEmbed:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3019.8!2d1.2556!3d41.1197!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sCarrer+dels+Castellers+Tarragona!5e0!3m2!1ses!2ses",
    image: "/placeholder.svg",
  },
};
