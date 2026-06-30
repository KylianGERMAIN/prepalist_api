import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ingredients')
export class Ingredient {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @Column({ unique: true })
  name!: string;

  @ApiProperty({ nullable: true })
  @Column({ name: 'default_unit', nullable: true, type: 'varchar' })
  defaultUnit!: string | null;
}
