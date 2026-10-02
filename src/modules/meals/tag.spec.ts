import { normalizeTag, normalizeTags } from './tag';

describe('normalizeTag', () => {
  it('met en minuscules et retire les espaces de bord', () => {
    expect(normalizeTag('  Hiver ')).toBe('hiver');
  });

  it('réduit les espaces internes à un seul', () => {
    expect(normalizeTag('plat   du\tjour')).toBe('plat du jour');
  });

  it('compose les accents (NFC) : deux saisies du même mot donnent le même tag', () => {
    const decomposed = 'e\u0301te\u0301';
    const composed = '\u00e9t\u00e9';
    expect(decomposed).not.toBe(composed);
    expect(normalizeTag(decomposed)).toBe(composed);
  });

  it('retire les espaces insécables comme les autres', () => {
    expect(normalizeTag('\u00a0plat\u202fdu jour\u00a0')).toBe('plat du jour');
  });
});

describe('normalizeTags', () => {
  it('dédoublonne après normalisation et retire les vides', () => {
    expect(normalizeTags([' Hiver ', 'hiver', '', '  ', 'Rapide'])).toEqual([
      'hiver',
      'rapide',
    ]);
  });
});
