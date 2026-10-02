import type { Request, Response } from 'express';
import { requestId } from './request-id.middleware';

function run(header?: string) {
  const req = { headers: header ? { 'x-request-id': header } : {} } as Request;
  const res = { setHeader: jest.fn() } as unknown as Response;
  requestId(req, res, jest.fn());
  return (req as Request & { id: string }).id;
}

describe('requestId', () => {
  it('reprend un UUID entrant', () => {
    const id = '0b3f4c1e-2a6d-4e8f-9b1c-5d7e9f0a1b2c';
    expect(run(id)).toBe(id);
  });

  it.each(['foo\nbar', 'abc', ''])('remplace %j par un UUID', (header) => {
    expect(run(header)).toMatch(/^[0-9a-f-]{36}$/);
    expect(run(header)).not.toBe(header);
  });
});
