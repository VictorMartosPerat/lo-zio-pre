ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS slug text UNIQUE;

DELETE FROM menu_items WHERE id IN (
  '6addf355-47e9-40e2-919a-a3144a99b54f',
  '9b863756-4392-4169-9b24-da18fb784da9',
  '779cd0d0-55da-4858-9534-4d8b7b224d99',
  '0b488ca4-0ff6-4ac5-b6ab-b18c64225afc'
);

UPDATE menu_items SET slug = 'drink_agua'       WHERE id = '45791dbe-6de8-4ba6-822b-ddf3c219d28a';
UPDATE menu_items SET slug = 'drink_cerveza'    WHERE id = 'e11a1f43-80df-4a36-83ef-7458cb7f24a4';
UPDATE menu_items SET slug = 'drink_vino'       WHERE id = '134f26e2-86de-4b8c-a5c4-0f8dae96ee7f';
UPDATE menu_items SET slug = 'dessert_tiramisu' WHERE id = 'e271ecdb-b629-4ba2-b68e-ba6c8808544f';

INSERT INTO menu_items (name, price, category, allergens, is_active, sort_order, slug)
VALUES
  ('Coca-Cola',       2.50, 'drinks', '{}', true,  5, 'soda_coca-cola'),
  ('Coca-Cola Zero',  2.50, 'drinks', '{}', true,  6, 'soda_coca-cola-zero'),
  ('Fanta Naranja',   2.50, 'drinks', '{}', true,  7, 'soda_fanta-naranja'),
  ('Fanta Limón',     2.50, 'drinks', '{}', true,  8, 'soda_fanta-limon'),
  ('Fuze Tea Limón',  2.50, 'drinks', '{}', true,  9, 'soda_fuze-tea'),
  ('Aquarius Limón',  2.50, 'drinks', '{}', true, 10, 'soda_aquarius'),
  ('Jamón dulce',       3.00, 'extras', '{gluten,sulfitos}', true, 10, 'jamon_dulce'),
  ('Jamón serrano',     3.00, 'extras', '{gluten,sulfitos}', true, 11, 'jamon_serrano'),
  ('Bacon',             3.00, 'extras', '{sulfitos}',        true, 12, 'bacon'),
  ('Salami milano',     3.00, 'extras', '{sulfitos}',        true, 13, 'salami_milano'),
  ('Salami picante',    3.00, 'extras', '{sulfitos}',        true, 14, 'salami_picante'),
  ('Embutido calabrés', 3.00, 'extras', '{sulfitos}',        true, 15, 'embutido_calabres'),
  ('Bresaola',          3.00, 'extras', '{sulfitos}',        true, 16, 'bresaola'),
  ('Longaniza',         3.00, 'extras', '{sulfitos}',        true, 17, 'longaniza'),
  ('Speck',             3.00, 'extras', '{sulfitos}',        true, 18, 'speck'),
  ('''Nduja',           3.00, 'extras', '{sulfitos}',        true, 19, 'nduja'),
  ('Porchetta',         4.00, 'extras', '{sulfitos}',        true, 20, 'porchetta'),
  ('Mozzarella extra',  3.00, 'extras', '{lacteos}', true, 21, 'mozzarella_extra'),
  ('Fior di latte',     5.00, 'extras', '{lacteos}', true, 22, 'fior_di_latte'),
  ('Mozzarella búfala', 5.00, 'extras', '{lacteos}', true, 23, 'mozzarella_bufala'),
  ('Burrata',           5.00, 'extras', '{lacteos}', true, 24, 'burrata'),
  ('Scamorza',          3.00, 'extras', '{lacteos}', true, 25, 'scamorza'),
  ('Gorgonzola',        3.00, 'extras', '{lacteos}', true, 26, 'gorgonzola'),
  ('Fontina',           3.00, 'extras', '{lacteos}', true, 27, 'fontina'),
  ('Emmental',          3.00, 'extras', '{lacteos}', true, 28, 'emmental'),
  ('Grana Padano',      3.00, 'extras', '{lacteos}', true, 29, 'grana_padano'),
  ('Queso de cabra',    3.00, 'extras', '{lacteos}', true, 30, 'queso_cabra'),
  ('Tomate fresco', 2.00, 'extras', '{}', true, 31, 'tomate_fresco'),
  ('Tomate seco',   2.00, 'extras', '{}', true, 32, 'tomate_seco'),
  ('Champiñones',   2.00, 'extras', '{}', true, 33, 'champinones'),
  ('Cebolla',       2.00, 'extras', '{}', true, 34, 'cebolla'),
  ('Cebolla roja',  2.00, 'extras', '{}', true, 35, 'cebolla_roja'),
  ('Pimiento rojo', 2.00, 'extras', '{}', true, 36, 'pimiento_rojo'),
  ('Calabacín',     2.00, 'extras', '{}', true, 37, 'calabacin'),
  ('Berenjena',     2.00, 'extras', '{}', true, 38, 'berenjena'),
  ('Alcachofas',    2.00, 'extras', '{}', true, 39, 'alcachofas'),
  ('Friarielli',    2.00, 'extras', '{}', true, 40, 'friarielli'),
  ('Anchoas',        3.00, 'extras', '{pescado}',            true, 41, 'anchoas'),
  ('Atún',           3.00, 'extras', '{pescado}',            true, 42, 'atun'),
  ('Salmón ahumado', 5.00, 'extras', '{pescado,sulfitos}',   true, 43, 'salmon_ahumado'),
  ('Huevo',         2.00, 'extras', '{huevo}',                    true, 44, 'huevo'),
  ('Frankfurt',     2.00, 'extras', '{soja,mostaza,sulfitos}',    true, 45, 'frankfurt'),
  ('Piña',          2.00, 'extras', '{}', true, 46, 'pina'),
  ('Maíz',          2.00, 'extras', '{}', true, 47, 'maiz'),
  ('Olivas negras', 2.00, 'extras', '{}', true, 48, 'olivas_negras'),
  ('Rúcula',        2.00, 'extras', '{}', true, 49, 'rucula'),
  ('Guindilla',     2.00, 'extras', '{}', true, 50, 'guindilla');