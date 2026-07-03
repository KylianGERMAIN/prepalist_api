import { ServiceUnavailableException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { APP_VERSION } from '../../common/version';
import { HealthController } from './health.controller';

function controllerWith(query: () => Promise<unknown>) {
  return new HealthController({ query } as unknown as DataSource);
}

describe('HealthController', () => {
  it('returns ok with the app version when the database responds', async () => {
    const result = await controllerWith(() =>
      Promise.resolve([{ '1': 1 }]),
    ).check();
    expect(result).toEqual({
      status: 'ok',
      database: 'up',
      timestamp: expect.any(String),
      version: APP_VERSION,
    });
  });

  it('throws 503 when the database is down', async () => {
    await expect(
      controllerWith(() => Promise.reject(new Error('down'))).check(),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
