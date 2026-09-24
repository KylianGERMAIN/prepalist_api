import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Unit } from '../../../common/unit';

@Entity('ingredients')
export class Ingredient {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  // Unicité portée par un index `UNIQUE (LOWER(name))` déclaré en migration.
  @Column()
  name!: string;

  @ApiProperty({ enum: Unit, nullable: true })
  @Column({
    name: 'default_unit',
    type: 'enum',
    enum: Unit,
    enumName: 'unit_enum',
    nullable: true,
  })
  defaultUnit!: Unit | null;
}
