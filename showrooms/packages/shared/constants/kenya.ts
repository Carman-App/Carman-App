/** Towns buyers search by, with their county. The first group is shown as "popular locations". */
export const KENYAN_TOWNS = [
  { town: "Nairobi", county: "Nairobi", popular: true },
  { town: "Mombasa", county: "Mombasa", popular: true },
  { town: "Kisumu", county: "Kisumu", popular: true },
  { town: "Nakuru", county: "Nakuru", popular: true },
  { town: "Eldoret", county: "Uasin Gishu", popular: true },
  { town: "Thika", county: "Kiambu", popular: true },
  { town: "Kiambu", county: "Kiambu", popular: false },
  { town: "Ruiru", county: "Kiambu", popular: false },
  { town: "Kikuyu", county: "Kiambu", popular: false },
  { town: "Machakos", county: "Machakos", popular: false },
  { town: "Athi River", county: "Machakos", popular: false },
  { town: "Kitengela", county: "Kajiado", popular: false },
  { town: "Ngong", county: "Kajiado", popular: false },
  { town: "Nyeri", county: "Nyeri", popular: false },
  { town: "Meru", county: "Meru", popular: false },
  { town: "Embu", county: "Embu", popular: false },
  { town: "Nanyuki", county: "Laikipia", popular: false },
  { town: "Naivasha", county: "Nakuru", popular: false },
  { town: "Kericho", county: "Kericho", popular: false },
  { town: "Kakamega", county: "Kakamega", popular: false },
  { town: "Bungoma", county: "Bungoma", popular: false },
  { town: "Kisii", county: "Kisii", popular: false },
  { town: "Kitale", county: "Trans Nzoia", popular: false },
  { town: "Malindi", county: "Kilifi", popular: false },
  { town: "Kilifi", county: "Kilifi", popular: false },
  { town: "Garissa", county: "Garissa", popular: false },
  { town: "Nyahururu", county: "Laikipia", popular: false },
  { town: "Murang'a", county: "Murang'a", popular: false },
  { town: "Narok", county: "Narok", popular: false },
  { town: "Voi", county: "Taita Taveta", popular: false },
] as const;

export type KenyanTown = (typeof KENYAN_TOWNS)[number]["town"];
export const TOWN_NAMES = KENYAN_TOWNS.map((t) => t.town) as unknown as readonly [KenyanTown, ...KenyanTown[]];
export const POPULAR_TOWNS = KENYAN_TOWNS.filter((t) => t.popular).map((t) => t.town);

export function countyOf(town: string): string | undefined {
  return KENYAN_TOWNS.find((t) => t.town === town)?.county;
}

/**
 * Default makes and models. The live list is the admin-managed Category
 * collection, seeded from this; clients fetch it from GET /categories.
 */
export const DEFAULT_MAKES: { name: string; models: string[] }[] = [
  { name: "Toyota", models: ["Axio", "Fielder", "Premio", "Allion", "Vitz", "Belta", "Probox", "Succeed", "Corolla", "Mark X", "Crown", "Harrier", "RAV4", "Land Cruiser Prado", "Land Cruiser", "Hilux", "Fortuner", "Noah", "Voxy", "Sienta", "Passo", "Hiace", "Wish", "Aqua", "Prius", "C-HR"] },
  { name: "Nissan", models: ["Note", "March", "Tiida", "Sylphy", "Juke", "X-Trail", "Dualis", "Navara", "Patrol", "Wingroad", "AD Van", "Serena", "Caravan", "Leaf"] },
  { name: "Mazda", models: ["Demio", "Axela", "Atenza", "CX-3", "CX-5", "CX-8", "BT-50", "Verisa"] },
  { name: "Subaru", models: ["Impreza", "Legacy", "Outback", "Forester", "XV", "Levorg", "WRX"] },
  { name: "Honda", models: ["Fit", "Insight", "Vezel", "CR-V", "Freed", "Stream", "Civic", "Accord", "Grace"] },
  { name: "Mitsubishi", models: ["Outlander", "Pajero", "RVR", "L200", "Lancer", "Galant", "Canter"] },
  { name: "Volkswagen", models: ["Polo", "Golf", "Passat", "Tiguan", "Touareg", "Amarok"] },
  { name: "Mercedes-Benz", models: ["A-Class", "C-Class", "E-Class", "S-Class", "GLA", "GLC", "GLE", "ML", "G-Class"] },
  { name: "BMW", models: ["1 Series", "3 Series", "5 Series", "X1", "X3", "X5", "X6"] },
  { name: "Audi", models: ["A3", "A4", "A6", "Q3", "Q5", "Q7"] },
  { name: "Land Rover", models: ["Range Rover", "Range Rover Sport", "Range Rover Evoque", "Discovery", "Discovery Sport", "Defender"] },
  { name: "Isuzu", models: ["D-Max", "MU-X", "NPR", "FRR"] },
  { name: "Suzuki", models: ["Swift", "Alto", "Every", "Escudo", "Jimny", "Vitara", "Ertiga"] },
  { name: "Ford", models: ["Ranger", "Everest", "Focus", "Fiesta", "Kuga"] },
  { name: "Lexus", models: ["RX", "NX", "LX", "IS", "GX"] },
  { name: "Hyundai", models: ["Tucson", "Santa Fe", "Creta", "i10", "i20"] },
  { name: "Kia", models: ["Sportage", "Sorento", "Picanto", "Rio"] },
  { name: "Peugeot", models: ["208", "308", "3008", "508", "Landtrek"] },
  { name: "Jeep", models: ["Grand Cherokee", "Wrangler", "Compass"] },
  { name: "Porsche", models: ["Cayenne", "Macan", "Panamera"] },
];
