import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { Writable } from 'node:stream';
import pinoHttp, { type Options } from 'pino-http';
import { loggerParams } from './logger';

function logRequest(url: string, setup: (req: IncomingMessage) => void) {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, done) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      done();
    },
  });
  const params = loggerParams('production').pinoHttp as Options;
  const middleware = pinoHttp(params, stream);
  const req = new IncomingMessage(new Socket());
  req.method = 'GET';
  req.url = url;
  setup(req);
  const res = new ServerResponse(req);
  middleware(req, res);
  res.statusCode = 200;
  res.emit('finish');
  return lines;
}

describe('loggerParams', () => {
  it('écrit une ligne JSON par requête, sans secret', () => {
    const [line] = logRequest('/meals/42', (req) => {
      req.headers.authorization = 'Bearer secret';
      req.headers.cookie = 'refresh=secret';
      Object.assign(req, {
        id: 'b6a1c1f0-0000-4000-8000-000000000000',
        user: { id: 'u1' },
        route: { path: '/meals/:id' },
      });
    });

    expect(line).toMatchObject({
      level: 30,
      requestId: 'b6a1c1f0-0000-4000-8000-000000000000',
      userId: 'u1',
      route: '/meals/:id',
      durationMs: expect.any(Number) as number,
    });
    const headers = (line.req as { headers: Record<string, string> }).headers;
    expect(headers.authorization).toBe('[Redacted]');
    expect(headers.cookie).toBe('[Redacted]');
  });

  it('ignore le ping de santé', () => {
    expect(logRequest('/health', () => {})).toHaveLength(0);
  });
});
