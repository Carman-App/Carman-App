/**
 * Make/model/year reference catalogue — extracted verbatim from the Carma
 * clickable prototype (`CAR_MAKES`, `MOTO_MAKES`, `YEARS` in the prototype's
 * source). This is genuine reference data (not user data), so a curated
 * static list is the correct real implementation, not a placeholder — the
 * prototype's own onboarding MAKE/MODEL screen uses exactly this table to
 * drive its make/model/year pickers.
 *
 * Keep in sync with the prototype if it ever adds more makes/models.
 */

export const CAR_MAKES: Record<string, string[]> = {
  Toyota: [
    'Land Cruiser Prado', 'Land Cruiser 200', 'Land Cruiser 300', 'Land Cruiser 79', 'Hilux', 'Hiace',
    'Corolla', 'Corolla Cross', 'Corolla Fielder', 'RAV4', 'Vitz', 'Yaris', 'Harrier', 'Fortuner', 'Rush',
    'Passo', 'Premio', 'Allion', 'Axio', 'Wish', 'Noah', 'Voxy', 'Alphard', 'Avensis', 'Auris', 'Belta',
    'Succeed', 'Probox', 'Mark X', 'Crown', 'Camry', 'Ractis', 'Sienta', 'bZ4X', 'Prius', 'Aqua',
    'Hilux Surf', 'Coaster', 'Dyna',
  ],
  Nissan: [
    'X-Trail', 'Note', 'Navara', 'Patrol', 'Juke', 'Sylphy', 'Qashqai', 'Serena', 'Tiida', 'March',
    'Wingroad', 'AD Van', 'Caravan', 'Murano', 'Pathfinder', 'Dualis', 'Latio', 'Sunny', 'Teana',
    'Elgrand', 'Leaf', 'Almera', 'Magnite', 'NP200', 'NP300',
  ],
  Subaru: ['Forester', 'Outback', 'Impreza', 'Legacy', 'XV', 'Levorg', 'WRX', 'BRZ', 'Exiga', 'Trezia', 'Justy', 'Ascent'],
  Mitsubishi: [
    'Pajero', 'Pajero Sport', 'Outlander', 'L200', 'Lancer', 'ASX', 'Canter', 'Delica', 'RVR', 'Colt',
    'Montero', 'Eclipse Cross', 'Fuso Fighter', 'Triton',
  ],
  Mazda: [
    'CX-5', 'CX-3', 'CX-30', 'CX-8', 'CX-9', 'Demio', 'Axela', 'Atenza', 'BT-50', 'Familia', 'Premacy',
    'MX-5', 'Bongo', 'Verisa', 'Carol', 'Mazda 2', 'Mazda 3', 'Mazda 6',
  ],
  Honda: [
    'CR-V', 'Fit', 'Civic', 'Vezel', 'HR-V', 'Accord', 'Insight', 'Freed', 'Stream', 'Airwave', 'Odyssey',
    'Stepwgn', 'Jazz', 'City', 'Pilot', 'Shuttle', 'N-Box', 'Elysion',
  ],
  Isuzu: ['D-Max', 'MU-X', 'NKR', 'FRR', 'NPR', 'FSR', 'FVR', 'NQR', 'Trooper', 'Bighorn', 'Forward', 'Giga'],
  Suzuki: [
    'Jimny', 'Swift', 'Vitara', 'Grand Vitara', 'Alto', 'Every', 'Wagon R', 'Escudo', 'Baleno', 'Ertiga',
    'Ciaz', 'Celerio', 'S-Presso', 'Carry', 'Ignis',
  ],
  Ford: [
    'Ranger', 'Everest', 'Focus', 'EcoSport', 'Fiesta', 'Kuga', 'Escape', 'Explorer', 'Transit', 'F-150',
    'Mustang', 'Territory', 'Edge', 'Bronco',
  ],
  Volkswagen: [
    'Golf', 'Polo', 'Tiguan', 'Amarok', 'Passat', 'Touareg', 'Jetta', 'Caddy', 'Transporter', 'Crafter',
    'T-Cross', 'Beetle', 'Sharan', 'Up!', 'ID.4',
  ],
  'Mercedes-Benz': [
    'A-Class', 'B-Class', 'C-Class', 'E-Class', 'S-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'G-Class',
    'Sprinter', 'Vito', 'Viano', 'V-Class', 'ML-Class', 'CLA', 'CLS', 'Actros', 'Atego', 'EQC',
  ],
  BMW: [
    '1 Series', '2 Series', '3 Series', '4 Series', '5 Series', '7 Series', 'X1', 'X3', 'X5', 'X6', 'X7',
    'M3', 'M5', 'Z4', 'i3', 'i4', 'iX', 'E30 325i', 'E36 328i', 'E46 330i',
  ],
  Audi: ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'TT', 'RS3', 'RS6', 'e-tron'],
  'Land Rover': [
    'Defender', 'Discovery', 'Discovery Sport', 'Range Rover', 'Range Rover Sport', 'Range Rover Evoque',
    'Range Rover Velar', 'Freelander', 'Series III',
  ],
  Jeep: ['Wrangler', 'Grand Cherokee', 'Cherokee', 'Compass', 'Renegade', 'Gladiator', 'Commander'],
  Hyundai: [
    'Tucson', 'Creta', 'i10', 'i20', 'i30', 'Santa Fe', 'Elantra', 'Accent', 'Kona', 'Venue', 'Palisade',
    'H-1', 'Staria', 'Ioniq 5', 'Atos', 'Sonata',
  ],
  Kia: ['Sportage', 'Sorento', 'Rio', 'Seltos', 'Picanto', 'Cerato', 'Carnival', 'Stonic', 'Soul', 'K2700', 'Pegas', 'EV6', 'Optima'],
  Volvo: ['XC40', 'XC60', 'XC90', 'V40', 'V60', 'V90', 'S60', 'S90', 'FH16', 'FMX'],
  Peugeot: ['108', '208', '308', '2008', '3008', '5008', 'Partner', 'Boxer', 'Expert', '508'],
  Renault: ['Duster', 'Kwid', 'Captur', 'Clio', 'Megane', 'Kangoo', 'Koleos', 'Trafic', 'Sandero', 'Master', 'Triber'],
  Chevrolet: ['Trailblazer', 'Spark', 'Captiva', 'Cruze', 'Aveo', 'Optra', 'Silverado', 'Colorado', 'Traverse', 'Utility', 'Onix'],
  Lexus: ['RX', 'LX', 'NX', 'GX', 'UX', 'IS', 'ES', 'LS', 'LC', 'RC'],
  Porsche: ['Cayenne', 'Macan', '911', 'Panamera', 'Boxster', 'Cayman', 'Taycan'],
  Tesla: ['Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck'],
  BYD: ['Atto 3', 'Dolphin', 'Seal', 'Song Plus', 'Tang', 'Han', 'Yuan Plus', 'Shark'],
  'Great Wall': ['Haval H6', 'Haval Jolion', 'Haval H2', 'Poer', 'Wingle 5', 'Wingle 7', 'Tank 300', 'Ora Good Cat'],
  Chery: ['Tiggo 2', 'Tiggo 4', 'Tiggo 7', 'Tiggo 8', 'Arrizo 5', 'Arrizo 6', 'QQ', 'Omoda 5'],
  Daihatsu: ['Terios', 'Mira', 'Hijet', 'Move', 'Rocky', 'Tanto', 'Gran Max', 'Sirion'],
  Fiat: ['500', 'Panda', 'Punto', 'Tipo', 'Ducato', 'Doblo', 'Fiorino', 'Fullback'],
  Skoda: ['Octavia', 'Fabia', 'Superb', 'Kodiaq', 'Karoq', 'Kamiq', 'Rapid', 'Scala'],
  Mahindra: ['Scorpio', 'Bolero', 'XUV500', 'XUV700', 'Thar', 'Pik Up', 'KUV100'],
  Tata: ['Xenon', 'Prima', 'Ace', 'Nexon', 'Harrier', 'Safari', 'Super Ace'],
  MG: ['ZS', 'HS', 'MG5', 'MG3', 'Marvel R', 'RX8'],
  Opel: ['Astra', 'Corsa', 'Mokka', 'Zafira', 'Vivaro', 'Grandland'],
  Citroen: ['C3', 'C4', 'C5 Aircross', 'Berlingo', 'Jumper', 'Jumpy'],
  Jaguar: ['F-Pace', 'E-Pace', 'XE', 'XF', 'I-Pace', 'F-Type'],
  Scania: ['R450', 'G460', 'P360', 'S500'],
  DAF: ['XF', 'CF', 'LF', 'XG'],
  Hino: ['300 Series', '500 Series', '700 Series', 'Dutro', 'Ranger'],
};

