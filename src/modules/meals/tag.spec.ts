import { normalizeTag, normalizeTags } from './tag';

describe('normalizeTag', () => {
  it('met en minuscules et retire les espaces de bord', () => {
    expect(normalizeTag('  Hiver ')).toBe('hiver');
  });

  it('réduit les espaces internes à un seul', () => {
    expect(normalizeTag('plat   du\tjour')).toBe('plat du jour');
  });

  it('compose les accents (NFC) : deux saisies du même mot donnent le même tag', () => {
    expect(normalizeTag('été')).toBe(normalizeTag('été'));
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
