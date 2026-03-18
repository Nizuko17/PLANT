'use client';

import FadeIn from '@/components/FadeIn';
import { createClient } from '@/utils/supabase/client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Wifi, Search, ArrowLeft, Cpu, Globe, Activity, Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { invalidateCache } from '@/hooks/useCache';
import Link from 'next/link';

export default function RicercaDispositivo() {
  const router = useRouter();
  const supabase = createClient();
  
  const [ipAddress, setIpAddress] = useState('');
  const [searching, setSearching] = useState(false);
  const [autoSearching, setAutoSearching] = useState(false);
  const [foundDevice, setFoundDevice] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    // Carichiamo i modelli di prodotto disponibili
    async function loadProducts() {
      const { data } = await supabase
        .from('products')
        .select('id, name')
        .eq('category_id', 1) // Assumiamo categoria 1 = Hardware/Vasi
        .eq('is_active', true);
      setProducts(data || []);
    }
    loadProducts();
  }, [supabase]);

  // AUTO-DISCOVERY: Cerca pompa.local ogni 10 secondi
  useEffect(() => {
    if (foundDevice || searching) return;

    const autoProbe = async () => {
      if (foundDevice) return;
      setAutoSearching(true);
      await probeDevice(null, 'pompa.local', true);
      setAutoSearching(false);
    };

    // Primo tentativo immediato
    autoProbe();

    const interval = setInterval(autoProbe, 10000); // Ogni 10s
    return () => clearInterval(interval);
  }, [foundDevice, searching]);

  const probeDevice = async (e, targetOverride = null, isAuto = false) => {
    if (e) e.preventDefault();
    
    const targetInput = targetOverride || ipAddress;
    if (!targetInput) return;

    if (!isAuto) {
      setSearching(true);
      setError(null);
      setFoundDevice(null);
    }

    // Pulizia dell'IP string
    let target = targetInput.trim();
    if (!target.startsWith('http')) {
      target = `http://${target}`;
    }
    if (!target.endsWith('/info')) {
      target = `${target}/info`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), isAuto ? 3000 : 5000);

      const response = await fetch(target, { 
        signal: controller.signal,
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      const rawData = await response.json();
      
      let data = rawData;
      if (typeof rawData === 'string' && rawData.startsWith('CARD:')) {
        data = JSON.parse(rawData.substring(5));
      }

      if (data && data.mac) {
        setFoundDevice(data);
        if (isAuto) setIpAddress(targetInput); // Se trovato in auto, riempiamo il campo
      } else if (!isAuto) {
        throw new Error('Dati ricevuti non validi o formato CARD non trovato.');
      }
    } catch (err) {
      if (!isAuto) {
        console.error('Probe Detailed Error:', err);
        
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
        const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        if (err.name === 'AbortError') {
          setError('Timeout: Il dispositivo non ha risposto entro 5 secondi. Verifica l\'IP o prova a riavviare la scheda.');
        } else if (isHttps && !target.startsWith('https') && !isLocalhost) {
          setError('Errore di Sicurezza: Non puoi contattare un dispositivo HTTP da un sito HTTPS. Prova a usare l\'indirizzo IP direttamente nel browser o usa una connessione non sicura per questo test.');
        } else {
          setError('Impossibile raggiungere il dispositivo. Assicurati che sia connesso alla stessa WiFi e che l\'IP sia corretto. Ti suggeriamo di provare ad aprire ' + target + ' in una nuova scheda del browser per verificare se risponde.');
        }
      }
    } finally {
      if (!isAuto) setSearching(false);
    }
  };

  const handleAddDevice = async () => {
    if (!foundDevice) return;
    setAdding(true);

    try {
      // Troviamo il product_id corrispondente al tipo o usiamo il primo disponibile come fallback
      let productId = products.find(p => p.name.includes('Sprout'))?.id || products[0]?.id || 1;
      
      const res = await fetch('/api/devices/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: foundDevice.device_name || 'Nuovo NodeMCU',
          product_id: productId,
          mac_address: foundDevice.mac
        })
      });

      const result = await res.json();
      if (result.success) {
        invalidateCache('devices');
        alert('Dispositivo aggiunto con successo!');
        router.push('/account/profilo');
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      alert('Errore nel salvataggio: ' + err.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-color)', paddingBottom: '80px' }}>
      <section className="page-hero text-center" style={{ paddingBottom: '40px' }}>
        <div className="container">
          <Link href="/account/profilo" style={{ 
            display: 'inline-flex', alignItems: 'center', gap: '8px', 
            color: 'var(--text-secondary)', marginBottom: '24px', textDecoration: 'none',
            fontSize: '0.9rem', fontWeight: '600'
          }}>
            <ArrowLeft size={16} /> Torna al Profilo
          </Link>
          <FadeIn>
            <h1 className="hero-title">Aggiungi Dispositivo WiFi</h1>
            <p className="hero-subtitle">Connetti la tua scheda NodeMCU LoLin V3 inserendo l'IP locale.</p>
          </FadeIn>
        </div>
      </section>

      <section className="container" style={{ maxWidth: '600px' }}>
        <FadeIn>
          <div className="account-card" style={{ padding: '30px' }}>
            {/* INDICATORE AUTO-DISCOVERY */}
            {!foundDevice && (
              <div style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                gap: '8px', marginBottom: '20px', fontSize: '0.8rem',
                color: autoSearching ? 'var(--accent-green)' : 'var(--text-secondary)',
                transition: 'all 0.3s'
              }}>
                <div style={{ 
                  width: '8px', height: '8px', borderRadius: '50%', 
                  background: autoSearching ? 'var(--accent-green)' : '#ccc',
                  boxShadow: autoSearching ? '0 0 10px var(--accent-green)' : 'none',
                  animation: autoSearching ? 'pulse 1.5s infinite' : 'none'
                }}></div>
                {autoSearching ? 'Ricerca automatica di pompa.local in corso...' : 'Ricerca automatica in pausa'}
              </div>
            )}

            <form onSubmit={probeDevice} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Globe size={18} style={{ 
                  position: 'absolute', left: '14px', top: '50%', 
                  transform: 'translateY(-50%)', color: 'var(--text-secondary)' 
                }} />
                <input 
                  type="text" 
                  placeholder="Es: 192.168.1.85 o pompa.local"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  style={{ 
                    width: '100%', padding: '12px 16px 12px 42px', 
                    borderRadius: '12px', border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)', color: 'var(--text-primary)',
                    fontSize: '1rem'
                  }}
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={searching || !ipAddress}
                style={{ padding: '0 25px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {searching ? <Activity className="spin" size={18} /> : <Search size={18} />}
                Cerca
              </button>
            </form>

            {error && (
              <div style={{ 
                padding: '16px', borderRadius: '12px', background: '#fef2f2', 
                border: '1px solid #fee2e2', color: '#991b1b', 
                display: 'flex', gap: '12px', alignItems: 'flex-start',
                marginBottom: '24px' 
              }}>
                <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.9rem' }}>{error}</div>
              </div>
            )}

            {foundDevice && (
              <FadeIn>
                <div style={{ 
                  background: 'var(--bg-alt)', borderRadius: '16px', 
                  border: '1px solid var(--accent-green)', padding: '24px' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '40px', height: '40px', borderRadius: '10px', 
                        background: 'var(--accent-green-light)', color: 'var(--accent-green)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <Cpu size={24} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem' }}>{foundDevice.device_name}</h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{foundDevice.device_type}</span>
                      </div>
                    </div>
                    <div style={{ 
                      display: 'flex', alignItems: 'center', gap: '6px', 
                      color: 'var(--accent-green)', fontWeight: '700', fontSize: '0.85rem' 
                    }}>
                      <CheckCircle2 size={16} /> Online
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
                    <div style={{ padding: '12px', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Sorgente IP</label>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{ipAddress}</div>
                    </div>
                    <div style={{ padding: '12px', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>MAC Address</label>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#666' }}>{foundDevice.mac}</div>
                    </div>
                    <div style={{ padding: '12px', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Firmware</label>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>v{foundDevice.firmware_version}</div>
                    </div>
                    <div style={{ padding: '12px', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Uptime</label>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{Math.floor(foundDevice.uptime_s / 60)} min</div>
                    </div>
                  </div>

                  <button 
                    onClick={handleAddDevice}
                    disabled={adding}
                    className="btn btn-primary btn-full"
                    style={{ padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                  >
                    {adding ? <Activity className="spin" size={18} /> : <Plus size={18} />}
                    {adding ? 'Registrazione in corso...' : 'Aggiungi al mio Profilo'}
                  </button>
                </div>
              </FadeIn>
            )}

            {!foundDevice && !searching && (
              <div style={{ 
                textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)',
                fontSize: '0.85rem'
              }}>
                <p>Inserisci l'indirizzo IP locale visualizzato sul serial monitor o fornito dal router (es: 192.168.x.x).</p>
                <div style={{ marginTop: '15px', padding: '10px', background: 'var(--bg-alt)', borderRadius: '8px', fontSize: '0.75rem' }}>
                  <span style={{ fontWeight: '700' }}>Pro TIP:</span> Se hai configurato mDNS, prova con <code>pompa.local</code>
                </div>
              </div>
            )}
          </div>
        </FadeIn>

        {/* GUIDA ALLA CONFIGURAZIONE */}
        <FadeIn delay={0.2}>
          <div style={{ marginTop: '40px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Wifi size={20} color="var(--accent-green)" /> Guida al primo collegamento
            </h3>
            <div style={{ display: 'grid', gap: '15px' }}>
              {[
                { title: "1. Prima accensione", desc: "Collega il NodeMCU. Se non trova una rete nota, creerà un hotspot chiamato 'PompaWiFi-Setup'." },
                { title: "2. Connessione Setup", desc: "Dal tuo telefono o PC, connettiti alla rete 'PompaWiFi-Setup' (Password: configura)." },
                { title: "3. Configura WiFi", desc: "Apri il browser su http://192.168.4.1 e inserisci le credenziali della tua rete WiFi domestica." },
                { title: "4. Ricerca", desc: "Una volta riavviato, il NodeMCU sarà online. Inserisci IP o 'pompa.local' nel form sopra." }
              ].map((step, idx) => (
                <div key={idx} style={{ 
                  display: 'flex', gap: '15px', padding: '15px', 
                  background: 'var(--card-bg)', borderRadius: '12px', 
                  border: '1px solid var(--border-color)' 
                }}>
                  <div style={{ 
                    width: '30px', height: '30px', borderRadius: '50%', 
                    background: 'var(--accent-green)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: '700', fontSize: '0.9rem', flexShrink: 0
                  }}>{idx + 1}</div>
                  <div>
                    <h5 style={{ margin: '0 0 4px 0', fontSize: '0.9rem' }}>{step.title}</h5>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ 
              marginTop: '20px', padding: '15px', borderRadius: '12px', 
              background: 'rgba(25, 135, 84, 0.05)', border: '1px dashed var(--accent-green)',
              fontSize: '0.8rem', color: 'var(--text-secondary)'
            }}>
              <strong>Nota:</strong> Se vuoi cambiare rete WiFi, invia <code>RESETWIFI</code> tramite il monitor seriale per far tornare la scheda in modalità setup.
            </div>
          </div>
        </FadeIn>
      </section>

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 2s linear infinite; }
      `}</style>
    </main>
  );
}
