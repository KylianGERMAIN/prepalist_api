const APP_TIME_ZONE = 'Europe/Paris';

/** Date du jour en `YYYY-MM-DD`, pas en UTC : à Paris, jeudi 00h30 est encore mercredi en UTC. */
export function today(now = new Date(), timeZone = APP_TIME_ZONE): string {
  // en-CA formate en YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** `weekday` : 0 = dimanche … 6 = samedi. */
export function lastWeekdayOnOrBefore(
  isoDate: string,
  weekday: number,
): string {
  // Arithmétique en UTC pur, donc insensible à l'heure d'été.
  const d = new Date(`${isoDate}T00:00:00Z`);
  const diff = (d.getUTCDay() - weekday + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}
