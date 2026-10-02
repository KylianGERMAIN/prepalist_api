import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersService.name);
  private readonly adminEmails: string[];

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    config: ConfigService,
  ) {
    this.adminEmails = (config.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((email) => this.normalizeEmail(email))
      .filter(Boolean);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.adminEmails.length === 0) {
      return;
    }
    const { affected } = await this.users.update(
      { email: In(this.adminEmails), role: UserRole.USER },
      { role: UserRole.ADMIN },
    );
    if (affected) {
      this.logger.log(`${affected} compte(s) promu(s) ADMIN via ADMIN_EMAILS`);
    }
  }

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

  async create(email: string, passwordHash: string): Promise<User> {
    const normalized = this.normalizeEmail(email);
    const exists = await this.users.findOne({ where: { email: normalized } });
    if (exists) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }
    const user = this.users.create({
      email: normalized,
      passwordHash,
      role: UserRole.USER,
    });
    return this.users.save(user);
  }
}
