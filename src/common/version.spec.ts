import { APP_VERSION } from './version';

describe('APP_VERSION', () => {
  it('is a non-empty semver string read from package.json', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
