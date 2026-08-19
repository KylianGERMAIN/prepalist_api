import { getMetadataArgsStorage } from 'typeorm';
import { MealIngredient } from './entities/meal-ingredient.entity';

// Filet rapide, sans base : les e2e vérifient le schéma réel mais exigent un
// Postgres, alors que ces assertions tournent dans `pnpm test`.
describe('MealIngredient — alignement du metadata sur le schéma', () => {
  const indices = getMetadataArgsStorage().indices.filter(
    (i) => i.target === MealIngredient,
  );
  const joinColumns = getMetadataArgsStorage().joinColumns.filter(
    (j) => j.target === MealIngredient,
  );

  it.each([
    ['IDX_mi_meal', 'mealId'],
    ['IDX_mi_ingredient', 'ingredientId'],
  ])('déclare %s sur %s', (name, property) => {
    const index = indices.find((i) => i.name === name);
    expect(index?.columns).toEqual([property]);
    expect(index?.unique).toBe(false);
  });

  it.each([
    ['meal', 'FK_mi_meal'],
    ['ingredient', 'FK_mi_ingredient'],
  ])('nomme la clé étrangère de %s en %s', (property, constraint) => {
    const joinColumn = joinColumns.find((j) => j.propertyName === property);
    expect(joinColumn?.foreignKeyConstraintName).toBe(constraint);
  });
});
