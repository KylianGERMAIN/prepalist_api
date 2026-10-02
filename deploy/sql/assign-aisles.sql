-- Attribue un rayon aux ingrédients qui n'en ont pas, d'après leur nom.
-- Idempotent : ne touche que `aisle IS NULL`, donc ni les corrections faites à la
-- main (PATCH /ingredients/:id) ni un second passage. Les noms non reconnus
-- restent à NULL, affichés dans « Autre », à corriger depuis la liste.
-- À lancer sur la base cible après la migration AddAisles1788100000000.
BEGIN;

-- Exceptions d'abord : leur nom contient un mot d'un autre rayon (tomate,
-- lait, bœuf, glace…).
UPDATE ingredients SET aisle = 'PANTRY_SAVORY' WHERE aisle IS NULL AND lower(name) ~
  '(concassé|coulis|lait de coco|sauce tomate|purée de tomate|concentré|pelée|bouillon|fond de|haricots verts|jus de citron)';
UPDATE ingredients SET aisle = 'PANTRY_SWEET' WHERE aisle IS NULL AND lower(name) ~
  '(sucre glace|sucre vanillé)';

UPDATE ingredients SET aisle = 'PRODUCE' WHERE aisle IS NULL AND lower(name) ~
  '(tomate|oignon|échalote|ail\M|carotte|courgette|aubergine|poivron|salade|laitue|roquette|avocat|citron|concombre|champignon|brocoli|chou|épinard|patate|pomme de terre|courge|butternut|poireau|céleri|radis|melon|pomme|poire|banane|fraise|basilic|persil|coriandre|ciboulette|menthe|gingembre)';

UPDATE ingredients SET aisle = 'BAKERY' WHERE aisle IS NULL AND lower(name) ~
  '(pain|baguette|brioche|tortilla|wrap|pita)';

UPDATE ingredients SET aisle = 'MEAT_FISH' WHERE aisle IS NULL AND lower(name) ~
  '(poulet|bœuf|boeuf|porc|veau|agneau|dinde|steak|haché|saumon|thon frais|cabillaud|crevette|lardon|saucisse)';

UPDATE ingredients SET aisle = 'CHEESE_DELI' WHERE aisle IS NULL AND lower(name) ~
  '(jambon|bacon|chorizo|saucisson|salami|coppa|bresaola|fromage|parmesan|mozzarella|feta|emmental|comté|reblochon|raclette|chèvre|gruyère|tomme|beaufort)';

UPDATE ingredients SET aisle = 'DAIRY' WHERE aisle IS NULL AND lower(name) ~
  '(lait\M|crème|beurre|yaourt|œuf|oeuf|skyr|mascarpone|ricotta|pâte brisée|pâte feuilletée|pâte à pizza)';

UPDATE ingredients SET aisle = 'FROZEN' WHERE aisle IS NULL AND lower(name) ~
  '(surgelé|glace)';

UPDATE ingredients SET aisle = 'PANTRY_SWEET' WHERE aisle IS NULL AND lower(name) ~
  '(sucre|miel|chocolat|confiture|biscuit|farine|levure|vanille)';

UPDATE ingredients SET aisle = 'PANTRY_SAVORY' WHERE aisle IS NULL AND lower(name) ~
  '(pâtes|pates|spaghetti|nouille|riz|semoule|quinoa|boulgour|lentille|pois chiche|haricot|conserve|concassé|thon|sauce|huile|vinaigre|moutarde|sel\M|poivre|épice|curry|cumin|paprika|origan)';

UPDATE ingredients SET aisle = 'DRINKS' WHERE aisle IS NULL AND lower(name) ~
  '(vin\M|bière|jus|eau\M|soda)';

UPDATE ingredients SET aisle = 'HOUSEHOLD' WHERE aisle IS NULL AND lower(name) ~
  '(éponge|lessive|papier|sac poubelle|liquide vaisselle)';

-- Contrôle : tout le classement, à relire avant COMMIT (les sans-rayon en fin).
-- Une erreur se corrige ensuite par PATCH /ingredients/:id.
SELECT coalesce(aisle::text, '— sans rayon') AS aisle, name
FROM ingredients ORDER BY aisle NULLS LAST, name;

COMMIT;
