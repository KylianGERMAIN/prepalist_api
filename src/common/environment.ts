/** Tolérante à la casse : `NODE_ENV` est saisi à la main dans le dashboard Render. */
export function isProduction(nodeEnv?: string): boolean {
  return nodeEnv?.trim().toLowerCase() === 'production';
}
