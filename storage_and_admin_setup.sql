-- Esegui questo script nel SQL Editor di Supabase per creare il bucket storage per le immagini dei prodotti

-- 1. Crea il bucket pubblico 'products'
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Policy: Upload permesso solo agli utenti autenticati
CREATE POLICY "Allow authenticated uploads" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products');

-- 3. Policy: Download permesso a tutti (immagini pubbliche)
CREATE POLICY "Allow public read access" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'products');

-- 4. Policy: Modifica e cancellazione per utenti autenticati
CREATE POLICY "Allow authenticated updates" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'products');

CREATE POLICY "Allow authenticated deletes" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'products');

-- 5. Abilitare INSERT/UPDATE/DELETE prodotti per admin
-- (necessario se non hai ancora abilitato la policy admin sui prodotti)
CREATE POLICY "Admin can manage products" ON products
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- 6. Admin può gestire la tabella ponte product_components
ALTER TABLE product_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_components viewable by everyone" ON product_components
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage product_components" ON product_components
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- 7. Componenti visibili a tutti
ALTER TABLE components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "components viewable by everyone" ON components
  FOR SELECT USING (true);
