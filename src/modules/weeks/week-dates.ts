const APP_TIME_ZONE = 'Europe/Paris';

/**
 * Lundi de la semaine contenant l'instant `d`, au format `YYYY-MM-DD`,
 * ancré sur le fuseau de l'app (Europe/Paris) et non sur UTC : un dimanche
 * soir en heure locale reste dans la bonne semaine. On ne manipule que la
 * date calendaire (insensible à l'heure d'été).
 */
export function startOfWeek(d: Date, timeZone = APP_TIME_ZONE): string {
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

  // Calcul du lundi en arithmétique calendaire pure (UTC = pas de DST en jeu).
  const cal = new Date(Date.UTC(year, month - 1, day));
  const weekday = cal.getUTCDay(); // 0 = dimanche … 6 = samedi
  const diff = weekday === 0 ? -6 : 1 - weekday;
  cal.setUTCDate(cal.getUTCDate() + diff);
  return cal.toISOString().slice(0, 10);
}

/** Ajoute `n` jours à une date `YYYY-MM-DD` et renvoie `YYYY-MM-DD`. */
export function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
