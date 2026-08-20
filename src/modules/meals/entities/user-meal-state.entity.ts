import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Meal } from './meal.entity';

@Entity('user_meal_state')
export class UserMealState {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_user_meal_state_user',
  })
  user?: User;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => Meal, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'meal_id',
    foreignKeyConstraintName: 'FK_user_meal_state_meal',
  })
  meal?: Meal;

  @PrimaryColumn({ name: 'meal_id', type: 'uuid' })
  mealId!: string;

  @ApiProperty()
  @Column({ name: 'is_favorite', default: false })
  isFavorite!: boolean;

  @ApiProperty({ type: Number, nullable: true, minimum: 1, maximum: 5 })
  @Column({ type: 'int', nullable: true })
  rating!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Column({ name: 'last_cooked_at', type: 'timestamptz', nullable: true })
  lastCookedAt!: Date | null;

  @ApiProperty()
  @Column({ name: 'times_cooked', type: 'int', default: 0 })
  timesCooked!: number;
}
