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
import { PlanSlot } from './plan-slot.entity';

/** Plan de repas courant d'un utilisateur : un seul par compte. */
@Entity('plans')
export class Plan {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_plans_user' })
  user?: User;

  @Index('UQ_plans_user', { unique: true })
  @Column({ name: 'user_id' })
  userId!: string;

  @ApiProperty({
    description:
      'Premier jour du plan (YYYY-MM-DD). Ancre d’affichage : sert à libeller les jours et à situer le jour courant, jamais à retrouver un plan.',
  })
  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @ApiProperty({ description: 'Nombre de jours couverts par le plan.' })
  @Column({ name: 'day_count', type: 'smallint', default: 7 })
  dayCount!: number;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty({ type: () => [PlanSlot] })
  @OneToMany(() => PlanSlot, (slot) => slot.plan, {
    cascade: true,
    eager: true,
  })
  slots!: PlanSlot[];
}
