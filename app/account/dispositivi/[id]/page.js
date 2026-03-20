'use client';

import { createClient } from '@/utils/supabase/client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Sprout, Wifi, WifiOff, Thermometer, Droplets,
  Bell, BellOff, Power, Monitor, Circle, Save, Edit3, X,
  MapPin, Clock, RefreshCw, AlertTriangle, CheckCircle2, Activity,
  Navigation, Loader2, Beaker, Volume2, VolumeX, Timer, Zap,
  CloudSun, Newspaper, Globe
} from 'lucide-react';
import Link from 'next/link';
import FadeIn from '@/components/FadeIn';
import { invalidateCache } from '@/hooks/useCache';

// ─── Helper: stato sensore → colore ───────────────────────────────────────────
function getSensorStatus(value, type, thresholds = {}) {
  if (value === null || value === undefined) return 'unknown';
  if (type === 'temp') {
    const limit = thresholds.temp || 35;
    return value < 10 ? 'cold' : value > limit ? 'hot' : 'ok';
  }
  if (type === 'hum') {
    const limit = thresholds.hum || 20;
    return value < limit ? 'dry' : value > 80 ? 'wet' : 'ok';
  }
  if (type === 'ph') return value < 6.0 ? 'acid' : value > 8.0 ? 'basic' : 'ok';
  return 'ok';
}

// Normalizza input "IP dispositivo" per evitare URL invalidi:
// - rimuove eventuale prefisso "http://"
// - rimuove slash finali
function normalizeDeviceIp(rawIp) {
  if (rawIp === null || rawIp === undefined) return '';
  const value = String(rawIp).trim();
  if (!value) return '';
  return value
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/g, '');
}

const STATUS_COLORS = {
  ok: { bg: 'var(--accent-green-light)', color: 'var(--accent-green)', label: 'Ottimale' },
  hot: { bg: '#fff0f0', color: '#e53e3e', label: 'Troppo Caldo' },
  cold: { bg: '#ebf8ff', color: '#3182ce', label: 'Troppo Freddo' },
  dry: { bg: '#fffaf0', color: '#dd6b20', label: 'Secco' },
  wet: { bg: '#ebf8ff', color: '#3182ce', label: 'Umido' },
  acid: { bg: '#fff0f0', color: '#e53e3e', label: 'Troppo Acido' },
  basic: { bg: '#ebf8ff', color: '#3182ce', label: 'Troppo Basico' },
  unknown: { bg: 'var(--bg-alt)', color: 'var(--text-secondary)', label: 'N/D' },
};

