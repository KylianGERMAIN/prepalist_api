import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { APP_VERSION } from '../../common/version';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness check (process uniquement)' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        uptime: 1234.56,
        timestamp: '2026-07-03T06:38:37.524Z',
        version: '0.2.1',
      },
    },
  })
  check() {
    // ponytail: liveness seule — toute requête DB ici réveille Neon à chaque
    // ping du keep-alive et brûle le quota compute. Readiness à rajouter sur
    // une route distincte le jour où un orchestrateur en a réellement besoin.
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
    };
  }
}
