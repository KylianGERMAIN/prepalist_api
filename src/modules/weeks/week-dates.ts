/**
 * Lundi (UTC) de la semaine contenant `d`, au format `YYYY-MM-DD`.
 * On travaille en UTC pour rester cohérent avec les colonnes `date` Postgres
 * (pas de décalage de fuseau).
 */
export function startOfWeek(d: Date): string {
  const day = d.getUTCDay(); // 0 = dimanche … 6 = samedi
  const diff = day === 0 ? -6 : 1 - day; // ramène au lundi
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff),
  );
  return monday.toISOString().slice(0, 10);
}

/** Ajoute `n` jours à une date `YYYY-MM-DD` et renvoie `YYYY-MM-DD`. */
export function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
