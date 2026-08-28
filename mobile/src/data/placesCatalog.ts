/**
 * Nearby-places reference data — extracted verbatim from the Carma clickable
 * prototype's `PLACES` table (its PICK A PLACE screen). There's no live
 * geolocation/maps backend behind this app, so a curated static list is the
 * correct real implementation for "nearby places" (same reasoning as the
 * vehicle make/model catalogue) — genuine reference data, not user data.
 *
 * Each entry's `categories` lists the `/record/add` category labels
 * (see `src/features/record/categories.ts`) it's relevant to, so the picker
 * can actually filter by the category the user is logging a record for
 * instead of always showing every place regardless of what was asked for.
 */

export type Place = {
  name: string;
  tag: string;
  road: string;
  km: number;
  categories: string[];
};

export const PLACES: Place[] = [
  { name: 'Two Rivers Mall Car Park', tag: 'PARKING', road: 'LIMURU RD', km: 1.2, categories: ['Parking & tolls'] },
  { name: 'Nairobi Expressway · Westlands Toll', tag: 'TOLL PLAZA', road: 'WAIYAKI WAY', km: 3.4, categories: ['Parking & tolls'] },
  { name: 'JKIA Long Stay Car Park', tag: 'AIRPORT PARKING', road: 'EMBAKASI', km: 16.8, categories: ['Parking & tolls'] },
  { name: 'Karen Hub Car Wash', tag: 'CAR WASH', road: 'KAREN RD', km: 0.8, categories: ['Car wash & cleaning'] },
  { name: 'Spotless Auto Spa', tag: 'DETAILING', road: 'KILIMANI', km: 5.1, categories: ['Car wash & cleaning'] },
  { name: 'TotalEnergies Lavington', tag: 'FUEL', road: 'JAMES GICHURU RD', km: 4.2, categories: ['Fuel', 'Car wash & cleaning', 'Parts'] },
  { name: 'Shell Karen', tag: 'FUEL', road: 'KAREN RD', km: 1.1, categories: ['Fuel'] },
  { name: 'Rubis Ngong Road', tag: 'FUEL', road: 'NGONG RD', km: 3.3, categories: ['Fuel'] },
  { name: 'Two Rivers Hub', tag: 'CHARGING', road: 'LIMURU RD', km: 1.2, categories: ['Fuel'] },
  { name: "Joe's Auto", tag: 'GARAGE', road: 'NGONG RD', km: 2.6, categories: ['Parts', 'Modifications', 'Roadside & recovery'] },
  { name: 'Kirinyaga Motors', tag: 'SPARES', road: 'KIRINYAGA RD', km: 7.9, categories: ['Parts', 'Accessories', 'Modifications'] },
  { name: 'AA Kenya', tag: 'ROADSIDE', road: 'WESTLANDS', km: 4.8, categories: ['Roadside & recovery', 'Security'] },
  { name: 'NTSA Huduma Centre', tag: 'GOVERNMENT', road: 'GPO', km: 6.3, categories: ['Licence & fees', 'Fines & penalties'] },
  { name: 'Jubilee Insurance', tag: 'INSURER', road: 'KAUNDA ST', km: 6.1, categories: ['Insurance', 'Subscriptions'] },
  { name: 'Sarit Centre Parking', tag: 'PARKING', road: 'WESTLANDS', km: 4.0, categories: ['Parking & tolls'] },
];
