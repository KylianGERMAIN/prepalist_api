import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Normalise un email pour comparaison/stockage insensible à la casse. */
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /** Recherche un utilisateur par email (null si absent). */
  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: this.normalizeEmail(email) } });
  }

  /** Récupère un utilisateur par id ou lève NotFoundException. */
  async findById(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  /** Crée un utilisateur ; lève ConflictException si l'email existe déjà. */
  async create(
    email: string,
    passwordHash: string,
    role: UserRole = UserRole.USER,
  ): Promise<User> {
    const normalized = this.normalizeEmail(email);
    const exists = await this.users.findOne({ where: { email: normalized } });
    if (exists) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }
    const user = this.users.create({ email: normalized, passwordHash, role });
    return this.users.save(user);
  }
}
