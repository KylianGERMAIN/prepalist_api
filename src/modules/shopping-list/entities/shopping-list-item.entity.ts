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
import { Week } from '../../weeks/entities/week.entity';

export enum ShoppingItemSource {
  DERIVED = 'DERIVED',
  MANUAL = 'MANUAL',
}

/**
 * Item matérialisé de la liste de courses d'une semaine. Un item DERIVED est
 * (re)calculé depuis les plats par `sync` ; un item MANUAL est saisi par
 * l'utilisateur et jamais touché par `sync`.
 */
@Entity('shopping_list_items')
export class ShoppingListItem {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Week, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'week_id' })
  week?: Week;

  @Index()
  @Column({ name: 'week_id' })
  weekId!: string;

  @ApiProperty({ enum: ShoppingItemSource })
  @Column({ type: 'enum', enum: ShoppingItemSource })
  source!: ShoppingItemSource;

  @ManyToOne(() => Ingredient, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ingredient_id' })
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
