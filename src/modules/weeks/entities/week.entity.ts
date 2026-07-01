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
import { WeekSlot } from './week-slot.entity';

@Entity('weeks')
export class Week {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @ApiProperty({ description: 'Lundi de la semaine (YYYY-MM-DD)' })
  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty({ type: () => [WeekSlot] })
  @OneToMany(() => WeekSlot, (slot) => slot.week, {
    cascade: true,
    eager: true,
  })
  slots!: WeekSlot[];
}
