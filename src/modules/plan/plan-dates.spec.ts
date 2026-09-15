import { lastWeekdayOnOrBefore, today } from './plan-dates';

describe('plan-dates', () => {
  describe('today', () => {
    it('renvoie une date calendaire au format YYYY-MM-DD', () => {
      expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    // Un serveur UTC renverrait la veille pour qui a déjà passé minuit à Paris.
    it('ancre sur Europe/Paris et non sur UTC (heure d’été, UTC+2)', () => {
      expect(today(new Date('2026-07-29T22:30:00Z'))).toBe('2026-07-30');
      expect(today(new Date('2026-07-29T21:30:00Z'))).toBe('2026-07-29');
    });

    it('ancre sur Europe/Paris et non sur UTC (heure d’hiver, UTC+1)', () => {
      expect(today(new Date('2026-01-14T23:30:00Z'))).toBe('2026-01-15');
      expect(today(new Date('2026-01-14T22:30:00Z'))).toBe('2026-01-14');
    });

    it('reste en UTC si on le lui demande explicitement', () => {
      expect(today(new Date('2026-07-29T22:30:00Z'), 'UTC')).toBe('2026-07-29');
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
