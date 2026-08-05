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
@Controller('plan/shopping-list')
export class ShoppingListController {
  constructor(private readonly shoppingList: ShoppingListService) {}

  @Get()
  @ApiOperation({
    summary: 'Liste de courses matérialisée du plan (init paresseuse)',
  })
  @ApiOkResponse({ type: ShoppingListDto })
  forPlan(@CurrentUser('id') userId: string) {
    return this.shoppingList.forPlan(userId);
  }

  @Post('sync')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resynchronise les items dérivés depuis les plats' })
  @ApiOkResponse({ type: ShoppingListDto })
  sync(@CurrentUser('id') userId: string) {
    return this.shoppingList.sync(userId);
  }

  @Post('items')
  @ApiOperation({ summary: 'Ajoute un item manuel à la liste' })
  @ApiCreatedResponse({ type: ShoppingListItemDto })
  addItem(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateShoppingListItemDto,
  ) {
    return this.shoppingList.addItem(userId, dto);
  }

  @Patch('items/:itemId')
  @ApiOperation({
    summary: 'Met à jour un item (checked, nom, quantité, unité)',
  })
  @ApiOkResponse({ type: ShoppingListItemDto })
  updateItem(
    @CurrentUser('id') userId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateShoppingListItemDto,
  ) {
    return this.shoppingList.updateItem(userId, itemId, dto);
  }

  @Delete('items/:itemId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Supprime un item de la liste' })
  @ApiNoContentResponse()
  removeItem(
    @CurrentUser('id') userId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.shoppingList.removeItem(userId, itemId);
  }
}
