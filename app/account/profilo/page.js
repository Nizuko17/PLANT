'use client';

import FadeIn from '@/components/FadeIn';
import { createClient } from '@/utils/supabase/client';
import { useState, useEffect } from 'react';
import { User, Wifi, WifiOff, Droplets, Wind, Leaf, Package, Heart, LogOut, Save, Edit3, X, Globe, Sprout, ArrowRight, Thermometer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cachedFetch, invalidateCache, clearAllCache } from '@/hooks/useCache';

export default function Profilo() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [liveDataMap, setLiveDataMap] = useState({});

  // Form profilo
  const [profileForm, setProfileForm] = useState({
    first_name: '', last_name: '', birth_date: '', address: '', phone: ''
  });

  const [products, setProducts] = useState([]);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/account'); return; }

      setUser(user);

      try {
        // Caricamento parallelo con Cache (TTL standard 5 min)
        const [profileRes, devicesRes, productsRes] = await Promise.all([
          cachedFetch('profile', async () => {
            const res = await fetch('/api/profile/get');
            return await res.json();
          }),
          cachedFetch('devices_v2', async () => {
            const { data } = await supabase
              .from('devices')
              .select('*, product:products(name, slug), device_status:status(type), settings:device_settings(last_ip)')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false });
            return { data };
          }),
          cachedFetch('products', async () => {
             const { data } = await supabase
              .from('products')
              .select('id, name')
              .eq('category_id', 1)
              .eq('is_active', true);
             return { data };
          })
        ]);

        // Gestione Profilo
        const prof = profileRes;
        if (!prof.error) {
          setProfile(prof);
          setProfileForm({
            first_name: prof.first_name || '',
            last_name: prof.last_name || '',
            birth_date: prof.birth_date || '',
            address: prof.address || '',
            phone: prof.phone || ''
          });
        }

        // Gestione Dispositivi
        if (devicesRes.data) {
          setDevices(devicesRes.data);
        }

        // Gestione Prodotti per form
        if (productsRes.data) {
          setProducts(productsRes.data);
        }

      } catch (err) {
        console.error("Errore nel caricamento dinamico dei dati:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supabase, router]);

  useEffect(() => {
    if (devices.length === 0) return;
    
    const fetchLive = async () => {
      const newMap = {};
      await Promise.all(devices.map(async (dev) => {
        const targetIp = dev.settings?.last_ip || localStorage.getItem(`plant_device_ip_${dev.id}`);
        if (targetIp) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`http://${targetIp}/api/data`, { 
              signal: controller.signal,
              cache: 'no-store'
            });
            clearTimeout(timeoutId);
            if (res.ok) {
              const data = await res.json();
              newMap[dev.id] = data;
            } else {
              newMap[dev.id] = { offline: true };
            }
          } catch (e) {
            newMap[dev.id] = { offline: true };
          }
        }
      }));
      setLiveDataMap(prev => ({ ...prev, ...newMap }));
    };

    fetchLive();
    const iv = setInterval(fetchLive, 5000);
    return () => clearInterval(iv);
  }, [devices]);

  const handleSaveProfile = async () => {
    setSaving(true);
    
    // Salvataggio tramite API Backend (con cifratura e validazione)
    const res = await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileForm)
    });

    const result = await res.json();

    if (!result.error) {
      setProfile({ ...profile, ...profileForm });
      setEditing(false);
      invalidateCache('profile'); // Invalida la cache del profilo dopo il salvataggio
    } else {
      alert(result.error || 'Errore nel salvataggio del profilo.');
    }
    setSaving(false);
  };



  const handleLogout = async () => {
    clearAllCache(); // Pulisce tutta la cache al logout
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  // Metriche ecologiche

  const waterSaved = devices.reduce((sum, dev) => sum + (dev.water_use || 0), 0);
  const waterSavedMl = Math.round(waterSaved * 1000); // Converte litri in millilitri per la UI
  // Ossigeno proporzionale al numero di vasi (es: 1 pianta = 150g di O2 generato)
  const oxygenGenerated = devices.length * 150;

  if (loading) return <main className="page-hero text-center"><div className="container" style={{ paddingTop: '120px' }}>Caricamento profilo...</div></main>;

  return (
    <main>
      {/* Header Profilo */}
      <section className="page-hero text-center" style={{ paddingBottom: '20px' }}>
        <div className="container">
          <FadeIn>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'var(--accent-green)',
              margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 25px rgba(167, 196, 170, 0.2)'
            }}>
              <User size={36} color="var(--white)" />
            </div>
            <h1 className="hero-title" style={{ fontSize: '2rem' }}>
              {profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : user?.email?.split('@')[0]}
            </h1>
            <p className="hero-subtitle" style={{ fontSize: '0.95rem' }}>{user?.email}</p>
          </FadeIn>
        </div>
      </section>

      <section className="account-section" style={{ paddingTop: 0 }}>
        <div className="container">

          {/* Card Metriche Ecologiche */}
          <FadeIn>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px',
              marginBottom: '30px'
            }}>
              <div className="account-card" style={{ padding: '25px', textAlign: 'center', background: 'var(--accent-green-light)', border: '1px solid var(--accent-green)' }}>
                <Leaf size={28} style={{ color: 'var(--accent-green)', marginBottom: '10px' }} />
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)' }}>{devices.length}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Vasi Connessi</div>
              </div>
              <div className="account-card" style={{ padding: '25px', textAlign: 'center', background: 'var(--bg-alt)', border: '1px solid var(--border-color)' }}>
                <Droplets size={28} style={{ color: '#3b82f6', marginBottom: '10px' }} />
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)' }}>{waterSavedMl} ml</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Acqua Risparmiata</div>
              </div>
              <div className="account-card" style={{ padding: '25px', textAlign: 'center', background: 'var(--bg-alt)', border: '1px solid var(--border-color)' }}>
                <Wind size={28} style={{ color: '#ca8a04', marginBottom: '10px' }} />
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)' }}>{oxygenGenerated}g</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>O₂ Generato</div>
              </div>
            </div>
          </FadeIn>

          {/* Sezione Dati Profilo */}
          <FadeIn>
            <div className="account-card" style={{ padding: '30px', marginBottom: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <User size={20} color="var(--accent-green)" /> Informazioni Personali
                </h3>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Edit3 size={16} /> Modifica
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="btn btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Save size={16} /> {saving ? 'Salvataggio...' : 'Salva'}
                    </button>
                    <button
                      onClick={() => { setEditing(false); setProfileForm({ first_name: profile?.first_name || '', last_name: profile?.last_name || '', birth_date: profile?.birth_date || '', address: profile?.address || '', phone: profile?.phone || '' }); }}
                      style={{ padding: '8px 16px', fontSize: '0.85rem', border: '1px solid #ddd', borderRadius: '30px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <X size={16} /> Annulla
                    </button>
                  </div>
                )}
              </div>

              {editing ? (
                /* FORM DI MODIFICA */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>Nome</label>
                    <input type="text" placeholder="Es: Marco" value={profileForm.first_name}
                      onChange={e => setProfileForm({ ...profileForm, first_name: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.95rem', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>Cognome</label>
                    <input type="text" placeholder="Es: Rossi" value={profileForm.last_name}
                      onChange={e => setProfileForm({ ...profileForm, last_name: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.95rem', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>Data di nascita</label>
                    <input type="date" value={profileForm.birth_date}
                      onChange={e => setProfileForm({ ...profileForm, birth_date: e.target.value })}
                      className="date-picker-styled"
                      style={{
                        width: '100%', padding: '12px 16px', border: '1px solid var(--border-color)', borderRadius: '12px',
                        fontSize: '0.95rem', background: 'var(--input-bg)', color: 'var(--text-primary)',
                        fontFamily: 'inherit', cursor: 'pointer', transition: 'border-color 0.3s'
                      }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>Telefono</label>
                    <input type="tel" placeholder="Es: +39 333 1234567" value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.95rem', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>Indirizzo</label>
                    <input type="text" placeholder="Es: Via Roma 1, 20100 Milano" value={profileForm.address}
                      onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.95rem', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
                  </div>
                </div>
              ) : (
                /* VISUALIZZAZIONE DATI */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nome</div>
                    <div style={{ fontWeight: '500' }}>{profile?.first_name || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Cognome</div>
                    <div style={{ fontWeight: '500' }}>{profile?.last_name || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Data di nascita</div>
                    <div style={{ fontWeight: '500' }}>{profile?.birth_date ? new Date(profile.birth_date).toLocaleDateString('it-IT') : '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Telefono</div>
                    <div style={{ fontWeight: '500' }}>{profile?.phone || '—'}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Indirizzo</div>
                    <div style={{ fontWeight: '500' }}>{profile?.address || '—'}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Email</div>
                    <div style={{ fontWeight: '500' }}>{user?.email}</div>
                  </div>
                </div>
              )}
            </div>
          </FadeIn>

          {/* Sezione Dispositivi */}
          <FadeIn>
            <div className="account-card" style={{ padding: '30px', marginBottom: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Sprout size={20} color="var(--accent-green)" /> I Miei Dispositivi
                </h3>
                <button
                  onClick={() => router.push('/account/dispositivi/ricerca')}
                  className="btn btn-primary"
                  style={{ padding: '8px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px' }}
                >
                  <Wifi size={16} /> Cerca Dispositivo
                </button>
              </div>

              {devices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                  <Sprout size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                  <p style={{ margin: 0, fontWeight: '500' }}>Nessun dispositivo collegato.</p>
                  <p style={{ margin: '8px 0 20px', fontSize: '0.88rem' }}>Cerca il tuo vaso PLANT sulla rete WiFi.</p>
                  <button onClick={() => router.push('/account/dispositivi/ricerca')} className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '0.9rem' }}>
                    <Wifi size={16} /> Inizia Ricerca
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '16px' }}>
                  {devices.map(dev => {
                    const isActive = dev.device_status?.type === 'Active';
                    const targetIp = dev.settings?.last_ip || (typeof window !== 'undefined' ? localStorage.getItem(`plant_device_ip_${dev.id}`) : null);
                    const live = liveDataMap[dev.id];
                    const isOnline = live && !live.offline;
                    
                    const statusText = isOnline ? 'Online' : (targetIp ? 'Offline' : 'Da configurare');
                    const statusColor = isOnline ? 'var(--accent-green)' : (targetIp ? '#e53e3e' : 'var(--text-secondary)');
                    const bgColor = isOnline ? 'var(--accent-green-light)' : (targetIp ? '#fef2f2' : 'var(--bg-alt)');
                    const temp = isOnline && live.temperature?.value ? `${live.temperature.value}°C` : '—';
                    const hum = isOnline && live.humidity?.value ? `${live.humidity.value}%` : '—';

                    return (
                      <div key={dev.id} style={{
                        border: `1px solid ${isActive ? 'var(--accent-green)' : 'var(--border-color)'}`,
                        borderRadius: '20px', padding: '20px',
                        background: 'var(--card-bg)', position: 'relative',
                        overflow: 'hidden', transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        display: 'flex', flexDirection: 'column', gap: '16px'
                      }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.08)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        {/* Strip superiore */}
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '3px', background: isActive ? 'var(--accent-green)' : 'var(--border-color)' }} />

                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                          <div style={{
                            width: '50px', height: '50px', borderRadius: '14px', flexShrink: 0,
                            background: isActive ? 'var(--accent-green-light)' : 'var(--bg-alt)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `1px solid ${isActive ? 'var(--accent-green)' : 'var(--border-color)'}`
                          }}>
                            <Sprout size={26} color={isActive ? 'var(--accent-green)' : 'var(--text-secondary)'} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ margin: '0 0 3px', fontSize: '1.05rem', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dev.name}</h4>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{dev.product?.name || 'PLANT Smart Vase'}</span>
                          </div>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700', flexShrink: 0,
                            background: bgColor,
                            color: statusColor
                          }}>
                            {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
                            {statusText}
                          </span>
                        </div>

                        {/* Stats rapide */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div style={{ padding: '10px 12px', background: 'var(--bg-alt)', borderRadius: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                              <Droplets size={13} color="#3b82f6" />
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Umidità</span>
                            </div>
                            <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>{hum}</div>
                          </div>
                          <div style={{ padding: '10px 12px', background: 'var(--bg-alt)', borderRadius: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                              <Thermometer size={13} color="#e53e3e" />
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Temp.</span>
                            </div>
                            <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>{temp}</div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <code style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{dev.mac_address || 'MAC N/D'}</code>
                          <button
                            onClick={() => router.push(`/account/dispositivi/${dev.id}`)}
                            style={{
                              padding: '7px 14px', fontSize: '0.82rem', fontWeight: '700',
                              borderRadius: '10px', border: '1px solid var(--accent-green)',
                              background: 'transparent', color: 'var(--accent-green)',
                              cursor: 'pointer', transition: 'all 0.2s ease',
                              display: 'flex', alignItems: 'center', gap: '5px'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-green)'; e.currentTarget.style.color = 'white'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent-green)'; }}
                          >
                            Gestisci <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </FadeIn>

          {/* Azioni rapide */}
          <FadeIn>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <a href="/ordini" className="account-card" style={{ padding: '20px', textAlign: 'center', textDecoration: 'none', color: 'inherit', transition: 'transform 0.2s' }}>
                <Package size={24} style={{ marginBottom: '8px', color: 'var(--accent-green)' }} />
                <div style={{ fontWeight: '600' }}>I miei Ordini</div>
              </a>
              <a href="/preferiti" className="account-card" style={{ padding: '20px', textAlign: 'center', textDecoration: 'none', color: 'inherit' }}>
                <Heart size={24} style={{ marginBottom: '8px', color: 'var(--accent-green)' }} />
                <div style={{ fontWeight: '600' }}>I miei Preferiti</div>
              </a>
              <a href="/impatto" className="account-card" style={{ padding: '20px', textAlign: 'center', textDecoration: 'none', color: 'inherit' }}>
                <Leaf size={24} style={{ marginBottom: '8px', color: 'var(--accent-green)' }} />
                <div style={{ fontWeight: '600' }}>Impatto Ambientale</div>
              </a>
              <button onClick={handleLogout} className="account-card" style={{ padding: '20px', textAlign: 'center', border: 'none', cursor: 'pointer', background: 'var(--card-bg)' }}>
                <LogOut size={24} style={{ marginBottom: '8px', color: '#cc4444' }} />
                <div style={{ fontWeight: '600', color: '#cc4444' }}>Esci</div>
              </button>
            </div>
          </FadeIn>

        </div>
      </section>
    </main>
  );
}
