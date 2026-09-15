import { getMetadataArgsStorage } from 'typeorm';
import { MealIngredient } from './entities/meal-ingredient.entity';
import { Meal } from './entities/meal.entity';

// Verrouille le côté de la relation : `orphanedRowAction` déclaré sur le @OneToMany
// de Meal reste à `nullify`, et retirer un ingrédient viole le NOT NULL sur meal_id.
describe('MealIngredient.meal', () => {
  const relations = getMetadataArgsStorage().relations;

  it('supprime les lignes orphelines au lieu de les détacher', () => {
    const manyToOne = relations.find(
      (r) => r.target === MealIngredient && r.propertyName === 'meal',
    );
    expect(manyToOne?.options.orphanedRowAction).toBe('delete');
  });

  // Un eager ici rendrait le chargement global, que chaque appelant déclare.
  it('garde la cascade sans eager côté Meal', () => {
    const oneToMany = relations.find(
      (r) => r.target === Meal && r.propertyName === 'ingredients',
    );
    expect(oneToMany?.options.cascade).toBe(true);
    expect(oneToMany?.options.eager).toBeUndefined();
  });
});
