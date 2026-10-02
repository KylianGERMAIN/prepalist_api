-- Attribue un rayon aux ingrédients qui n'en ont pas, d'après leur nom.
-- Idempotent : ne touche que `aisle IS NULL`, donc ni les corrections faites à la
-- main (PATCH /ingredients/:id) ni un second passage. Les noms non reconnus
-- restent à NULL, affichés dans « Autre », à corriger depuis la liste.
-- À lancer sur la base cible après la migration AddAisles1788100000000.
BEGIN;

-- Exceptions d'abord : leur nom contient un mot d'un autre rayon (tomate, lait).
UPDATE ingredients SET aisle = 'PANTRY_SAVORY' WHERE aisle IS NULL AND lower(name) ~
  '(concassé|coulis|lait de coco|sauce tomate|purée de tomate)';

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
  '(surgelé|glace|petits pois surgelés)';

UPDATE ingredients SET aisle = 'PANTRY_SWEET' WHERE aisle IS NULL AND lower(name) ~
  '(sucre|miel|chocolat|confiture|biscuit|farine|levure|vanille)';

UPDATE ingredients SET aisle = 'PANTRY_SAVORY' WHERE aisle IS NULL AND lower(name) ~
  '(pâtes|pates|spaghetti|nouille|riz|semoule|quinoa|boulgour|lentille|pois chiche|haricot|conserve|concassé|thon|sauce|huile|vinaigre|moutarde|sel\M|poivre|épice|curry|cumin|paprika|origan|bouillon|lait de coco)';

UPDATE ingredients SET aisle = 'DRINKS' WHERE aisle IS NULL AND lower(name) ~
  '(vin\M|bière|jus|eau\M|soda)';

UPDATE ingredients SET aisle = 'HOUSEHOLD' WHERE aisle IS NULL AND lower(name) ~
  '(éponge|lessive|papier|sac poubelle|liquide vaisselle)';

-- Contrôle : ce qui reste sans rayon, à corriger à la main.
SELECT name FROM ingredients WHERE aisle IS NULL ORDER BY name;

COMMIT;
