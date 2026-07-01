import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meal } from '../meals/entities/meal.entity';
import { WeekSlot } from './entities/week-slot.entity';
import { Week } from './entities/week.entity';
import { WeeksController } from './weeks.controller';
import { WeeksService } from './weeks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Week, WeekSlot, Meal])],
  controllers: [WeeksController],
  providers: [WeeksService],
  exports: [WeeksService],
})
export class WeeksModule {}
