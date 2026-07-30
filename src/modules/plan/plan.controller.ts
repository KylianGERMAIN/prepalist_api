import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { Plan } from './entities/plan.entity';
import { PlanService } from './plan.service';

@ApiTags('plan')
@ApiBearerAuth()
@Controller('plan')
export class PlanController {
  constructor(private readonly plan: PlanService) {}

  @Get()
  @ApiOperation({
    summary: 'Plan courant de l’utilisateur, créé vide au premier accès',
  })
  @ApiOkResponse({ type: Plan })
  find(@CurrentUser('id') userId: string) {
    return this.plan.ensureForUser(userId);
  }

  @Post('generate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remplit les créneaux vides par tirage pondéré' })
  @ApiOkResponse({ type: Plan })
  generate(@CurrentUser('id') userId: string) {
    return this.plan.generate(userId);
  }

  @Patch('slots/:slotId')
  @ApiOperation({ summary: 'Met à jour un créneau (repas / portions)' })
  @ApiOkResponse({ type: Plan })
  updateSlot(
    @CurrentUser('id') userId: string,
    @Param('slotId', ParseUUIDPipe) slotId: string,
    @Body() dto: UpdateSlotDto,
  ) {
    return this.plan.updateSlot(userId, slotId, dto);
  }

  @Delete('slots')
  @ApiOperation({
    summary: 'Vide les créneaux du plan et purge la liste de courses',
  })
  @ApiOkResponse({ type: Plan })
  clear(@CurrentUser('id') userId: string) {
    return this.plan.clearSlots(userId);
  }
}
