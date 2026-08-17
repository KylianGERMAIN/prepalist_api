import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericTransformer } from '../../../common/transformers/numeric.transformer';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';
import { Plan } from '../../plan/entities/plan.entity';

export enum ShoppingItemSource {
  DERIVED = 'DERIVED',
  MANUAL = 'MANUAL',
}

// `sync` recalcule les items DERIVED depuis les plats et ne touche jamais aux MANUAL.
@Entity('shopping_list_items')
@Index('UQ_shopping_items_derived', ['planId', 'ingredientId', 'unit'], {
  unique: true,
  where: `source = 'DERIVED'::shopping_list_items_source_enum`,
})
export class ShoppingListItem {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Plan, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'plan_id',
    foreignKeyConstraintName: 'FK_shopping_items_plan',
  })
  plan?: Plan;

  @Index('IDX_shopping_items_plan')
  @Column({ name: 'plan_id' })
  planId!: string;

  @ApiProperty({ enum: ShoppingItemSource })
  @Column({ type: 'enum', enum: ShoppingItemSource })
  source!: ShoppingItemSource;

  @ManyToOne(() => Ingredient, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'ingredient_id',
    foreignKeyConstraintName: 'FK_shopping_items_ingredient',
  })
  ingredient?: Ingredient | null;

  @ApiProperty({ type: String, nullable: true })
  @Column({ name: 'ingredient_id', type: 'uuid', nullable: true })
  ingredientId!: string | null;

  @ApiProperty()
  @Column()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  @Column({ type: 'varchar', nullable: true })
  unit!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  @Column({
    type: 'numeric',
    nullable: true,
    transformer: numericTransformer,
  })
  quantity!: number | null;

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  checked!: boolean;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
