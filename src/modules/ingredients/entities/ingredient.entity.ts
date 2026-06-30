import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ingredients')
export class Ingredient {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  // Unicité insensible à la casse : assurée par un index fonctionnel
  // UNIQUE (LOWER(name)) côté migration, pas par une contrainte de colonne.
  @Column()
  name!: string;

  @ApiProperty({ nullable: true })
  @Column({ name: 'default_unit', nullable: true, type: 'varchar' })
  defaultUnit!: string | null;
}
