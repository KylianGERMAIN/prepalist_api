import { addDays, lastWeekdayOnOrBefore, today } from './plan-dates';

describe('plan-dates', () => {
  describe('today', () => {
    it('renvoie une date calendaire au format YYYY-MM-DD', () => {
      expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('addDays', () => {
    it('passe la fin de mois et la fin d’année', () => {
      expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
      expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
      expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    });

    it('gère une année bissextile', () => {
      expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    });
  });

  describe('lastWeekdayOnOrBefore', () => {
    // 2026-06-30 est un mardi (weekday = 2).
    it('renvoie la date elle-même quand elle tombe déjà sur le bon jour', () => {
      expect(lastWeekdayOnOrBefore('2026-06-30', 2)).toBe('2026-06-30');
    });

    it('recule jusqu’au dernier jour demandé', () => {
      // Mercredi 1er juillet, jour de courses mardi -> la veille.
      expect(lastWeekdayOnOrBefore('2026-07-01', 2)).toBe('2026-06-30');
      // Lundi 6 juillet, jour de courses mardi -> le mardi précédent, 6 jours avant.
      expect(lastWeekdayOnOrBefore('2026-07-06', 2)).toBe('2026-06-30');
    });

    it('gère dimanche (0) sans repasser une semaine en arrière', () => {
      // 2026-07-05 est un dimanche.
      expect(lastWeekdayOnOrBefore('2026-07-05', 0)).toBe('2026-07-05');
      expect(lastWeekdayOnOrBefore('2026-07-04', 0)).toBe('2026-06-28');
    });
  });
});
