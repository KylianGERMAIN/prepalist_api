import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Week } from '../weeks/entities/week.entity';
import { addDays, startOfWeek } from '../weeks/week-dates';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Week) private readonly weeks: Repository<Week>,
  ) {}

  /**
   * Rappel hebdo (dimanche 18h) : cible les utilisateurs qui n'ont pas encore
   * planifié la semaine à venir. Renvoie le nombre d'utilisateurs ciblés.
   */
  @Cron('0 18 * * 0')
  async sendWeeklyReminders(): Promise<number> {
    const nextMonday = addDays(startOfWeek(new Date()), 7);
    const planned = await this.weeks.find({ where: { startDate: nextMonday } });
    const plannedUserIds = new Set(planned.map((week) => week.userId));

    // ponytail: charge tous les users (app mono-user). Filtrer en SQL si ça grossit.
    const users = await this.users.find();
    const toRemind = users.filter((user) => !plannedUserIds.has(user.id));

    for (const user of toRemind) {
      // ponytail: livraison par log (seam). Brancher email/push ici une fois le
      // canal choisi. On logge l'id (pas l'email) pour ne pas écrire de PII.
      this.logger.log(`Rappel hebdo -> user ${user.id} : planifie ta semaine`);
    }
    return toRemind.length;
  }
}
