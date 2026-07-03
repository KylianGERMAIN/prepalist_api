const APP_TIME_ZONE = 'Europe/Paris';

/**
 * Début de la semaine de planning contenant l'instant `d`, au format
 * `YYYY-MM-DD` : dernier `shoppingDay` (0 = dimanche … 6 = samedi) à cette date
 * ou avant. Ancré sur le fuseau de l'app (Europe/Paris) et non sur UTC : un
 * dimanche soir en heure locale reste dans la bonne semaine. On ne manipule
 * que la date calendaire (insensible à l'heure d'été).
 *
 * `shoppingDay = 1` (lundi, défaut) reproduit exactement l'ancien comportement.
 */
export function startOfWeek(
  d: Date,
  shoppingDay = 1,
  timeZone = APP_TIME_ZONE,
): string {
  // Date calendaire (Y-M-D) telle que vue dans le fuseau cible.
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(d)
    .split('-')
    .map(Number);

  // Recul jusqu'au dernier shoppingDay, en arithmétique calendaire pure (UTC = pas de DST).
  const cal = new Date(Date.UTC(year, month - 1, day));
  const weekday = cal.getUTCDay(); // 0 = dimanche … 6 = samedi
  const diff = (weekday - shoppingDay + 7) % 7;
  cal.setUTCDate(cal.getUTCDate() - diff);
  return cal.toISOString().slice(0, 10);
}

/** Ajoute `n` jours à une date `YYYY-MM-DD` et renvoie `YYYY-MM-DD`. */
export function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
