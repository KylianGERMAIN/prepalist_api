import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Meal } from '../../meals/entities/meal.entity';
import { Week } from './week.entity';

export enum MealSlot {
  LUNCH = 'LUNCH',
  DINNER = 'DINNER',
}

/** Un créneau (midi ou soir d'un jour) d'une semaine, repas optionnel. */
@Entity('week_slots')
export class WeekSlot {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Week, (week) => week.slots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'week_id' })
  week!: Week;

  @Column({ name: 'week_id' })
  weekId!: string;

  @ApiProperty()
  @Column({ type: 'date' })
  date!: string;

  @ApiProperty({ enum: MealSlot })
  @Column({ type: 'enum', enum: MealSlot })
  slot!: MealSlot;

  @ApiProperty({ type: String, nullable: true })
  @Column({ name: 'meal_id', type: 'uuid', nullable: true })
  mealId!: string | null;

  @ApiProperty({ type: () => Meal, nullable: true })
  @ManyToOne(() => Meal, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'meal_id' })
  meal?: Meal | null;

  @ApiProperty()
  @Column({ type: 'int', default: 1 })
  servings!: number;
}
