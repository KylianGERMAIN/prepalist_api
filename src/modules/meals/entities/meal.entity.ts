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

export enum MealStatus {
  PRIVATE = 'PRIVATE',
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
}

@Entity('meals')
export class Meal {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @Column()
  name!: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_meals_user' })
  user?: User | null;

  /** `null` = recette fournie par l'application, sans compte propriétaire. */
  @ApiProperty({ type: String, nullable: true })
  @Index('IDX_meals_user')
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @ApiProperty({ enum: MealStatus })
  @Column({ type: 'enum', enum: MealStatus, default: MealStatus.PRIVATE })
  status!: MealStatus;

  @ApiProperty({ type: [String] })
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  tags!: string[];

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty({ type: () => [MealIngredient] })
  @OneToMany(() => MealIngredient, (mi) => mi.meal, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  ingredients!: MealIngredient[];
}
