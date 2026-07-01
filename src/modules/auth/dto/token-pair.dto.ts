import { ApiProperty } from '@nestjs/swagger';

/** Paire de tokens renvoyée par register / login / refresh. */
export class TokenPairDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;
}
