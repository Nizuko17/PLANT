-- Migrazione PLANT v3.0.0 — Nuove colonne device_settings
-- Eseguire nel SQL Editor di Supabase

ALTER TABLE public.device_settings
  ADD COLUMN IF NOT EXISTS last_ip character varying,
  ADD COLUMN IF NOT EXISTS pump_duration integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS buzzer_alarms_enabled boolean DEFAULT true;
