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
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateShoppingListItemDto } from './dto/create-shopping-list-item.dto';
import { ShoppingListDto, ShoppingListItemDto } from './dto/shopping-list.dto';
import { UpdateShoppingListItemDto } from './dto/update-shopping-list-item.dto';
import { ShoppingListService } from './shopping-list.service';

@ApiTags('shopping-list')
@ApiBearerAuth()
@Controller('weeks')
export class ShoppingListController {
  constructor(private readonly shoppingList: ShoppingListService) {}

  @Get(':id/shopping-list')
  @ApiOperation({
    summary: 'Liste de courses matérialisée d’une semaine (init paresseuse)',
  })
  @ApiOkResponse({ type: ShoppingListDto })
  forWeek(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shoppingList.forWeek(userId, id);
  }

  @Post(':id/shopping-list/sync')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resynchronise les items dérivés depuis les plats' })
  @ApiOkResponse({ type: ShoppingListDto })
  sync(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shoppingList.sync(userId, id);
  }

  @Post(':id/shopping-list/items')
  @ApiOperation({ summary: 'Ajoute un item manuel à la liste' })
  @ApiCreatedResponse({ type: ShoppingListItemDto })
  addItem(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateShoppingListItemDto,
  ) {
    return this.shoppingList.addItem(userId, id, dto);
  }

  @Patch(':id/shopping-list/items/:itemId')
  @ApiOperation({
    summary: 'Met à jour un item (checked, nom, quantité, unité)',
  })
  @ApiOkResponse({ type: ShoppingListItemDto })
  updateItem(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateShoppingListItemDto,
  ) {
    return this.shoppingList.updateItem(userId, id, itemId, dto);
  }

  @Delete(':id/shopping-list/items/:itemId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Supprime un item de la liste' })
  @ApiNoContentResponse()
  removeItem(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.shoppingList.removeItem(userId, id, itemId);
  }
}