export const MOTO_MAKES: Record<string, string[]> = {
  Yamaha: [
    'XT660Z Ténéré', 'Ténéré 700', 'MT-07', 'MT-09', 'MT-15', 'YZF-R3', 'YZF-R1', 'YZF-R15', 'XTZ125',
    'Crux', 'YBR125', 'FZ150', 'Nmax', 'Aerox', 'WR450F', 'Tricity', 'Bolt',
  ],
  Honda: [
    'CB500X', 'CB500F', 'CRF300L', 'CRF250L', 'CB125F', 'CG125', 'Africa Twin', 'XR150L', 'Rebel 500',
    'CBR500R', 'CBR650R', 'CB650R', 'Ace 125', 'Navi', 'PCX 160', 'Dio', 'Transalp',
  ],
  Suzuki: [
    'V-Strom 650', 'V-Strom 800DE', 'GSX-R750', 'GSX-R600', 'GSX-S750', 'DR200', 'DR650', 'GN125', 'GD110',
    'Address', 'Burgman', 'Hayabusa', 'Gixxer 155',
  ],
  Kawasaki: [
    'Versys 650', 'Versys-X 300', 'Ninja 400', 'Ninja 650', 'Ninja ZX-6R', 'Ninja ZX-10R', 'KLX250',
    'KLX150', 'KLR650', 'Z400', 'Z650', 'Z900', 'W800', 'Vulcan S',
  ],
  BMW: [
    'R 1250 GS', 'R 1300 GS', 'F 850 GS', 'F 900 GS', 'G 310 R', 'G 310 GS', 'S 1000 RR', 'R nineT',
    'F 900 XR', 'C 400 X',
  ],
  KTM: [
    '390 Adventure', '250 Adventure', '890 Adventure', 'Duke 125', 'Duke 200', 'Duke 390', 'Duke 790',
    '690 Enduro', '450 EXC-F', 'RC 390',
  ],
  'Royal Enfield': [
    'Himalayan', 'Himalayan 450', 'Classic 350', 'Meteor 350', 'Hunter 350', 'Bullet 350',
    'Interceptor 650', 'Continental GT 650', 'Scram 411',
  ],
  'Harley-Davidson': [
    'Iron 883', 'Forty-Eight', 'Street 750', 'Fat Bob', 'Fat Boy', 'Street Glide', 'Road King',
    'Sportster S', 'Pan America', 'Nightster',
  ],
  Ducati: [
    'Multistrada V2', 'Multistrada V4', 'Scrambler Icon', 'Monster', 'Panigale V2', 'Panigale V4',
    'Streetfighter V4', 'DesertX', 'Hypermotard',
  ],
  Triumph: [
    'Tiger 900', 'Tiger 660', 'Bonneville T100', 'Bonneville T120', 'Street Twin', 'Speed Twin',
    'Trident 660', 'Scrambler 400X', 'Rocket 3', 'Speed 400',
  ],
  Bajaj: [
    'Boxer 150', 'Boxer BM100', 'Pulsar NS200', 'Pulsar 150', 'Pulsar N250', 'Discover 125', 'Platina 100',
    'Avenger 220', 'Dominar 400', 'CT 100',
  ],
  TVS: [
    'Apache RTR 160', 'Apache RTR 200', 'HLX 150', 'HLX 125', 'Star 125', 'Raider 125', 'Ntorq 125',
    'Jupiter', 'Sport 100', 'Ronin',
  ],
  Haojue: ['TR150', 'DK150', 'UM125', 'HJ125', 'Lindy 125', 'DR160'],
  Boxer: ['BM150', 'BM100', 'BM125'],
  Piaggio: ['Vespa Primavera', 'Vespa Sprint', 'Liberty 150', 'Beverly 300', 'MP3'],
  'Moto Guzzi': ['V7 Stone', 'V85 TT', 'V9 Bobber'],
  Aprilia: ['RS 660', 'Tuono 660', 'SX 125', 'RS 457'],
  Husqvarna: ['Svartpilen 401', 'Vitpilen 401', 'Norden 901', '701 Enduro'],
  CFMoto: ['450MT', '800MT', '300NK', '650NK', '700CL-X'],
  Benelli: ['TRK 502', 'Leoncino 500', '502C', 'TNT 15'],
  Hero: ['Hunk 150', "Splendor+", 'XPulse 200', 'Glamour', 'Passion Pro'],
  Lifan: ['KP150', 'LF150', 'KPT200'],
};

/** Matches the prototype's `YEARS = Array.from({ length: 32 }, (_, i) => String(2026 - i))`. */
export const YEARS: string[] = Array.from({ length: 32 }, (_, i) => String(2026 - i));

/** Picks the right make→model table for a vehicle type, mirroring the prototype's `table` selection. */
export function makeTableFor(vehicleType: 'car' | 'motorcycle'): Record<string, string[]> {
  return vehicleType === 'motorcycle' ? MOTO_MAKES : CAR_MAKES;
}

/** Resolves a make to one this table actually has, falling back to the table's first make (mirrors the prototype). */
export function resolveMake(table: Record<string, string[]>, make: string): string {
  return table[make] ? make : Object.keys(table)[0];
}

/** Resolves a model to one the make actually has, falling back to the make's first model (mirrors the prototype). */
export function resolveModel(models: string[], model: string): string {
  return models.includes(model) ? model : models[0];
}
