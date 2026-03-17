-- Inserisci Status base se non già presenti
INSERT INTO "status" ("type") VALUES ('Active'), ('Inactive'), ('Pending'), ('Archived') ON CONFLICT DO NOTHING;

-- 1. Inserimento Prodotti (Categoria 1)
INSERT INTO "products" ("name", "slug", "category_id", "description", "price", "stock_qty", "image_urls", "is_active") VALUES
('PLANT One', 'plant-one', 1, 'Il vaso intelligente essenziale. Sensori di umidità e temperatura integrati.', 89.00, 100, '/assets/hero.png', true),
('PLANT Pro', 'plant-pro', 1, 'Irrigazione automatica, sensore pH e connettività Wi-Fi avanzata.', 149.00, 50, '/assets/hero.png', true),
('PLANT Max', 'plant-max', 1, 'La soluzione completa: serbatoio integrato, pannello solare e app dedicata.', 229.00, 25, '/assets/hero.png', true)
ON CONFLICT ("slug") DO NOTHING;

-- 2. Inserimento Accessori (Categoria 2)
INSERT INTO "products" ("name", "slug", "category_id", "description", "price", "stock_qty", "image_urls", "is_active") VALUES
('Set Sensori di Ricambio', 'set-sensori', 2, 'Kit completo di sensori pH, umidità e temperatura compatibile con PLANT Pro e Max.', 29.90, 200, null, true),
('Nutrienti Botanici 1L', 'nutrienti-1l', 2, 'Mix di macro e micro elementi studiato in laboratorio per l''erogatore automatico.', 19.90, 500, null, true),
('Supporto in Legno', 'supporto-legno', 2, 'Rialzo in elegante legno di rovere sostenuto ecosostenibile, perfetto per dare visibilità alla pianta.', 45.00, 150, null, true)
ON CONFLICT ("slug") DO NOTHING;
