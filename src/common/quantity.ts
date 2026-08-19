// Les colonnes `numeric` sont lues en float64 : toute somme de quantités dérive.
export function roundQuantity(value: number): number {
  return Math.round(value * 100) / 100;
}
