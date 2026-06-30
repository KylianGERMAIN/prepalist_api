import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { JwtPayload, TokenPair, TokenService } from '../token/token.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
  ) {}

  /** Crée un compte et renvoie une paire de tokens. */
  async register(dto: RegisterDto): Promise<TokenPair> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.users.create(dto.email, passwordHash);
    return this.tokens.issueTokens(user);
  }

  /** Authentifie par email/mot de passe ; lève si invalide. */
  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    return this.tokens.issueTokens(user);
  }

  /** Renouvelle la paire de tokens à partir d'un refresh token valide. */
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.tokens.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }
    // Token valide mais utilisateur disparu : 401, pas 404.
    let user: User;
    try {
      user = await this.users.findById(payload.sub);
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }
    return this.tokens.issueTokens(user);
  }
}
