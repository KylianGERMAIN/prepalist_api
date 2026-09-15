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

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: this.normalizeEmail(email) } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  async updateShoppingDay(id: string, shoppingDay: number): Promise<User> {
    const user = await this.findById(id);
    user.shoppingDay = shoppingDay;
    return this.users.save(user);
  }

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
