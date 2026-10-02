import { Aisle, aisleRank } from './aisle';

describe('aisleRank', () => {
  it('suit l’ordre de déclaration du parcours', () => {
    expect(aisleRank(Aisle.PRODUCE)).toBeLessThan(aisleRank(Aisle.DAIRY));
    expect(aisleRank(Aisle.DAIRY)).toBeLessThan(aisleRank(Aisle.FROZEN));
  });

  it('range un rayon non renseigné avec « Autre », en dernier', () => {
    expect(aisleRank(null)).toBe(aisleRank(Aisle.OTHER));
    expect(aisleRank(Aisle.HOUSEHOLD)).toBeLessThan(aisleRank(null));
  });
});
