import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Index('UQ_ingredients_name_lower', { synchronize: false })
@Entity('ingredients')
export class Ingredient {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  // Unicité portée par un index `UNIQUE (LOWER(name))` déclaré en migration.
  @Column()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  @Column({ name: 'default_unit', nullable: true, type: 'varchar' })
  defaultUnit!: string | null;
}
