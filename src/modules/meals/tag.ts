/** Forme canonique d'un tag : « Hiver », « hiver » et « hiver  » sont un seul tag. */
export function normalizeTag(tag: string): string {
  return tag.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))];
}
