import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meal } from '../meals/entities/meal.entity';
import { UsersModule } from '../users/users.module';
import { WeekSlot } from './entities/week-slot.entity';
import { Week } from './entities/week.entity';
import { WeeksController } from './weeks.controller';
import { WeeksService } from './weeks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Week, WeekSlot, Meal]), UsersModule],
  controllers: [WeeksController],
  providers: [WeeksService],
  exports: [WeeksService],
})
export class WeeksModule {}
