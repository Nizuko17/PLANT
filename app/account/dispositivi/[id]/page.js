'use client';

import { createClient } from '@/utils/supabase/client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Sprout, Wifi, WifiOff, Thermometer, Droplets,
  Bell, BellOff, Power, Monitor, Circle, Save, Edit3, X,
  MapPin, Clock, RefreshCw, AlertTriangle, CheckCircle2, Activity,
  Navigation, Loader2
} from 'lucide-react';
import Link from 'next/link';
import FadeIn from '@/components/FadeIn';
import { invalidateCache } from '@/hooks/useCache';

// ─── Helper: stato sensore → colore ───────────────────────────────────────────
function getSensorStatus(value, type) {
  if (value === null || value === undefined) return 'unknown';
  if (type === 'temp') return value < 10 ? 'cold' : value > 35 ? 'hot' : 'ok';
  if (type === 'hum') return value < 20 ? 'dry' : value > 80 ? 'wet' : 'ok';
  return 'ok';
}

const STATUS_COLORS = {
  ok: { bg: 'var(--accent-green-light)', color: 'var(--accent-green)', label: 'Ottimale' },
  hot: { bg: '#fff0f0', color: '#e53e3e', label: 'Troppo Caldo' },
  cold: { bg: '#ebf8ff', color: '#3182ce', label: 'Troppo Freddo' },
  dry: { bg: '#fffaf0', color: '#dd6b20', label: 'Secco' },
  wet: { bg: '#ebf8ff', color: '#3182ce', label: 'Umido' },
  unknown: { bg: 'var(--bg-alt)', color: 'var(--text-secondary)', label: 'N/D' },
};

// ─── Componente Card Sensore ──────────────────────────────────────────────────
function SensorCard({ icon: Icon, title, value, unit, statusType, extra }) {
  const st = getSensorStatus(value, statusType);
  const s = STATUS_COLORS[st];
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--border-color)',
      borderRadius: '20px', padding: '22px', display: 'flex',
      flexDirection: 'column', gap: '12px', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '3px',
        background: s.color, opacity: 0.7
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '12px',
          background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={22} color={s.color} />
        </div>
        <span style={{
          fontSize: '0.72rem', fontWeight: '700', padding: '4px 10px',
          borderRadius: '20px', background: s.bg, color: s.color, letterSpacing: '0.02em'
        }}>{s.label}</span>
      </div>
      <div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '500' }}>
          {title}
        </div>
        <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1 }}>
          {value !== null && value !== undefined ? `${value}` : '—'}
          {value !== null && value !== undefined && (
            <span style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--text-secondary)', marginLeft: '4px' }}>{unit}</span>
          )}
        </div>
        {extra && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px' }}>{extra}</div>}
      </div>
    </div>
  );
}

// ─── Componente Toggle Controllo ──────────────────────────────────────────────
function ControlToggle({ icon: Icon, iconOff: IconOff, title, value, onChange, disabled, color = 'var(--accent-green)' }) {
  const isOn = Boolean(value);
  return (
    <div style={{
      background: 'var(--card-bg)', border: `1px solid ${isOn ? color : 'var(--border-color)'}`,
      borderRadius: '20px', padding: '22px', display: 'flex',
      flexDirection: 'column', gap: '14px', transition: 'border-color 0.3s',
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '3px',
        background: isOn ? color : 'var(--border-color)', transition: 'background 0.3s'
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '12px',
          background: isOn ? `${color}22` : 'var(--bg-alt)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.3s'
        }}>
          {isOn ? <Icon size={22} color={color} /> : <IconOff size={22} color="var(--text-secondary)" />}
        </div>
        <button
          onClick={() => onChange(!isOn)}
          disabled={disabled}
          style={{
            width: '52px', height: '28px', borderRadius: '14px', border: 'none',
            background: isOn ? color : 'var(--bg-alt)', cursor: disabled ? 'not-allowed' : 'pointer',
            position: 'relative', transition: 'background 0.3s', flexShrink: 0
          }}
        >
          <div style={{
            width: '22px', height: '22px', borderRadius: '50%', background: 'white',
            position: 'absolute', top: '3px', left: isOn ? '27px' : '3px',
            transition: 'left 0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
          }} />
        </button>
      </div>
      <div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '2px', fontWeight: '500' }}>{title}</div>
        <div style={{ fontSize: '0.95rem', fontWeight: '700', color: isOn ? color : 'var(--text-secondary)' }}>
          {isOn ? 'Attivo' : 'Spento'}
        </div>
      </div>
    </div>
  );
}

