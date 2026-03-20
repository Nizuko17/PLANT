import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

    const { id } = await params;

    const { data: device, error } = await supabase
      .from('devices')
      .select('*, product:products(name, slug), device_status:status(type), settings:device_settings(*)')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (error || !device) {
      return NextResponse.json({ error: 'Dispositivo non trovato' }, { status: 404 });
    }

    return NextResponse.json(device);
  } catch (error) {
    console.error('API Device GET Error:', error);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const {
      name, humidity_threshold, temperature_alert, auto_water,
      latitude, longitude, city,
      last_ip, pump_duration, buzzer_alarms_enabled,
      increment_water
    } = body;

    // Verifica che il dispositivo appartenga all'utente
    const { data: existingDevice } = await supabase
      .from('devices')
      .select('id, settings_id, water_use')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (!existingDevice) {
      return NextResponse.json({ error: 'Dispositivo non trovato' }, { status: 404 });
    }

    // Aggiornamento nome dispositivo
    if (name) {
      const cleanName = name.replace(/<[^>]*>?/gm, '');
      const { error: nameError } = await supabase
        .from('devices')
        .update({ name: cleanName, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (nameError) throw nameError;
    }

    // Aggiornamento statistiche acqua (water_use)
    if (increment_water) {
      const currentUse = existingDevice.water_use || 0;
      const { error: waterError } = await supabase
        .from('devices')
        .update({ water_use: currentUse + parseFloat(increment_water) })
        .eq('id', id);
      if (waterError) throw waterError;
    }

    // Aggiornamento impostazioni (device_settings)
    const settingsUpdate = {};
    if (humidity_threshold !== undefined) settingsUpdate.humidity_threshold = parseFloat(humidity_threshold);
    if (temperature_alert !== undefined) settingsUpdate.temperature_alert = parseFloat(temperature_alert);
    if (auto_water !== undefined) settingsUpdate.auto_water = Boolean(auto_water);
    if (latitude !== undefined) settingsUpdate.latitude = parseFloat(latitude) || null;
    if (longitude !== undefined) settingsUpdate.longitude = parseFloat(longitude) || null;
    if (city !== undefined) settingsUpdate.city = String(city).substring(0, 100);
    if (last_ip !== undefined) settingsUpdate.last_ip = last_ip ? String(last_ip).substring(0, 45) : null;
    if (pump_duration !== undefined) settingsUpdate.pump_duration = Math.max(1, Math.min(300, parseInt(pump_duration) || 10));
    if (buzzer_alarms_enabled !== undefined) settingsUpdate.buzzer_alarms_enabled = Boolean(buzzer_alarms_enabled);

    if (Object.keys(settingsUpdate).length > 0) {
      if (existingDevice.settings_id) {
        // Aggiorna settings esistenti
        await supabase
          .from('device_settings')
          .update(settingsUpdate)
          .eq('id', existingDevice.settings_id);
      } else {
        // Crea nuove settings e collegale al device
        const { data: newSettings } = await supabase
          .from('device_settings')
          .insert([settingsUpdate])
          .select()
          .single();
        if (newSettings) {
          await supabase
            .from('devices')
            .update({ settings_id: newSettings.id })
            .eq('id', id);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Device PATCH Error:', error);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

    const { id } = await params;

    // Recupera setting_id da eliminare
    const { data: device } = await supabase
      .from('devices')
      .select('settings_id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (!device) return NextResponse.json({ error: 'Dispositivo non trovato' }, { status: 404 });

    // Elimina dispositivo
    const { error: delError } = await supabase
      .from('devices')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);
      
    if (delError) throw delError;

    // Opzionale: pulizia settings orfani se nessun altro device lo usa
    if (device.settings_id) {
      await supabase.from('device_settings').delete().eq('id', device.settings_id);
    }

    return NextResponse.json({ success: true, message: 'Dispositivo eliminato' });
  } catch (error) {
    console.error('API Device DELETE Error:', error);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
