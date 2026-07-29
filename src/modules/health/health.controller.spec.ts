import { APP_VERSION } from '../../common/version';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok with the app version', () => {
    expect(new HealthController().check()).toEqual({
      status: 'ok',
      uptime: expect.any(Number),
      timestamp: expect.any(String),
      version: APP_VERSION,
    });
  });
});
