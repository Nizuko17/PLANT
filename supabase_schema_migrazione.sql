-- Eliminiamo eventuali tabelle esistenti in caso di run parziale
DROP TABLE IF EXISTS "device_settings" CASCADE;
DROP TABLE IF EXISTS "water_stats" CASCADE;
DROP TABLE IF EXISTS "devices" CASCADE;
DROP TABLE IF EXISTS "components" CASCADE;
DROP TABLE IF EXISTS "product_components" CASCADE;
DROP TABLE IF EXISTS "order_items" CASCADE;
DROP TABLE IF EXISTS "products" CASCADE;
DROP TABLE IF EXISTS "status" CASCADE;
DROP TABLE IF EXISTS "favorites" CASCADE;
DROP TABLE IF EXISTS "addresses" CASCADE;
DROP TABLE IF EXISTS "orders" CASCADE;
DROP TABLE IF EXISTS "profiles" CASCADE;

-- 1. Definiamo Profiles nativamente linkati ad auth.users
CREATE TABLE "profiles" (
    "id" UUID NOT NULL PRIMARY KEY REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "first_name" VARCHAR(255),
    "last_name" VARCHAR(255),
    "birth_date" DATE,
    "address" VARCHAR(255),
    "phone" VARCHAR(255),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS per i profili
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger aggiornamento e creazione account utente
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminare e ricreare il trigger logicamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. Status di lookup
CREATE TABLE "status" (
    "id" BIGSERIAL PRIMARY KEY,
    "type" VARCHAR(255) NOT NULL
);

-- Inseriamo gli status per far funzionare l'healthcheck
INSERT INTO "status" ("type") VALUES ('Active'), ('Inactive'), ('Pending'), ('Archived');

-- Lo status deve essere pubblico in sola lettura (ideale come ping dal Next.js)
ALTER TABLE status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Status viewable by everyone" ON status FOR SELECT USING (true);

-- 3. Prodotti
CREATE TABLE "products" (
    "id" BIGSERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL UNIQUE,
    "category_id" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "price" NUMERIC(10, 2) NOT NULL,
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "image_urls" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products viewable by everyone" ON products FOR SELECT USING (true);

-- 4. Componenti 
CREATE TABLE "components" (
    "id" BIGSERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "image" VARCHAR(255),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Componenti Installati (tabella ponte tra prodotti e componenti)
CREATE TABLE "product_components" (
    "product_id" BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    "component_id" BIGINT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, component_id)
);

-- 6. Indirizzi utente
CREATE TABLE "addresses" (
    "id" BIGSERIAL PRIMARY KEY,
    "user_id" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    "street" VARCHAR(255) NOT NULL,
    "city" VARCHAR(255) NOT NULL,
    "postal_code" VARCHAR(50) NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "is_default" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can completely manage their addresses" 
ON addresses FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 7. Ordini
CREATE TABLE "orders" (
    "id" BIGSERIAL PRIMARY KEY,
    "user_id" UUID NOT NULL REFERENCES profiles(id),
    "total_amount" NUMERIC(10, 2) NOT NULL,
    "address_id" BIGINT NOT NULL REFERENCES addresses(id),
    "status_id" BIGINT NOT NULL REFERENCES status(id),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only view their orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 8. Righe Ordine (Item Ordine)
CREATE TABLE "order_items" (
    "id" BIGSERIAL PRIMARY KEY,
    "order_id" BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    "product_id" BIGINT NOT NULL REFERENCES products(id),
    "quantity" INTEGER NOT NULL CHECK (quantity > 0),
    "price_per_item" NUMERIC(10, 2) NOT NULL
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view order items for their orders" 
ON order_items FOR SELECT 
USING (
  EXISTS(SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);

-- 9. Preferiti
CREATE TABLE "favorites" (
    "id" BIGSERIAL PRIMARY KEY,
    "user_id" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    "product_id" BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, product_id)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites" ON favorites FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 10. Device (My Device) - i vasi posseduti
CREATE TABLE "device_settings" (
    "id" BIGSERIAL PRIMARY KEY,
    "humidity_threshold" FLOAT DEFAULT 30.0,
    "temperature_alert" FLOAT DEFAULT 35.0,
    "auto_water" BOOLEAN DEFAULT true
);

CREATE TABLE "devices" (
    "id" BIGSERIAL PRIMARY KEY,
    "user_id" UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    "product_id" BIGINT NOT NULL REFERENCES products(id),
    "name" VARCHAR(255) NOT NULL,
    "status_id" BIGINT NOT NULL REFERENCES status(id),
    "water_use" FLOAT DEFAULT 0,
    "mac_address" VARCHAR(255),
    "settings_id" BIGINT REFERENCES device_settings(id),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own devices" ON devices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 11. Water Stats
CREATE TABLE "water_stats" (
    "id" BIGSERIAL PRIMARY KEY,
    "device_id" BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    "use" FLOAT NOT NULL,
    "week" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