// ─── Componente Indicatore Pulsante ───────────────────────────────────────────
function ButtonIndicator({ isPressed }) {
  return (
    <div style={{
      background: 'var(--card-bg)', border: `1px solid ${isPressed ? '#7c3aed' : 'var(--border-color)'}`,
      borderRadius: '20px', padding: '22px', display: 'flex',
      flexDirection: 'column', gap: '14px', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '3px',
        background: isPressed ? '#7c3aed' : 'var(--border-color)'
      }} />
      <div style={{
        width: '42px', height: '42px', borderRadius: '12px',
        background: isPressed ? '#f3e8ff' : 'var(--bg-alt)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Circle size={22} color={isPressed ? '#7c3aed' : 'var(--text-secondary)'} fill={isPressed ? '#7c3aed' : 'none'} />
      </div>
      <div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '2px', fontWeight: '500' }}>Pulsante Fisico</div>
        <div style={{ fontSize: '0.95rem', fontWeight: '700', color: isPressed ? '#7c3aed' : 'var(--text-secondary)' }}>
          {isPressed ? 'Premuto' : 'Rilasciato'}
        </div>
      </div>
    </div>
  );
}

// ─── PAGINA PRINCIPALE ────────────────────────────────────────────────────────
export default function GestioneDispositivo() {
  const router = useRouter();
  const params = useParams();
  const deviceId = params?.id;
  const supabase = createClient();

  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveData, setLiveData] = useState(null);
  const [pollingActive, setPollingActive] = useState(false);

  // Editing
  const [editingSettings, setEditingSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    name: '', humidity_threshold: 30, temperature_alert: 35,
    auto_water: true, latitude: '', longitude: '', city: '',
    sync_time: '', sync_date: ''
  });

  // Controls
  const [buzzer, setBuzzer] = useState(false);
  const [pump, setPump] = useState(false);
  const [monitorOn, setMonitorOn] = useState(false);
  const [buttonPressed, setButtonPressed] = useState(false);
  const [sendingCmd, setSendingCmd] = useState({});

  // IP del dispositivo (se disponibile)
  const [deviceIp, setDeviceIp] = useState(null);

  // ─── Caricamento dati dispositivo ─────────────────────────────────────────
  useEffect(() => {
    if (!deviceId) return;
    const load = async () => {
      const res = await fetch(`/api/devices/${deviceId}`);
      if (!res.ok) { router.push('/account/profilo'); return; }
      const data = await res.json();
      setDevice(data);
      setSettingsForm({
        name: data.name || '',
        humidity_threshold: data.settings?.humidity_threshold ?? 30,
        temperature_alert: data.settings?.temperature_alert ?? 35,
        auto_water: data.settings?.auto_water ?? true,
        latitude: data.settings?.latitude ?? '',
        longitude: data.settings?.longitude ?? '',
        city: data.settings?.city ?? '',
        sync_time: new Date().toTimeString().slice(0, 5),
        sync_date: new Date().toISOString().slice(0, 10),
      });
      setLoading(false);
    };
    load();
  }, [deviceId]);

  // ─── Polling live data (ogni 10s) ─────────────────────────────────────────
  const pollDevice = useCallback(async (ip) => {
    if (!ip) return;
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`http://${ip}/status`, { signal: ctrl.signal, mode: 'cors' });
      clearTimeout(tid);
      const data = await res.json();
      setLiveData(data);
      setBuzzer(data.buzzer ?? false);
      setPump(data.pump ?? false);
      setMonitorOn(data.monitor ?? false);
      setButtonPressed(data.button ?? false);
    } catch { /* dispositivo offline o non raggiungibile */ }
  }, []);

  useEffect(() => {
    if (!deviceIp) return;
    pollDevice(deviceIp);
    const interval = setInterval(() => pollDevice(deviceIp), 10000);
    setPollingActive(true);
    return () => { clearInterval(interval); setPollingActive(false); };
  }, [deviceIp, pollDevice]);

  // ─── Salvataggio impostazioni ──────────────────────────────────────────────
  const handleSaveSettings = async () => {
    setSaving(true);
    const res = await fetch(`/api/devices/${deviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsForm)
    });
    const result = await res.json();
    if (result.success) {
      setDevice(prev => ({ ...prev, name: settingsForm.name }));
      setEditingSettings(false);
      invalidateCache('devices');

      // Sync orario sul NodeMCU (se IP disponibile)
      if (deviceIp) {
        try {
          const [h, m] = settingsForm.sync_time.split(':');
          const d = new Date(settingsForm.sync_date);
          await fetch(`http://${deviceIp}/set-time?h=${h}&m=${m}&day=${d.getDay()}&date=${d.getDate()}&month=${d.getMonth()+1}&year=${d.getFullYear()}`, { mode: 'cors' });
        } catch { /* silent fail */ }

        // Sync posizione sul NodeMCU
        if (settingsForm.latitude && settingsForm.longitude) {
          try {
            await fetch(`http://${deviceIp}/set-location?lat=${settingsForm.latitude}&lon=${settingsForm.longitude}`, { mode: 'cors' });
          } catch { /* silent fail */ }
        }
      }
    } else {
      alert(result.error || 'Errore nel salvataggio.');
    }
    setSaving(false);
  };

  // ─── Controllo via API NodeMCU ─────────────────────────────────────────────
  const sendCommand = async (cmd, value) => {
    if (!deviceIp) return;
    setSendingCmd(p => ({ ...p, [cmd]: true }));
    try {
      await fetch(`http://${deviceIp}/${cmd}?value=${value ? 1 : 0}`, { mode: 'cors' });
      switch (cmd) {
        case 'buzzer': setBuzzer(value); break;
        case 'pump': setPump(value); break;
        case 'monitor': setMonitorOn(value); break;
      }
    } catch { /* silent fail — dispositivo offline */ }
    setSendingCmd(p => ({ ...p, [cmd]: false }));
  };

  // ─── Geolocalizzazione automatica ─────────────────────────────────────────
  const detectLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      setSettingsForm(f => ({
        ...f,
        latitude: pos.coords.latitude.toFixed(6),
        longitude: pos.coords.longitude.toFixed(6)
      }));
    });
  };

  // ─── Sync ora attuale ──────────────────────────────────────────────────────
  const syncNow = () => {
    const now = new Date();
    setSettingsForm(f => ({
      ...f,
      sync_time: now.toTimeString().slice(0, 5),
      sync_date: now.toISOString().slice(0, 10)
    }));
  };

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Loader2 size={40} style={{ animation: 'spin 1.5s linear infinite', marginBottom: '16px' }} />
        <div>Caricamento dispositivo...</div>
      </div>
    </main>
  );

  const isOnline = device?.device_status?.type === 'Active';
  const temp = liveData?.temperature ?? null;
  const hum = liveData?.humidity ?? null;

  // Calcola punteggio benessere
  const tempScore = temp !== null ? (temp >= 15 && temp <= 30 ? 100 : temp >= 10 && temp <= 35 ? 65 : 30) : null;
  const humScore = hum !== null ? (hum >= 40 && hum <= 70 ? 100 : hum >= 20 && hum <= 80 ? 65 : 30) : null;
  const wellnessScore = tempScore !== null && humScore !== null ? Math.round((tempScore + humScore) / 2) : null;

  const wellnessColor = wellnessScore === null ? 'var(--text-secondary)'
    : wellnessScore >= 80 ? 'var(--accent-green)'
    : wellnessScore >= 50 ? '#d97706'
    : '#e53e3e';

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-color)', paddingBottom: '80px' }}>
      
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="page-hero" style={{ paddingBottom: '30px' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          <Link href="/account/profilo" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            color: 'var(--text-secondary)', marginBottom: '24px', textDecoration: 'none',
            fontSize: '0.88rem', fontWeight: '600'
          }}>
            <ArrowLeft size={16} /> Torna al Profilo
          </Link>

          <FadeIn>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
              {/* Icona pianta */}
              <div style={{
                width: '80px', height: '80px', borderRadius: '24px',
                background: 'var(--accent-green-light)', border: '2px solid var(--accent-green)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, boxShadow: '0 8px 25px rgba(167,196,170,0.25)'
              }}>
                <Sprout size={40} color="var(--accent-green)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: '2rem', margin: 0 }}>{device?.name}</h1>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700',
                    background: isOnline ? 'var(--accent-green-light)' : 'var(--bg-alt)',
                    color: isOnline ? 'var(--accent-green)' : 'var(--text-secondary)'
                  }}>
                    {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                  {pollingActive && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--accent-green)' }}>
                      <Activity size={12} /> Live
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  {device?.product?.name || 'PLANT Smart Vase'} · MAC: <code style={{ fontSize: '0.8rem' }}>{device?.mac_address || 'N/D'}</code>
                </div>
              </div>
              {/* Input IP manuale per connessione live */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="IP dispositivo (live)"
                  defaultValue={deviceIp || ''}
                  onBlur={e => setDeviceIp(e.target.value.trim() || null)}
                  style={{
                    padding: '8px 14px', border: '1px solid var(--border-color)',
                    borderRadius: '10px', fontSize: '0.85rem', background: 'var(--input-bg)',
                    color: 'var(--text-primary)', width: '200px'
                  }}
                />
                <button
                  onClick={() => pollDevice(deviceIp)}
                  disabled={!deviceIp}
                  style={{
                    padding: '8px 12px', border: '1px solid var(--border-color)',
                    borderRadius: '10px', background: 'var(--card-bg)', cursor: 'pointer',
                    color: 'var(--text-secondary)', display: 'flex', alignItems: 'center'
                  }}
                  title="Aggiorna dati"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <div className="container" style={{ maxWidth: '900px' }}>

        {/* ── Card Benessere Pianta ───────────────────────────────────────── */}
        <FadeIn>
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-green-light) 0%, var(--card-bg) 100%)',
            border: '1px solid var(--accent-green)', borderRadius: '24px',
            padding: '30px', marginBottom: '28px',
            display: 'flex', alignItems: 'center', gap: '30px', flexWrap: 'wrap'
          }}>
            {/* Indicatore circolare */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-color)" strokeWidth="8"/>
                <circle cx="50" cy="50" r="42" fill="none" stroke={wellnessColor}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={wellnessScore !== null ? `${2 * Math.PI * 42 * (1 - wellnessScore / 100)}` : `${2 * Math.PI * 42}`}
                  transform="rotate(-90 50 50)"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
              </svg>
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)', textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: wellnessColor, lineHeight: 1 }}>
                  {wellnessScore !== null ? `${wellnessScore}` : '—'}
                </div>
                {wellnessScore !== null && <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>/ 100</div>}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                Benessere Pianta
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>
                {wellnessScore === null ? 'Dati non disponibili'
                  : wellnessScore >= 80 ? '🌱 Condizioni Ottimali'
                  : wellnessScore >= 50 ? '⚠️ Attenzione Richiesta'
                  : '🆘 Intervento Necessario'}
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
                {!deviceIp ? 'Inserisci l\'IP del dispositivo per monitorare i dati live.'
                  : wellnessScore === null ? 'Connessione al dispositivo in corso...'
                  : `Temperatura ${temp}°C · Umidità ${hum}% · Pollinga ogni 10s`}
              </p>
            </div>
          </div>
        </FadeIn>

        {/* ── Titolo Sensori ──────────────────────────────────────────────── */}
        <FadeIn>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={20} color="var(--accent-green)" />
            Monitoraggio Sensori
          </h2>
        </FadeIn>

        {/* ── Grid Sensori ────────────────────────────────────────────────── */}
        <FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            <SensorCard icon={Thermometer} title="Temperatura" value={temp} unit="°C" statusType="temp"
              extra={temp !== null ? `Soglia: ${device?.settings?.temperature_alert ?? 35}°C` : null} />
            <SensorCard icon={Droplets} title="Umidità" value={hum} unit="%" statusType="hum"
              extra={hum !== null ? `Soglia: ${device?.settings?.humidity_threshold ?? 30}%` : null} />
          </div>
        </FadeIn>

        {/* ── Titolo Controlli ────────────────────────────────────────────── */}
        <FadeIn>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Power size={20} color="var(--accent-green)" />
            Controlli Hardware
          </h2>
        </FadeIn>

        {/* ── Grid Controlli ──────────────────────────────────────────────── */}
        <FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '36px' }}>
            <ControlToggle icon={Bell} iconOff={BellOff} title="Buzzer" value={buzzer}
              onChange={(v) => sendCommand('buzzer', v)} disabled={!deviceIp || sendingCmd.buzzer}
              color="#d97706" />
            <ControlToggle icon={Power} iconOff={Power} title="Pompa Acqua" value={pump}
              onChange={(v) => sendCommand('pump', v)} disabled={!deviceIp || sendingCmd.pump}
              color="#3b82f6" />
            <ControlToggle icon={Monitor} iconOff={Monitor} title="Monitor TFT" value={monitorOn}
              onChange={(v) => sendCommand('monitor', v)} disabled={!deviceIp || sendingCmd.monitor}
              color="#7c3aed" />
            <ButtonIndicator isPressed={buttonPressed} />
          </div>
        </FadeIn>

        {/* ── Impostazioni ────────────────────────────────────────────────── */}
        <FadeIn>
          <div className="account-card" style={{ borderRadius: '24px', marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Edit3 size={20} color="var(--accent-green)" />
                Impostazioni
              </h2>
              {!editingSettings ? (
                <button onClick={() => setEditingSettings(true)} className="btn btn-secondary"
                  style={{ padding: '8px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Edit3 size={15} /> Modifica
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleSaveSettings} disabled={saving} className="btn btn-primary"
                    style={{ padding: '8px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {saving ? <Loader2 size={15} style={{ animation: 'spin 1.5s linear infinite' }} /> : <Save size={15} />}
                    {saving ? 'Salvo...' : 'Salva'}
                  </button>
                  <button onClick={() => setEditingSettings(false)}
                    style={{ padding: '8px 18px', fontSize: '0.85rem', border: '1px solid var(--border-color)', borderRadius: '30px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                    <X size={15} /> Annulla
                  </button>
                </div>
              )}
            </div>

            {!editingSettings ? (
              /* Visualizzazione */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                {[
                  { label: 'Nome Dispositivo', value: device?.name },
                  { label: 'Soglia Umidità', value: `${device?.settings?.humidity_threshold ?? 30}%` },
                  { label: 'Allerta Temperatura', value: `${device?.settings?.temperature_alert ?? 35}°C` },
                  { label: 'Irrigazione Auto', value: device?.settings?.auto_water ? 'Attiva' : 'Disattiva' },
                  { label: 'Città / Posizione', value: device?.settings?.city || '—' },
                  { label: 'Coordinate', value: device?.settings?.latitude ? `${device?.settings?.latitude}, ${device?.settings?.longitude}` : '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{value}</div>
                  </div>
                ))}
              </div>
            ) : (
              /* Form di modifica */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '18px' }}>

                {/* Nome */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Nome dispositivo</label>
                  <input type="text" value={settingsForm.name}
                    onChange={e => setSettingsForm(f => ({ ...f, name: e.target.value }))}
                    style={inputStyle} placeholder="Es: Vaso Balcone" />
                </div>

                {/* Soglie sensori */}
                <div>
                  <label style={labelStyle}>Soglia Umidità (%)</label>
                  <input type="number" min="0" max="100" value={settingsForm.humidity_threshold}
                    onChange={e => setSettingsForm(f => ({ ...f, humidity_threshold: e.target.value }))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Allerta Temperatura (°C)</label>
                  <input type="number" min="-20" max="60" value={settingsForm.temperature_alert}
                    onChange={e => setSettingsForm(f => ({ ...f, temperature_alert: e.target.value }))}
                    style={inputStyle} />
                </div>

                {/* Irrigazione auto */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-alt)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={labelStyle}>Irrigazione Automatica</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Attiva la pompa in base all'umidità</div>
                  </div>
                  <button onClick={() => setSettingsForm(f => ({ ...f, auto_water: !f.auto_water }))}
                    style={{
                      width: '52px', height: '28px', borderRadius: '14px', border: 'none', flexShrink: 0,
                      background: settingsForm.auto_water ? 'var(--accent-green)' : 'var(--bg-alt)', cursor: 'pointer',
                      position: 'relative', transition: 'background 0.3s',
                    }}>
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%', background: 'white',
                      position: 'absolute', top: '3px', left: settingsForm.auto_water ? '27px' : '3px',
                      transition: 'left 0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                    }} />
                  </button>
                </div>

                {/* ─── Sincronizzazione Orario ─────────────────────────── */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <label style={{ ...labelStyle, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={16} color="var(--accent-green)" /> Sincronizzazione Orario
                    </label>
                    <button onClick={syncNow} type="button" style={{
                      padding: '5px 12px', border: '1px solid var(--border-color)',
                      borderRadius: '8px', background: 'var(--bg-alt)', cursor: 'pointer',
                      fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px'
                    }}>
                      <RefreshCw size={12} /> Usa ora attuale
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Ora (HH:MM)</label>
                      <input type="time" value={settingsForm.sync_time}
                        onChange={e => setSettingsForm(f => ({ ...f, sync_time: e.target.value }))}
                        style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Data</label>
                      <input type="date" value={settingsForm.sync_date}
                        onChange={e => setSettingsForm(f => ({ ...f, sync_date: e.target.value }))}
                        className="date-picker-styled" style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {settingsForm.sync_date && (() => {
                      const d = new Date(settingsForm.sync_date);
                      const giorni = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
                      const mesi = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
                      return `${giorni[d.getDay()]} ${d.getDate()} ${mesi[d.getMonth()]} ${d.getFullYear()} · Ora: ${settingsForm.sync_time}`;
                    })()}
                  </div>
                </div>

                {/* ─── Posizione Geografica ────────────────────────────── */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <label style={{ ...labelStyle, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={16} color="var(--accent-green)" /> Posizione Geografica
                    </label>
                    <button onClick={detectLocation} type="button" style={{
                      padding: '5px 12px', border: '1px solid var(--border-color)',
                      borderRadius: '8px', background: 'var(--bg-alt)', cursor: 'pointer',
                      fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px'
                    }}>
                      <Navigation size={12} /> Rileva Automaticamente
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Latitudine</label>
                      <input type="number" step="0.000001" placeholder="Es: 45.4654" value={settingsForm.latitude}
                        onChange={e => setSettingsForm(f => ({ ...f, latitude: e.target.value }))}
                        style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Longitudine</label>
                      <input type="number" step="0.000001" placeholder="Es: 9.1859" value={settingsForm.longitude}
                        onChange={e => setSettingsForm(f => ({ ...f, longitude: e.target.value }))}
                        style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Città</label>
                      <input type="text" placeholder="Es: Milano" value={settingsForm.city}
                        onChange={e => setSettingsForm(f => ({ ...f, city: e.target.value }))}
                        style={inputStyle} />
                    </div>
                  </div>
                  {settingsForm.latitude && settingsForm.longitude && (
                    <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      📍 {settingsForm.city || 'Posizione rilevata'}: {settingsForm.latitude}°N, {settingsForm.longitude}°E
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </FadeIn>

      </div>

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
}

// Stili label e input condivisi
const labelStyle = {
  display: 'block', fontSize: '0.78rem', fontWeight: '700',
  color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em'
};
const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)',
  borderRadius: '10px', fontSize: '0.95rem', background: 'var(--input-bg)',
  color: 'var(--text-primary)', fontFamily: 'inherit'
};
