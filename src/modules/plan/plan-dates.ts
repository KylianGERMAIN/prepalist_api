const APP_TIME_ZONE = 'Europe/Paris';

/**
 * Date calendaire du jour (`YYYY-MM-DD`) dans le fuseau de l'app et non en UTC :
 * sur un serveur UTC, un jeudi 00h30 à Paris est encore mercredi en UTC.
 */
export function today(now = new Date(), timeZone = APP_TIME_ZONE): string {
  // en-CA formate en YYYY-MM-DD, ce qui évite de recomposer la chaîne à la main.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Dernier `weekday` (0 = dimanche … 6 = samedi) à `isoDate` ou avant.
 * Arithmétique en UTC pur : on ne manipule que la date calendaire, donc insensible
 * à l'heure d'été.
 */
export function lastWeekdayOnOrBefore(
  isoDate: string,
  weekday: number,
): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const diff = (d.getUTCDay() - weekday + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}
