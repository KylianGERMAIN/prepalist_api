import { ApiProperty } from '@nestjs/swagger';
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Meal } from '../../meals/entities/meal.entity';
import { Plan } from './plan.entity';

export enum MealSlot {
  LUNCH = 'LUNCH',
  DINNER = 'DINNER',
}

@Entity('plan_slots')
@Unique('UQ_plan_slots_plan_day_slot', ['planId', 'dayIndex', 'slot'])
@Check('CHK_plan_slots_away_empty', `NOT ("away" AND "meal_id" IS NOT NULL)`)
export class PlanSlot {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Plan, (plan) => plan.slots, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'plan_id',
    foreignKeyConstraintName: 'FK_plan_slots_plan',
  })
  plan!: Plan;

  @Index('IDX_plan_slots_plan')
  @Column({ name: 'plan_id' })
  planId!: string;

  @ApiProperty({
    description: 'Rang du jour dans le plan : 0 = premier jour.',
  })
  @Column({ name: 'day_index', type: 'smallint' })
  dayIndex!: number;

  @ApiProperty({ enum: MealSlot })
  @Column({ type: 'enum', enum: MealSlot })
  slot!: MealSlot;

  @ApiProperty({ type: String, nullable: true })
  @Column({ name: 'meal_id', type: 'uuid', nullable: true })
  mealId!: string | null;

  @ApiProperty({ type: () => Meal, nullable: true })
  @ManyToOne(() => Meal, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'meal_id',
    foreignKeyConstraintName: 'FK_plan_slots_meal',
  })
  meal?: Meal | null;

  @ApiProperty()
  @Column({ type: 'int', default: 1 })
  servings!: number;

  @ApiProperty({
    description: 'Repas pris dehors : décidé, sans repas à cuisiner.',
  })
  @Column({ type: 'boolean', default: false })
  away!: boolean;
}
