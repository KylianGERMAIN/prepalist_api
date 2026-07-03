import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';
import { APP_VERSION } from '../../common/version';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Readiness check (API + base de données)' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        database: 'up',
        timestamp: '2026-07-03T06:38:37.524Z',
        version: '0.2.1',
      },
    },
  })
  async check() {
    // Readiness, pas juste liveness : un orchestrateur doit savoir si la DB répond.
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
      });
    }
    return {
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
    };
  }
}
