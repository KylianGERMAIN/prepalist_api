import { ApiProperty } from '@nestjs/swagger';
import { User, UserRole } from '../entities/user.entity';

/** Vue publique du profil courant : jamais de passwordHash. */
export class MeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty({ minimum: 0, maximum: 6 })
  shoppingDay: number;

  constructor(user: User) {
    this.id = user.id;
    this.email = user.email;
    this.role = user.role;
    this.shoppingDay = user.shoppingDay;
  }
}
