import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericTransformer } from '../../../common/transformers/numeric.transformer';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';
import { Meal } from './meal.entity';

@Entity('meal_ingredients')
export class MealIngredient {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // `orphanedRowAction` doit être ici et non sur le @OneToMany de Meal : TypeORM
  // le lit via `relation.inverseRelation`. Placé là-bas il reste à 'nullify', et
  // retirer un ingrédient viole alors le NOT NULL sur `meal_id`.
  @ManyToOne(() => Meal, (meal) => meal.ingredients, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'meal_id', foreignKeyConstraintName: 'FK_mi_meal' })
  meal!: Meal;

  @Index('IDX_mi_meal')
  @Column({ name: 'meal_id' })
  mealId!: string;

  @ApiProperty({ type: () => Ingredient })
  @ManyToOne(() => Ingredient, { eager: true })
  @JoinColumn({
    name: 'ingredient_id',
    foreignKeyConstraintName: 'FK_mi_ingredient',
  })
  ingredient!: Ingredient;

  @Index('IDX_mi_ingredient')
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
