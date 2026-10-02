import type { Params } from 'nestjs-pino';
import type { AuthUser } from './decorators/current-user.decorator';
import { isProduction } from './environment';

type LoggedRequest = { user?: AuthUser; route?: { path?: string } };

export function loggerParams(nodeEnv: string | undefined): Params {
  return {
    pinoHttp: {
      level:
        nodeEnv === 'test'
          ? 'silent'
          : isProduction(nodeEnv)
            ? 'info'
            : 'debug',
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
      ],
      customAttributeKeys: { reqId: 'requestId', responseTime: 'durationMs' },
      // Lu en fin de requête : `user` (garde JWT) et `route` (gabarit Express) y sont posés.
      customProps: (req) => {
        const { user, route } = req as LoggedRequest;
        return { userId: user?.id, route: route?.path };
      },
    },
  };
}
