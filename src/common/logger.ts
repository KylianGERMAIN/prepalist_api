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
        'req.headers["x-forwarded-for"]',
        'res.headers["set-cookie"]',
      ],
      // Sans lui, `customAttributeKeys.reqId` est ignoré : l'id reste imbriqué dans `req`.
      quietReqLogger: true,
      // Ping Render : une ligne toutes les quelques secondes, sans valeur.
      autoLogging: { ignore: (req) => req.url === '/health' },
      customAttributeKeys: { reqId: 'requestId', responseTime: 'durationMs' },
      // Lu en fin de requête : `user` (garde JWT) et `route` (gabarit Express) y sont posés.
      customProps: (req) => {
        const { user, route } = req as LoggedRequest;
        return { userId: user?.id, route: route?.path };
      },
    },
  };
}
