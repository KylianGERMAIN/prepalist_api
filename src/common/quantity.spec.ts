import { roundQuantity } from './quantity';

describe('roundQuantity', () => {
  it('absorbs float accumulation noise', () => {
    expect(roundQuantity(0.1 + 0.2)).toBe(0.3);
  });

  it('keeps the decimals a purchase unit needs', () => {
    expect(roundQuantity(0.25)).toBe(0.25);
  });

  it('rounds a half cent up', () => {
    expect(roundQuantity(0.615)).toBe(0.62);
  });
});
