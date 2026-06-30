import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MealIngredient } from './meal-ingredient.entity';

@Entity('meals')
export class Meal {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @ApiProperty()
  @Column()
  name!: string;

  @ApiProperty({ nullable: true, minimum: 1, maximum: 5 })
  @Column({ type: 'int', nullable: true })
  rating!: number | null;

  @ApiProperty()
  @Column({ name: 'is_favorite', default: false })
  isFavorite!: boolean;

  @ApiProperty({ nullable: true })
  @Column({ name: 'last_cooked_at', type: 'timestamptz', nullable: true })
  lastCookedAt!: Date | null;

  @ApiProperty()
  @Column({ name: 'times_cooked', type: 'int', default: 0 })
  timesCooked!: number;

  @ApiProperty({ type: [String] })
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  tags!: string[];

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty({ type: () => [MealIngredient] })
  @OneToMany(() => MealIngredient, (mi) => mi.meal, {
    cascade: true,
    eager: true,
    orphanedRowAction: 'delete',
  })
  ingredients!: MealIngredient[];
}
