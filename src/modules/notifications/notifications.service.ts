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
    const now = new Date();
    // ponytail: charge tous les users (app mono-user). Filtrer en SQL si ça grossit.
    const users = await this.users.find();

    // La "semaine à venir" dépend du jour de courses de chaque utilisateur.
    const toRemind: User[] = [];
    for (const user of users) {
      const nextStart = addDays(startOfWeek(now, user.shoppingDay), 7);
      const planned = await this.weeks.findOne({
        where: { userId: user.id, startDate: nextStart },
      });
      if (!planned) {
        toRemind.push(user);
      }
    }

    for (const user of toRemind) {
      // ponytail: livraison par log (seam). Brancher email/push ici une fois le
      // canal choisi. On logge l'id (pas l'email) pour ne pas écrire de PII.
      this.logger.log(`Rappel hebdo -> user ${user.id} : planifie ta semaine`);
    }
    return toRemind.length;
  }
}
