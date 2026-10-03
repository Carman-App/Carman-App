/**
 * Make/model/year reference catalogue — extracted verbatim from the Carma
 * clickable prototype (`CAR_MAKES`, `MOTO_MAKES`, `YEARS` in the prototype's
 * source). This is genuine reference data (not user data), so a curated
 * static list is the correct real implementation, not a placeholder — the
 * prototype's own onboarding MAKE/MODEL screen uses exactly this table to
 * drive its make/model/year pickers.
 *
 * Extended beyond the prototype with more makes and models. Anything not
 * listed can still be typed in the picker ("Use …").
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
  // More makes: Japanese, Korean and Chinese imports common in East Africa, then the rest of the world.
  Infiniti: ['Q50', 'Q60', 'QX50', 'QX55', 'QX60', 'QX80', 'FX35', 'G37'],
  Acura: ['MDX', 'RDX', 'TLX', 'Integra', 'ILX', 'NSX'],
  Genesis: ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80'],
  SsangYong: ['Rexton', 'Korando', 'Tivoli', 'Musso', 'Actyon', 'Kyron', 'Torres'],
  Proton: ['Saga', 'Persona', 'Iriz', 'X50', 'X70', 'Exora'],
  Perodua: ['Myvi', 'Axia', 'Bezza', 'Alza', 'Aruz', 'Ativa'],
  Geely: ['Coolray', 'Emgrand', 'Okavango', 'Azkarra', 'Tugella', 'Monjaro', 'Geometry C'],
  Changan: ['CS35 Plus', 'CS55 Plus', 'CS75 Plus', 'CS85', 'CS95', 'Alsvin', 'Uni-K', 'Uni-T', 'Hunter'],
  JAC: ['S2', 'S3', 'S4', 'J7', 'T6', 'T8', 'N-Series', 'Sunray'],
  Foton: ['Tunland', 'View', 'Aumark', 'Auman', 'Gratour', 'Toano'],
  Dongfeng: ['Rich', 'Glory 580', 'Aeolus', 'Captain', 'KR', 'KX'],
  GAC: ['GS3', 'GS4', 'GS8', 'GN6', 'GA4', 'Emkoo'],
  Haval: ['H6', 'Jolion', 'H2', 'H9', 'Dargo', 'M6'],
  BAIC: ['X25', 'X35', 'X55', 'BJ40', 'BJ60', 'D20'],
  Jetour: ['X70', 'X90', 'Dashing', 'T2'],
  Omoda: ['C5', 'C9', 'E5'],
  Jaecoo: ['J7', 'J8'],
  Zotye: ['T600', 'Z100', 'Z300'],
  Leapmotor: ['C10', 'T03', 'C11'],
  NIO: ['ES6', 'ES8', 'ET5', 'ET7', 'EC6'],
  XPeng: ['G6', 'G9', 'P7', 'X9'],
  'Li Auto': ['L6', 'L7', 'L8', 'L9', 'Mega'],
  Zeekr: ['001', '007', 'X', '009'],
  Polestar: ['Polestar 2', 'Polestar 3', 'Polestar 4'],
  'Alfa Romeo': ['Giulia', 'Stelvio', 'Tonale', 'Giulietta', 'MiTo'],
  Seat: ['Ibiza', 'Leon', 'Arona', 'Ateca', 'Tarraco'],
  Cupra: ['Formentor', 'Born', 'Leon', 'Ateca'],
  Dacia: ['Duster', 'Sandero', 'Logan', 'Jogger', 'Spring'],
  Lada: ['Niva', 'Vesta', 'Granta', 'Largus'],
  Mini: ['Cooper', 'Countryman', 'Clubman', 'Paceman', 'Cooper SE'],
  'Rolls-Royce': ['Ghost', 'Phantom', 'Cullinan', 'Wraith', 'Dawn', 'Spectre'],
  Bentley: ['Bentayga', 'Continental GT', 'Flying Spur', 'Mulsanne'],
  Maserati: ['Ghibli', 'Levante', 'Quattroporte', 'Grecale', 'MC20'],
  Ferrari: ['Roma', 'Portofino', '296 GTB', 'SF90', 'F8 Tributo', 'Purosangue'],
  Lamborghini: ['Urus', 'Huracan', 'Aventador', 'Revuelto'],
  'Aston Martin': ['DB11', 'DB12', 'Vantage', 'DBX', 'DBS'],
  McLaren: ['720S', 'Artura', 'GT', '750S'],
  Cadillac: ['Escalade', 'XT4', 'XT5', 'XT6', 'CT4', 'CT5', 'Lyriq'],
  GMC: ['Sierra', 'Yukon', 'Acadia', 'Terrain', 'Canyon', 'Savana'],
  Dodge: ['Durango', 'Charger', 'Challenger', 'Journey', 'Caliber'],
  Ram: ['1500', '2500', '3500', 'ProMaster'],
  Chrysler: ['300', 'Pacifica', 'Voyager', 'Town & Country'],
  Lincoln: ['Navigator', 'Aviator', 'Nautilus', 'Corsair'],
  Buick: ['Enclave', 'Encore', 'Envision', 'LaCrosse'],
  Hummer: ['H2', 'H3', 'EV'],
  Smart: ['ForTwo', 'ForFour', '#1', '#3'],
  Rivian: ['R1T', 'R1S', 'R2'],
  Lucid: ['Air', 'Gravity'],
  Iveco: ['Daily', 'Eurocargo', 'Stralis', 'S-Way', 'Trakker'],
  MAN: ['TGS', 'TGX', 'TGM', 'TGL', 'TGE'],
  'UD Trucks': ['Quester', 'Croner', 'Quon', 'Condor'],
  'FAW': ['J6', 'J7', 'Tiger V', 'Bestune T77'],
  Sinotruk: ['HOWO', 'Sitrak', 'Hohan'],
  Shacman: ['X3000', 'F3000', 'H3000', 'L3000'],
  'Ashok Leyland': ['Dost', 'Boss', 'Ecomet', 'Falcon'],
  'Eicher': ['Pro 2049', 'Pro 3015', 'Skyline'],
  Yutong: ['ZK6122', 'ZK6938', 'E12'],
  'King Long': ['XMQ6127', 'XMQ6900', 'Kingo'],
  Higer: ['KLQ6125', 'KLQ6928', 'Azure'],
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
  // More makes: commuter and boda boda brands common in East Africa, then the rest of the world.
  Indian: ['Scout', 'Chief', 'Chieftain', 'Challenger', 'FTR', 'Springfield'],
  'MV Agusta': ['Brutale', 'Dragster', 'F3', 'Turismo Veloce', 'Superveloce'],
  Zontes: ['ZT310-X', 'ZT350-T', 'ZT125-U', 'ZT703F'],
  Voge: ['300Rally', '525DSX', '650DS', '300AC'],
  Kymco: ['Like 150', 'Agility 125', 'AK 550', 'Xciting 400', 'People S'],
  SYM: ['Jet 14', 'Symphony', 'Cruisym', 'Maxsym', 'NH T 200'],
  Keeway: ['RKF 125', 'Superlight 200', 'K-Light 202', 'Vieste 300'],
  Senke: ['SK150', 'SK125', 'SK200'],
  Dayun: ['DY150', 'DY125', 'DY200'],
  Skygo: ['SG150', 'SG125', 'Wolf 150'],
  Captain: ['TVS Star HLX', '150', '125'],
  Mahindra: ['Mojo', 'Centuro', 'Pantero'],
  Jawa: ['Jawa 42', 'Perak', 'Yezdi Roadster', 'Yezdi Adventure'],
  Zongshen: ['ZS150', 'RX3', 'ZS200GY', 'Cyclone RX3S'],
  Loncin: ['LX150', 'LX200GY', 'Voge 300R'],
  Sanya: ['SY150', 'SY125'],
  'Ather': ['450X', '450S', 'Rizta'],
  'Ola Electric': ['S1 Pro', 'S1 Air', 'S1 X'],
  Roam: ['Roam Air', 'Roam Move'],
  Spiro: ['Ekon 450', 'Ekon 900', 'Veloce'],
  Ampersand: ['Ampersand 1'],
  'Zero Motorcycles': ['SR/F', 'SR/S', 'FX', 'DSR/X'],
  'Super Soco': ['TC Max', 'CPx', 'TS Street Hunter'],
  Niu: ['NQi', 'MQi', 'UQi', 'RQi'],
  Gilera: ['Runner', 'Nexus', 'SMT 125'],
  Beta: ['RR 300', 'Alp 4.0', 'Xtrainer 300'],
  GasGas: ['EC 300', 'MC 250F', 'ES 700'],
  Sherco: ['SE 300', 'SEF 450'],
  Norton: ['Commando 961', 'V4SV', 'Atlas'],
  'BSA': ['Gold Star', 'Scrambler 650'],
  Buell: ['Hammerhead 1190', 'Super Cruiser'],
};

/** Model years from next year (new models go on sale early) back to 1950, for classics. */
const NEXT_YEAR = new Date().getFullYear() + 1;
export const YEARS: string[] = Array.from({ length: NEXT_YEAR - 1950 + 1 }, (_, i) => String(NEXT_YEAR - i));

/** Picks the right make→model table for a vehicle type, mirroring the prototype's `table` selection. */
export function makeTableFor(vehicleType: 'car' | 'motorcycle'): Record<string, string[]> {
  return vehicleType === 'motorcycle' ? MOTO_MAKES : CAR_MAKES;
}
