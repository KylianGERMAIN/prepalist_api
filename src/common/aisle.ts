/** Rayons du magasin, dans l'ordre de parcours par défaut : le rang de déclaration trie la liste. */
export enum Aisle {
  PRODUCE = 'PRODUCE',
  BAKERY = 'BAKERY',
  MEAT_FISH = 'MEAT_FISH',
  DAIRY = 'DAIRY',
  CHEESE_DELI = 'CHEESE_DELI',
  PANTRY_SAVORY = 'PANTRY_SAVORY',
  PANTRY_SWEET = 'PANTRY_SWEET',
  FROZEN = 'FROZEN',
  DRINKS = 'DRINKS',
  HOUSEHOLD = 'HOUSEHOLD',
  OTHER = 'OTHER',
}

export const AISLE_ORDER = Object.values(Aisle);

/** `null` (rayon non renseigné) se range avec « Autre ». */
export function aisleRank(aisle: Aisle | null): number {
  return AISLE_ORDER.indexOf(aisle ?? Aisle.OTHER);
}
