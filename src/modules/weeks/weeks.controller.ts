import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateWeekDto } from './dto/create-week.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { Week } from './entities/week.entity';
import { WeeksService } from './weeks.service';

@ApiTags('weeks')
@ApiBearerAuth()
@Controller('weeks')
export class WeeksController {
  constructor(private readonly weeks: WeeksService) {}

  @Get('current')
  @ApiOperation({ summary: 'Semaine courante de l’utilisateur' })
  @ApiOkResponse({ type: Week })
  findCurrent(@CurrentUser('id') userId: string) {
    return this.weeks.findCurrent(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Crée une semaine (14 créneaux vides)' })
  @ApiCreatedResponse({ type: Week })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateWeekDto) {
    return this.weeks.create(userId, dto);
  }

  @Post(':id/generate')
  @ApiOperation({ summary: 'Génère la semaine par tirage pondéré' })
  @ApiCreatedResponse({ type: Week })
  generate(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.weeks.generate(userId, id);
  }

  @Patch(':id/slots/:slotId')
  @ApiOperation({ summary: 'Met à jour un créneau (repas / portions)' })
  @ApiOkResponse({ type: Week })
  updateSlot(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('slotId', ParseUUIDPipe) slotId: string,
    @Body() dto: UpdateSlotDto,
  ) {
    return this.weeks.updateSlot(userId, id, slotId, dto);
  }
}
