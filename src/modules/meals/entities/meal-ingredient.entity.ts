import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericTransformer } from '../../../common/transformers/numeric.transformer';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';
import { Meal } from './meal.entity';

/** Jointure repas <-> ingrédient avec payload (quantité, unité). */
@Entity('meal_ingredients')
export class MealIngredient {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // orphanedRowAction est ici et non sur le @OneToMany de Meal : TypeORM le lit
  // sur `relation.inverseRelation`, donc sur ce côté-ci
  // (OneToManySubjectBuilder.js:159-170). Déclaré côté @OneToMany il reste au
  // défaut 'nullify', et retirer une ligne d'ingrédient tente un
  // `UPDATE meal_ingredients SET meal_id = NULL` qui viole le NOT NULL.
  @ManyToOne(() => Meal, (meal) => meal.ingredients, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'meal_id' })
  meal!: Meal;

  @Column({ name: 'meal_id' })
  mealId!: string;

  @ApiProperty({ type: () => Ingredient })
  @ManyToOne(() => Ingredient, { eager: true })
  @JoinColumn({ name: 'ingredient_id' })
  ingredient!: Ingredient;

  @ApiProperty()
  @Column({ name: 'ingredient_id' })
  ingredientId!: string;

  @ApiProperty()
  @Column({ type: 'numeric', transformer: numericTransformer })
  quantity!: number;

  @ApiProperty()
  @Column()
  unit!: string;
}
