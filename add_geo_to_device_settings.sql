-- Migrazione: aggiungi campi geografici a device_settings
-- Esegui questo script manualmente nel SQL Editor di Supabase

ALTER TABLE public.device_settings
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS city character varying(100);
