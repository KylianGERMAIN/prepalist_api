import { PartialType } from '@nestjs/swagger';
import { CreateMealDto } from './create-meal.dto';

/** Tous les champs de création, optionnels. */
export class UpdateMealDto extends PartialType(CreateMealDto) {}