// ─── Componente Card Sensore ──────────────────────────────────────────────────
function SensorCard({ icon: Icon, title, value, unit, statusType, thresholds, extra }) {
  const st = getSensorStatus(value, statusType, thresholds);
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
function ControlToggle({ icon: Icon, iconOff: IconOff, title, value, onChange, disabled, color = 'var(--accent-green)', subtitle }) {
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
          {subtitle || (isOn ? 'Attivo' : 'Spento')}
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

// ─── Componente Pompa Irriga ──────────────────────────────────────────────────
function PumpIrrigateCard({ deviceId, deviceIp, pumpDuration, disabled }) {
  const [irrigating, setIrrigating] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

  const startIrrigation = async () => {
    if (!deviceIp || irrigating) return;
    setIrrigating(true);
    setCountdown(pumpDuration);

    try {
      // Accendi pompa
      const params = new URLSearchParams({ target: 'pump', on: 'true', speed: '80' });
      await fetch(`http://${deviceIp}/api/set?${params}`, { mode: 'cors' });

      // Incrementa water_use nel database per la statistica Acqua Risparmiata (100ml = 0.1)
      fetch(`/api/devices/${deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ increment_water: 0.1 })
      }).catch(() => {});
    } catch { /* silent */ }

    // Countdown
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          // Spegni pompa
          const params = new URLSearchParams({ target: 'pump', on: 'false' });
          fetch(`http://${deviceIp}/api/set?${params}`, { mode: 'cors' }).catch(() => {});
          setIrrigating(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Cleanup
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const progress = irrigating ? ((pumpDuration - countdown) / pumpDuration) * 100 : 0;

  return (
    <div style={{
      background: 'var(--card-bg)', border: `1px solid ${irrigating ? '#3b82f6' : 'var(--border-color)'}`,
      borderRadius: '20px', padding: '22px', display: 'flex',
      flexDirection: 'column', gap: '14px', position: 'relative', overflow: 'hidden',
      transition: 'border-color 0.3s'
    }}>
      {/* Barra di progresso */}
      <div style={{
        position: 'absolute', top: 0, left: 0, height: '3px',
        width: irrigating ? `${progress}%` : '0%',
        background: '#3b82f6', transition: 'width 1s linear'
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '12px',
          background: irrigating ? '#dbeafe' : 'var(--bg-alt)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.3s'
        }}>
          <Droplets size={22} color={irrigating ? '#3b82f6' : 'var(--text-secondary)'} />
        </div>
        <button
          onClick={startIrrigation}
          disabled={disabled || irrigating}
          style={{
            padding: '8px 18px', borderRadius: '12px', border: 'none',
            background: irrigating ? '#93c5fd' : '#3b82f6',
            color: 'white', fontWeight: '700', fontSize: '0.85rem',
            cursor: (disabled || irrigating) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
            transition: 'background 0.3s', opacity: disabled ? 0.5 : 1
          }}
        >
          {irrigating ? (
            <><Timer size={15} /> {countdown}s</>
          ) : (
            <><Zap size={15} /> IRRIGA</>
          )}
        </button>
      </div>
      <div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '2px', fontWeight: '500' }}>Pompa Acqua</div>
        <div style={{ fontSize: '0.95rem', fontWeight: '700', color: irrigating ? '#3b82f6' : 'var(--text-secondary)' }}>
          {irrigating ? `Irrigazione in corso... ${countdown}s` : `Durata: ${pumpDuration}s`}
        </div>
      </div>
    </div>
  );
}

// ─── Calcolo Benessere Pianta ─────────────────────────────────────────────────
function calcolaBenessere(temp, hum, ph) {
  // Pesi: temperatura 35%, umidità 35%, pH 30%
  let tempScore = null, humScore = null, phScore = null;

  if (temp !== null) {
    if (temp >= 18 && temp <= 28) tempScore = 100;
    else if (temp >= 15 && temp <= 30) tempScore = 80;
    else if (temp >= 10 && temp <= 35) tempScore = 55;
    else if (temp >= 5 && temp <= 40) tempScore = 30;
    else tempScore = 10;
  }

  if (hum !== null) {
    if (hum >= 40 && hum <= 65) humScore = 100;
    else if (hum >= 30 && hum <= 75) humScore = 80;
    else if (hum >= 20 && hum <= 85) humScore = 55;
    else humScore = 25;
  }

  if (ph !== null) {
    if (ph >= 6.0 && ph <= 7.5) phScore = 100;
    else if (ph >= 5.5 && ph <= 8.0) phScore = 75;
    else if (ph >= 5.0 && ph <= 8.5) phScore = 45;
    else phScore = 15;
  }

  const scores = [];
  const weights = [];
  if (tempScore !== null) { scores.push(tempScore); weights.push(0.35); }
  if (humScore !== null)  { scores.push(humScore);  weights.push(0.35); }
  if (phScore !== null)   { scores.push(phScore);   weights.push(0.30); }

  if (scores.length === 0) return null;

  // Normalizza pesi
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let weighted = 0;
  for (let i = 0; i < scores.length; i++) {
    weighted += scores[i] * (weights[i] / totalWeight);
  }
  return Math.round(weighted);
}

function getWellnessLabel(score) {
  if (score === null) return { emoji: '', text: 'Dati non disponibili' };
  if (score >= 85) return { emoji: '🌱', text: 'Condizioni Ottimali' };
  if (score >= 70) return { emoji: '☀️', text: 'Buone Condizioni' };
  if (score >= 50) return { emoji: '⚠️', text: 'Attenzione Richiesta' };
  if (score >= 30) return { emoji: '🔶', text: 'Condizioni Critiche' };
  return { emoji: '🆘', text: 'Intervento Urgente' };
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
  const [liveOnline, setLiveOnline] = useState(false);

  // Editing
  const [editingSettings, setEditingSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    name: '', humidity_threshold: 30, temperature_alert: 35,
    auto_water: true, latitude: '', longitude: '', city: '',
    sync_time: '', sync_date: '',
    pump_duration: 10, buzzer_alarms_enabled: true,
    meteo_key: '', news_key: '', spotify_creds: '', spotify_refresh: ''
  });

  // Controls
  const [buzzer, setBuzzer] = useState(false);
  const [monitorOn, setMonitorOn] = useState(false);
  const [buttonPressed, setButtonPressed] = useState(false);
  const [sendingCmd, setSendingCmd] = useState({});

  // IP del dispositivo — persistente
  const [deviceIp, setDeviceIp] = useState('');
  const [ipInput, setIpInput] = useState('');

  // ─── Caricamento dati dispositivo ─────────────────────────────────────────
  useEffect(() => {
    if (!deviceId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/devices/${deviceId}`);
        if (!res.ok) { router.push('/account/profilo'); return; }
        const data = await res.json();
        setDevice(data);

        // Usa l'IP del DB, oppure fallback su localStorage se presente
        const localIp = typeof window !== 'undefined' ? localStorage.getItem(`plant_device_ip_${deviceId}`) : null;
        const savedIpRaw = data.settings?.last_ip || localIp || '';
        const savedIp = normalizeDeviceIp(savedIpRaw);
        setDeviceIp(savedIp);
        setIpInput(savedIp);

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
          pump_duration: data.settings?.pump_duration ?? 10,
          buzzer_alarms_enabled: data.settings?.buzzer_alarms_enabled ?? true,
          meteo_key: '', news_key: '', spotify_creds: '', spotify_refresh: ''
        });
      } catch (err) {
        console.error('Errore caricamento dispositivo:', err);
        router.push('/account/profilo');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [deviceId]);

  const connectIp = useCallback(async (ip) => {
    const cleanIp = normalizeDeviceIp(ip);
    if (!cleanIp) { 
      setDeviceIp(''); 
      setLiveOnline(false); 
      if (typeof window !== 'undefined') localStorage.removeItem(`plant_device_ip_${deviceId}`);
      return; 
    }
    setDeviceIp(cleanIp);
    if (typeof window !== 'undefined') localStorage.setItem(`plant_device_ip_${deviceId}`, cleanIp);

    // Salva IP nel DB
    try {
      await fetch(`/api/devices/${deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_ip: cleanIp })
      });
    } catch { /* silent */ }
  }, [deviceId]);

  // ─── Polling live data (ogni 3s) ──────────────────────────────────────────
  const pollDevice = useCallback(async (ip) => {
    const normalizedIp = normalizeDeviceIp(ip);
    if (!normalizedIp) return;
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 4000);
      const url = `http://${normalizedIp}/api/data`;
      const res = await fetch(url, {
        signal: ctrl.signal,
        mode: 'cors',
        cache: 'no-store'
      });
      clearTimeout(tid);
      if (!res.ok) {
        throw new Error(`Device responded with status ${res.status}`);
      }
      const data = await res.json();
      setLiveData(data);
      setLiveOnline(true);
      
      // 1. Quando trovo un plant (risponde correttamente), salva il suo IP se diverso
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(`plant_device_ip_${deviceId}`);
        if (saved !== normalizedIp) {
          localStorage.setItem(`plant_device_ip_${deviceId}`, normalizedIp);
          // Salva anche nel DB admin
          fetch(`/api/devices/${deviceId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ last_ip: normalizedIp })
          }).catch(() => {});
        }
      }

      setBuzzer(data?.buzzer?.on ?? false);
      setMonitorOn(data?.monitor?.on ?? false);
      setButtonPressed(data?.button?.pressed ?? false);
    } catch (err) {
      if (err?.name === 'AbortError') {
        setLiveOnline(false);
        return;
      }
      console.warn('Fetch error from NodeMCU:', err);
      setLiveOnline(false);
    }
  }, [deviceId]);

  useEffect(() => {
    if (!deviceIp) { setPollingActive(false); setLiveOnline(false); return; }
    
    // Fetch settings live dal dispositivo
    const fetchLiveSettings = async () => {
      try {
        const res = await fetch(`http://${deviceIp}/api/settings`, { mode: 'cors' });
        if (res.ok) {
          const s = await res.json();
          setSettingsForm(prev => ({
            ...prev,
            name: s.device_name || prev.name,
            meteo_key: s.meteo_key || '',
            news_key: s.news_key || '',
            city: s.city || prev.city,
            spotify_creds: s.spotify_creds || '',
            spotify_refresh: s.spotify_refresh || '',
            sh_url: s.sh_url || '',
            sh_key: s.sh_key || ''
          }));
        }
      } catch (err) { console.warn('Impossibile recuperare impostazioni live'); }
    };
    
    fetchLiveSettings();
    pollDevice(deviceIp);
    const interval = setInterval(() => pollDevice(deviceIp), 3000);
    setPollingActive(true);
    return () => { clearInterval(interval); setPollingActive(false); };
  }, [deviceIp, pollDevice]);

  // ─── Salvataggio impostazioni ──────────────────────────────────────────────
  const handleSaveSettings = async () => {
    setSaving(true);
    try {
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

        if (deviceIp) {
          // Sync datetime
          try {
            const [h, m] = settingsForm.sync_time.split(':');
            const d = new Date(settingsForm.sync_date);
            const giorni = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
            const weekday = giorni[d.getDay()];
            const dtParams = new URLSearchParams({
              target: 'datetime',
              year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(),
              hour: h, minute: m, second: 0, weekday
            });
            await fetch(`http://${deviceIp}/api/set?${dtParams}`, { mode: 'cors' });
          } catch { /* silent */ }

          // Sync geo
          if (settingsForm.latitude && settingsForm.longitude) {
            try {
              const geoParams = new URLSearchParams({
                target: 'geo',
                lat: settingsForm.latitude,
                lon: settingsForm.longitude,
                city: settingsForm.city || ''
              });
              await fetch(`http://${deviceIp}/api/set?${geoParams}`, { mode: 'cors' });
            } catch { /* silent */ }
          }
          
          // Sync settings hardware & API
          try {
            const body = new URLSearchParams({
              name: settingsForm.name,
              meteo_key: settingsForm.meteo_key,
              news_key: settingsForm.news_key,
              city: settingsForm.city,
              spotify_refresh: settingsForm.spotify_refresh,
              spotify_creds: settingsForm.spotify_creds,
              sh_url: settingsForm.sh_url || '',
              sh_key: settingsForm.sh_key || '',
              buzzer_alarms: settingsForm.buzzer_alarms_enabled
            });

            const sRes = await fetch(`http://${deviceIp}/api/settings`, { 
              method: 'POST', 
              mode: 'cors',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: body.toString()
            });
            
            if (!sRes.ok) {
              const errData = await sRes.json();
              alert(`Errore hardware: ${errData.msg || 'Impossibile salvare sul dispositivo'}`);
            }
          } catch (err) { 
            console.warn('Avviso sync hardware (il dispositivo si è probabilmente riavviato):', err.message); 
          }
        }
      } else {
        alert(result.error || 'Errore nel salvataggio.');
      }
    } catch (err) {
      alert('Errore di rete nel salvataggio.');
    }
    setSaving(false);
  };

  // ─── Eliminazione Dispositivo ──────────────────────────────────────────────
  const handleDeleteDevice = async () => {
    if (!confirm('Sei sicuro di voler rimuovere questo dispositivo? L\'azione è irreversibile.')) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/devices/${deviceId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        invalidateCache('devices');
        router.push('/account/profilo');
      } else {
        alert(result.error || 'Errore durante la rimozione.');
        setIsDeleting(false);
      }
    } catch {
      alert('Errore di rete durante la rimozione.');
      setIsDeleting(false);
    }
  };
  
  // ─── Test API NodeMCU ──────────────────────────────────────────────────────
  const [testingApi, setTestingApi] = useState(false);
  const handleTestApi = async () => {
    if (!deviceIp) return;
    setTestingApi(true);
    try {
      const body = new URLSearchParams({
        test_only: 'true',
        meteo_key: settingsForm.meteo_key,
        news_key: settingsForm.news_key,
        city: settingsForm.city
      });
      const res = await fetch(`http://${deviceIp}/api/settings`, { 
        method: 'POST', mode: 'cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      const data = await res.json();
      alert(data.msg || (data.ok ? 'Test superato!' : 'Errore nel test.'));
    } catch { alert('Impossibile contattare il dispositivo hardware.'); }
    setTestingApi(false);
  };

  // ─── Controllo via API NodeMCU ─────────────────────────────────────────────
  const sendCommand = async (cmd, value) => {
    if (!deviceIp) return;
    setSendingCmd(p => ({ ...p, [cmd]: true }));
    try {
      const params = cmd === 'pump'
        ? new URLSearchParams({ target: cmd, on: value, speed: 80 })
        : new URLSearchParams({ target: cmd, value });
      await fetch(`http://${deviceIp}/api/set?${params}`, { mode: 'cors' });
      switch (cmd) {
        case 'buzzer': setBuzzer(value); break;
        case 'monitor': setMonitorOn(value); break;
      }
    } catch { /* silent */ }
    setSendingCmd(p => ({ ...p, [cmd]: false }));
  };

  // ─── Geolocalizzazione automatica ─────────────────────────────────────────
  const detectLocation = async () => {
    try {
      // 1. Tenta API IP: aggira i blocchi HTTPS del browser e ricava la città
      const res = await fetch('http://ip-api.com/json/');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          setSettingsForm(f => ({
            ...f,
            latitude: data.lat.toFixed(6),
            longitude: data.lon.toFixed(6),
            city: data.city || f.city
          }));
          return;
        }
      }
    } catch { /* proceed to fallback */ }

    // 2. Fallback: Geolocalizzazione Browser
    if (!navigator.geolocation) {
      alert("Geolocalizzazione non supportata o bloccata dal browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setSettingsForm(f => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6)
        }));
      },
      err => alert("Errore nel rilevamento: " + err.message)
    );
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

  // ─── Dati live ─────────────────────────────────────────────────────────────
  const isOnline = liveOnline && liveData !== null;
  const tempRaw = liveData?.temperature?.value ?? null;
  const humRaw = liveData?.humidity?.value ?? null;
  const phRaw = liveData?.ph?.value ?? null;
  const temp = tempRaw !== null ? parseFloat(tempRaw) : null;
  const hum = humRaw !== null ? parseFloat(humRaw) : null;
  const ph = phRaw !== null ? parseFloat(phRaw) : null;
  const pumpSpeed = liveData?.pump?.speed ?? null;
  const pumpLastOn = liveData?.pump?.last_on ?? null;
  const dataAge = liveData?.network?.data_age ?? null;
  const megaOnline = liveData?.network?.mega_online ?? null;
  const dhtOnline = liveData?.temperature?.online ?? true;

  // Calcola punteggio benessere (reale con pH)
  const wellnessScore = calcolaBenessere(temp, hum, ph);
  const wellnessLabel = getWellnessLabel(wellnessScore);
  const thresholds = { temp: settingsForm.temperature_alert, hum: settingsForm.humidity_threshold };
  const wellnessColor = wellnessScore === null ? 'var(--text-secondary)'
    : wellnessScore >= 80 ? 'var(--accent-green)'
    : wellnessScore >= 50 ? '#d97706'
    : '#e53e3e';

  const pumpDuration = device?.settings?.pump_duration ?? settingsForm.pump_duration ?? 10;

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
                background: isOnline ? 'var(--accent-green-light)' : 'var(--bg-alt)',
                border: `2px solid ${isOnline ? 'var(--accent-green)' : 'var(--border-color)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, boxShadow: isOnline ? '0 8px 25px rgba(167,196,170,0.25)' : 'none',
                transition: 'all 0.3s'
              }}>
                <Sprout size={40} color={isOnline ? 'var(--accent-green)' : 'var(--text-secondary)'} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: '2rem', margin: 0 }}>{device?.name}</h1>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700',
                    background: isOnline ? 'var(--accent-green-light)' : 'var(--bg-alt)',
                    color: isOnline ? 'var(--accent-green)' : 'var(--text-secondary)',
                    transition: 'all 0.3s'
                  }}>
                    {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                    {isOnline ? 'Online' : (deviceIp ? 'Offline' : 'Non connesso')}
                  </span>
                  {pollingActive && isOnline && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--accent-green)' }}>
                      <Activity size={12} /> Live
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  {device?.product?.name || 'PLANT Smart Vase'} · MAC: <code style={{ fontSize: '0.8rem' }}>{device?.mac_address || 'N/D'}</code>
                </div>
              </div>
              {/* Input IP con connessione */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="IP dispositivo (live)"
                  value={ipInput}
                  onChange={e => setIpInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') connectIp(ipInput); }}
                  style={{
                    padding: '8px 14px', border: `1px solid ${isOnline ? 'var(--accent-green)' : 'var(--border-color)'}`,
                    borderRadius: '10px', fontSize: '0.85rem', background: 'var(--input-bg)',
                    color: 'var(--text-primary)', width: '200px', transition: 'border-color 0.3s'
                  }}
                />
                <button
                  onClick={() => connectIp(ipInput)}
                  style={{
                    padding: '8px 12px', border: '1px solid var(--border-color)',
                    borderRadius: '10px', background: 'var(--card-bg)', cursor: 'pointer',
                    color: 'var(--text-secondary)', display: 'flex', alignItems: 'center'
                  }}
                  title="Connetti / Aggiorna"
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
            background: `linear-gradient(135deg, ${isOnline ? 'var(--accent-green-light)' : 'var(--bg-alt)'} 0%, var(--card-bg) 100%)`,
            border: `1px solid ${isOnline ? 'var(--accent-green)' : 'var(--border-color)'}`,
            borderRadius: '24px', padding: '30px', marginBottom: '28px',
            display: 'flex', alignItems: 'center', gap: '30px', flexWrap: 'wrap',
            transition: 'all 0.3s'
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
                {wellnessLabel.emoji} {wellnessLabel.text}
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 8px' }}>
                {!deviceIp ? 'Inserisci l\'IP del dispositivo per monitorare i dati live.'
                  : !isOnline ? 'Dispositivo non raggiungibile. Verifica l\'IP e la connessione.'
                  : wellnessScore === null ? 'In attesa dei dati dai sensori...'
                  : `Temp. ${temp}°C · Umidità ${hum}% · pH ${ph ?? '—'} · Aggiornamento ogni 3s`}
              </p>
              {liveData && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {!dhtOnline && (
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', padding: '3px 8px', borderRadius: '10px', background: '#fef2f2', color: '#e53e3e' }}>
                      ⚠ DHT11 Offline
                    </span>
                  )}
                  {liveData.temperature?.status === 'ALLERTA' && (
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', padding: '3px 8px', borderRadius: '10px', background: '#fef2f2', color: '#e53e3e' }}>
                      ⚠ Allerta Temperatura
                    </span>
                  )}
                  {liveData.ph?.status !== 'OK' && liveData.ph?.status && (
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', padding: '3px 8px', borderRadius: '10px', background: '#fef2f2', color: '#e53e3e' }}>
                      ⚠ pH {liveData.ph.status}
                    </span>
                  )}
                  {megaOnline === false && (
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', padding: '3px 8px', borderRadius: '10px', background: '#fef2f2', color: '#e53e3e' }}>
                      ⚠ Mega Offline
                    </span>
                  )}
                  {pumpLastOn && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '10px', background: 'var(--bg-alt)' }}>
                      💧 Pompa: {pumpLastOn}
                    </span>
                  )}
                  {liveData.network?.ssid && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '10px', background: 'var(--bg-alt)' }}>
                      📶 {liveData.network.ssid} ({liveData.network.rssi} dBm)
                    </span>
                  )}
                </div>
              )}
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
              thresholds={thresholds}
              extra={temp !== null ? `Soglia: ${settingsForm.temperature_alert}°C` : null} />
            <SensorCard icon={Droplets} title="Umidità" value={hum} unit="%" statusType="hum"
              thresholds={thresholds}
              extra={hum !== null ? `Soglia: ${settingsForm.humidity_threshold}%` : null} />
            <SensorCard icon={Beaker} title="Livello pH" value={ph} unit="" statusType="ph"
              extra={ph !== null ? `Range ottimale: 6.0 - 7.5` : null} />
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
            <PumpIrrigateCard deviceId={deviceId} deviceIp={deviceIp} pumpDuration={pumpDuration} disabled={!deviceIp || !isOnline} />
            <ControlToggle icon={Bell} iconOff={BellOff} title="Buzzer" value={buzzer}
              onChange={(v) => sendCommand('buzzer', v)} disabled={!deviceIp || sendingCmd.buzzer || !isOnline}
              color="#d97706" />
            <ControlToggle icon={Monitor} iconOff={Monitor} title="Monitor TFT" value={monitorOn}
              onChange={(v) => sendCommand('monitor', v)} disabled={!deviceIp || sendingCmd.monitor || !isOnline}
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
                  { label: 'Irrigazione Auto', value: device?.settings?.auto_water !== false ? 'Attiva' : 'Disattiva' },
                  { label: 'Allarmi Sonori', value: device?.settings?.buzzer_alarms_enabled !== false ? 'Attivi' : 'Disattivati' },
                  { label: 'Città / Posizione', value: liveData?.geo?.city || settingsForm.city || device?.settings?.city || '—' },
                  { label: 'Coordinate', value: (liveData?.geo?.lat && liveData?.geo?.lon && liveData.geo.lat !== '0.000000') ? `${liveData.geo.lat}, ${liveData.geo.lon}` : (settingsForm.latitude ? `${settingsForm.latitude}, ${settingsForm.longitude}` : (device?.settings?.latitude ? `${device?.settings?.latitude}, ${device?.settings?.longitude}` : '—')) },
                  { label: 'Spotify', value: settingsForm.spotify_refresh ? 'Configurato' : 'Non configurato' },
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

                {/* Irrigazione auto */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-alt)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={labelStyle}>Irrigazione Automatica</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Attiva la pompa in base all'umidità</div>
                  </div>
                  <button onClick={() => setSettingsForm(f => ({ ...f, auto_water: !f.auto_water }))}
                    style={{
                      width: '52px', height: '28px', borderRadius: '14px', border: 'none', flexShrink: 0,
                      background: settingsForm.auto_water ? 'var(--accent-green)' : '#cbd5e1', cursor: 'pointer',
                      position: 'relative', transition: 'background 0.3s',
                    }}>
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%', background: 'white',
                      position: 'absolute', top: '3px', left: settingsForm.auto_water ? '27px' : '3px',
                      transition: 'left 0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                    }} />
                  </button>
                </div>

                {/* Allarmi sonori */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-alt)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={labelStyle}>Allarmi Sonori (Buzzer)</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Suoni di allerta per sensori</div>
                  </div>
                  <button onClick={() => setSettingsForm(f => ({ ...f, buzzer_alarms_enabled: !f.buzzer_alarms_enabled }))}
                    style={{
                      width: '52px', height: '28px', borderRadius: '14px', border: 'none', flexShrink: 0,
                      background: settingsForm.buzzer_alarms_enabled ? '#d97706' : '#cbd5e1', cursor: 'pointer',
                      position: 'relative', transition: 'background 0.3s',
                    }}>
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%', background: 'white',
                      position: 'absolute', top: '3px', left: settingsForm.buzzer_alarms_enabled ? '27px' : '3px',
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

                {/* ─── Configurazione API ──────────────────────────────── */}
                <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <label style={{ ...labelStyle, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      <Zap size={16} color="var(--accent-green)" /> Configurazione API Esterne
                    </label>
                    <button onClick={handleTestApi} disabled={testingApi} 
                      style={{ fontSize: '0.75rem', color: 'var(--accent-green)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: '700', textDecoration: 'underline' }}>
                      {testingApi ? 'Verifica in corso...' : 'TESTA CONNESSIONI'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                    <div>
                      <label style={labelStyle}>OpenWeather API Key</label>
                      <input type="password" value={settingsForm.meteo_key}
                        onChange={e => setSettingsForm(f => ({ ...f, meteo_key: e.target.value }))}
                        style={inputStyle} placeholder="Chiave Meteo" />
                    </div>
                    <div>
                      <label style={labelStyle}>NewsAPI.org Key</label>
                      <input type="password" value={settingsForm.news_key}
                        onChange={e => setSettingsForm(f => ({ ...f, news_key: e.target.value }))}
                        style={inputStyle} placeholder="Chiave News" />
                    </div>
                    <div>
                      <label style={labelStyle}>Spotify Refresh Token</label>
                      <input type="password" value={settingsForm.spotify_refresh}
                        onChange={e => setSettingsForm(f => ({ ...f, spotify_refresh: e.target.value }))}
                        style={inputStyle} placeholder="Refresh Token" />
                    </div>
                    <div>
                      <label style={labelStyle}>Spotify Credentials (B64)</label>
                      <input type="password" value={settingsForm.spotify_creds}
                        onChange={e => setSettingsForm(f => ({ ...f, spotify_creds: e.target.value }))}
                        style={inputStyle} placeholder="Client ID:Secret Base64" />
                    </div>
                  </div>
                </div>

              </div>
            )}
            
            {/* ─── Zona Pericolo (Elimina) ─────────────────────────── */}
            {editingSettings && (
              <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1rem', color: '#e53e3e', marginBottom: '8px' }}>Zona Pericolo</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                  Rimuovendo questo dispositivo perderai tutti i dati associati e non sarà più gestibile dal tuo account.
                </p>
                <button
                  onClick={handleDeleteDevice}
                  disabled={isDeleting}
                  style={{
                    padding: '8px 18px', fontSize: '0.85rem', border: '1px solid #e53e3e',
                    borderRadius: '10px', background: '#fef2f2', color: '#e53e3e', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600'
                  }}
                >
                  {isDeleting ? <Loader2 size={16} style={{ animation: 'spin 1.5s linear infinite' }} /> : <AlertTriangle size={16} />}
                  {isDeleting ? 'Rimozione...' : 'Rimuovi Dispositivo'}
                </button>
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
