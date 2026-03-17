-- 1. Aggiungi il flag is_admin alla tabella profiles
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "is_admin" BOOLEAN DEFAULT false;

-- 2. Concedi i permessi massimi (ALL) ai profili is_admin nella tabella products
DROP POLICY IF EXISTS "Admins can manage products" ON products;
CREATE POLICY "Admins can manage products" ON products FOR ALL USING (
  EXISTS(SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND is_admin = true)
);

-- 3. Abilita RLS su components e aggiungi le policy per lettura pubblica e admin gestione
ALTER TABLE components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Components viewable by everyone" ON components;
CREATE POLICY "Components viewable by everyone" ON components FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage components" ON components;
CREATE POLICY "Admins manage components" ON components FOR ALL USING (
  EXISTS(SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND is_admin = true)
);

-- 4. Abilita RLS su product_components e aggiungi le policy per lettura pubblica e admin gestione
ALTER TABLE product_components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Product components viewable by everyone" ON product_components;
CREATE POLICY "Product components viewable by everyone" ON product_components FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage product components" ON product_components;
CREATE POLICY "Admins manage product components" ON product_components FOR ALL USING (
  EXISTS(SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND is_admin = true)
);

-- Seeding dei Componenti Base per il confronto dinamico
INSERT INTO components (id, name, description) VALUES
(1, 'Sensori Umidità', 'Sensori integrati per il rilevamento del livello di acqua.'),
(2, 'Sensori Temperatura', 'Rilevamento termico ambientale.'),
(3, 'Sensori pH', 'Analisi approfondita dell''acidità del suolo.'),
(4, 'Connettività Wi-Fi', 'Connessione a internet per controllo remoto dalla dashboard.'),
(5, 'Irrigazione Automatica', 'Sistema di rilascio acqua controllato.'),
(6, 'Serbatoio Integrato', 'Riserva d''acqua nascosta da 2 Litri.'),
(7, 'Pannello Solare', 'Auto alimentazione ecologica.')
ON CONFLICT (id) DO NOTHING;

-- Creazione dell'associazione Prodotto-Componenti
-- Supponendo che i prodotti creati nel seed precedente abbiano id 1, 2, 3

-- PLANT One (ID 1): Umidità (1), Temperatura (2)
INSERT INTO product_components (product_id, component_id) VALUES (1, 1), (1, 2) ON CONFLICT DO NOTHING;

-- PLANT Pro (ID 2): Umidità (1), Temperatura (2), pH (3), Wi-Fi (4), Irrigazione (5)
INSERT INTO product_components (product_id, component_id) VALUES (2, 1), (2, 2), (2, 3), (2, 4), (2, 5) ON CONFLICT DO NOTHING;

-- PLANT Max (ID 3): Tutti
INSERT INTO product_components (product_id, component_id) VALUES (3, 1), (3, 2), (3, 3), (3, 4), (3, 5), (3, 6), (3, 7) ON CONFLICT DO NOTHING;
