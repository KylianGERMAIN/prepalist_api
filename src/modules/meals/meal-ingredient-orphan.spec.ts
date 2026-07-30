import { getMetadataArgsStorage } from 'typeorm';
import { MealIngredient } from './entities/meal-ingredient.entity';
import { Meal } from './entities/meal.entity';

/**
 * TypeORM lit `orphanedRowAction` sur la relation **inverse**
 * (`OneToManySubjectBuilder`), donc sur le `@ManyToOne` de MealIngredient.
 * Déclaré uniquement côté `@OneToMany`, il reste au défaut `nullify` et retirer
 * une ligne d'ingrédient tente un `UPDATE meal_ingredients SET meal_id = NULL`
 * qui viole la contrainte NOT NULL.
 */
describe('MealIngredient.meal', () => {
  const relations = getMetadataArgsStorage().relations;

  it('supprime les lignes orphelines au lieu de les détacher', () => {
    const manyToOne = relations.find(
      (r) => r.target === MealIngredient && r.propertyName === 'meal',
    );
    expect(manyToOne?.options.orphanedRowAction).toBe('delete');
  });

  it('garde la cascade et le eager côté Meal', () => {
    const oneToMany = relations.find(
      (r) => r.target === Meal && r.propertyName === 'ingredients',
    );
    expect(oneToMany?.options.cascade).toBe(true);
    expect(oneToMany?.options.eager).toBe(true);
  });
});
