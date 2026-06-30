import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ShoppingListService } from './shopping-list.service';

@ApiTags('shopping-list')
@ApiBearerAuth()
@Controller('weeks')
export class ShoppingListController {
  constructor(private readonly shoppingList: ShoppingListService) {}

  @Get(':id/shopping-list')
  @ApiOperation({ summary: 'Liste de courses agrégée d’une semaine' })
  forWeek(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shoppingList.forWeek(userId, id);
  }
}
