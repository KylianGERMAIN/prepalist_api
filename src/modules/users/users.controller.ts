import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MeDto } from './dto/me.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Profil de l’utilisateur courant' })
  @ApiOkResponse({ type: MeDto })
  async me(@CurrentUser('id') userId: string): Promise<MeDto> {
    return new MeDto(await this.users.findById(userId));
  }

  @Patch('me')
  @ApiOperation({ summary: 'Met à jour les préférences (jour de courses)' })
  @ApiOkResponse({ type: MeDto })
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateMeDto,
  ): Promise<MeDto> {
    return new MeDto(
      await this.users.updateShoppingDay(userId, dto.shoppingDay),
    );
  }
}
