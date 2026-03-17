'use client';

import FadeIn from '@/components/FadeIn';
import { createClient } from '@/utils/supabase/client';
import { useState, useEffect } from 'react';
import { User, Wifi, WifiOff, Plus, Droplets, Wind, Leaf, Package, Heart, LogOut, Save, Edit3, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Profilo() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form profilo
  const [profileForm, setProfileForm] = useState({
    first_name: '', last_name: '', birth_date: '', address: '', phone: ''
  });

  // Form nuovo dispositivo
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [deviceForm, setDeviceForm] = useState({ name: '', product_id: '', mac_address: '' });
  const [products, setProducts] = useState([]);
  const [savingDevice, setSavingDevice] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/account'); return; }

      setUser(session.user);

      // Carica profilo
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(prof);
      if (prof) {
        setProfileForm({
          first_name: prof.first_name || '',
          last_name: prof.last_name || '',
          birth_date: prof.birth_date || '',
          address: prof.address || '',
          phone: prof.phone || ''
        });
      }

      // Carica dispositivi con info prodotto e status
      const { data: devs } = await supabase
        .from('devices')
        .select('*, product:products(name, slug), device_status:status(type)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      setDevices(devs || []);

      // Carica prodotti per il form (solo vasi, category_id = 1)
      const { data: prods } = await supabase.from('products').select('id, name').eq('category_id', 1).eq('is_active', true);
      setProducts(prods || []);

      setLoading(false);
    };
    load();
  }, [supabase, router]);

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: profileForm.first_name || null,
        last_name: profileForm.last_name || null,
        birth_date: profileForm.birth_date || null,
        address: profileForm.address || null,
        phone: profileForm.phone || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (!error) {
      setProfile({ ...profile, ...profileForm });
      setEditing(false);
    } else {
      alert('Errore nel salvataggio del profilo.');
    }
    setSaving(false);
  };

  const handleAddDevice = async (e) => {
    e.preventDefault();
    if (!deviceForm.name || !deviceForm.product_id) return;

    setSavingDevice(true);
    const { data: { session } } = await supabase.auth.getSession();

    const { error } = await supabase.from('devices').insert([{
      user_id: session.user.id,
      name: deviceForm.name,
      product_id: parseInt(deviceForm.product_id),
      mac_address: deviceForm.mac_address || null,
      status_id: 1,
    }]);

    if (!error) {
      setDeviceForm({ name: '', product_id: '', mac_address: '' });
      setShowAddDevice(false);
      const { data: devs } = await supabase
        .from('devices')
        .select('*, product:products(name, slug), device_status:status(type)')
        .eq('user_id', session.user.id);
      setDevices(devs || []);
    } else {
      alert('Errore nel salvataggio del dispositivo.');
    }
    setSavingDevice(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  // Metriche ecologiche
  const totalDevices = devices.length;
  const avgDaysPerDevice = 30;
  const waterSaved = totalDevices * avgDaysPerDevice * 0.15;
  const oxygenGenerated = totalDevices * avgDaysPerDevice * 5;

  if (loading) return <main className="page-hero text-center"><div className="container" style={{ paddingTop: '120px' }}>Caricamento profilo...</div></main>;

  return (
    <main>
      {/* Header Profilo */}
      <section className="page-hero text-center" style={{ paddingBottom: '20px' }}>
        <div className="container">
          <FadeIn>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #4ade80, #22c55e)',
              margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 25px rgba(74, 222, 128, 0.3)'
            }}>
              <User size={36} color="white" />
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
              <div className="account-card" style={{ padding: '25px', textAlign: 'center', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)' }}>
                <Leaf size={28} style={{ color: '#22c55e', marginBottom: '10px' }} />
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#166534' }}>{totalDevices}</div>
                <div style={{ fontSize: '0.85rem', color: '#166534' }}>Vasi Connessi</div>
              </div>
              <div className="account-card" style={{ padding: '25px', textAlign: 'center', background: 'linear-gradient(135deg, #eff6ff, #dbeafe)' }}>
                <Droplets size={28} style={{ color: '#3b82f6', marginBottom: '10px' }} />
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1e40af' }}>{waterSaved.toFixed(1)}L</div>
                <div style={{ fontSize: '0.85rem', color: '#1e40af' }}>Acqua Risparmiata</div>
              </div>
              <div className="account-card" style={{ padding: '25px', textAlign: 'center', background: 'linear-gradient(135deg, #fefce8, #fef9c3)' }}>
                <Wind size={28} style={{ color: '#ca8a04', marginBottom: '10px' }} />
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#854d0e' }}>{oxygenGenerated.toFixed(0)}g</div>
                <div style={{ fontSize: '0.85rem', color: '#854d0e' }}>O₂ Generato</div>
              </div>
            </div>
          </FadeIn>

          {/* Sezione Dati Profilo */}
          <FadeIn>
            <div className="account-card" style={{ padding: '30px', marginBottom: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>👤 Informazioni Personali</h3>
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
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px', color: '#86868b' }}>Nome</label>
                    <input type="text" placeholder="Es: Marco" value={profileForm.first_name}
                      onChange={e => setProfileForm({ ...profileForm, first_name: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '12px', fontSize: '0.95rem', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px', color: '#86868b' }}>Cognome</label>
                    <input type="text" placeholder="Es: Rossi" value={profileForm.last_name}
                      onChange={e => setProfileForm({ ...profileForm, last_name: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '12px', fontSize: '0.95rem', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px', color: '#86868b' }}>Data di nascita</label>
                    <input type="date" value={profileForm.birth_date}
                      onChange={e => setProfileForm({ ...profileForm, birth_date: e.target.value })}
                      className="date-picker-styled"
                      style={{
                        width: '100%', padding: '12px 16px', border: '2px solid var(--border-color)', borderRadius: '12px',
                        fontSize: '0.95rem', background: 'var(--input-bg)', color: 'var(--text-primary)',
                        fontFamily: 'inherit', cursor: 'pointer', transition: 'border-color 0.3s'
                      }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px', color: '#86868b' }}>Telefono</label>
                    <input type="tel" placeholder="Es: +39 333 1234567" value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '12px', fontSize: '0.95rem', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px', color: '#86868b' }}>Indirizzo</label>
                    <input type="text" placeholder="Es: Via Roma 1, 20100 Milano" value={profileForm.address}
                      onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '12px', fontSize: '0.95rem', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
                  </div>
                </div>
              ) : (
                /* VISUALIZZAZIONE DATI */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#86868b', marginBottom: '4px' }}>Nome</div>
                    <div style={{ fontWeight: '500' }}>{profile?.first_name || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#86868b', marginBottom: '4px' }}>Cognome</div>
                    <div style={{ fontWeight: '500' }}>{profile?.last_name || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#86868b', marginBottom: '4px' }}>Data di nascita</div>
                    <div style={{ fontWeight: '500' }}>{profile?.birth_date ? new Date(profile.birth_date).toLocaleDateString('it-IT') : '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#86868b', marginBottom: '4px' }}>Telefono</div>
                    <div style={{ fontWeight: '500' }}>{profile?.phone || '—'}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '0.8rem', color: '#86868b', marginBottom: '4px' }}>Indirizzo</div>
                    <div style={{ fontWeight: '500' }}>{profile?.address || '—'}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '0.8rem', color: '#86868b', marginBottom: '4px' }}>Email</div>
                    <div style={{ fontWeight: '500' }}>{user?.email}</div>
                  </div>
                </div>
              )}
            </div>
          </FadeIn>

          {/* Sezione Dispositivi */}
          <FadeIn>
            <div className="account-card" style={{ padding: '30px', marginBottom: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>🌱 I Miei Dispositivi</h3>
                <button
                  onClick={() => setShowAddDevice(!showAddDevice)}
                  className="btn btn-primary"
                  style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={16} /> Collega Vaso
                </button>
              </div>

              {showAddDevice && (
                <form onSubmit={handleAddDevice} style={{
                  padding: '20px', background: 'var(--bg-alt)', borderRadius: '12px', marginBottom: '20px',
                  display: 'flex', flexDirection: 'column', gap: '12px'
                }}>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <input
                      type="text" placeholder="Nome personalizzato (es. Vaso Salotto)"
                      value={deviceForm.name} onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })}
                      required
                      style={{ flex: '1 1 200px', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                    />
                    <select
                      value={deviceForm.product_id} onChange={e => setDeviceForm({ ...deviceForm, product_id: e.target.value })}
                      required
                      style={{ flex: '1 1 150px', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                    >
                      <option value="">Seleziona Modello</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input
                      type="text" placeholder="MAC Address (opzionale)"
                      value={deviceForm.mac_address} onChange={e => setDeviceForm({ ...deviceForm, mac_address: e.target.value })}
                      style={{ flex: '1 1 180px', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="submit" className="btn btn-primary" disabled={savingDevice} style={{ padding: '10px 20px' }}>
                      {savingDevice ? 'Salvataggio...' : 'Registra Dispositivo'}
                    </button>
                    <button type="button" onClick={() => setShowAddDevice(false)} className="btn btn-secondary" style={{ padding: '10px 20px' }}>
                      Annulla
                    </button>
                  </div>
                </form>
              )}

              {devices.length === 0 ? (
                <p style={{ color: '#666', textAlign: 'center', padding: '30px 0' }}>
                  Nessun dispositivo collegato. Registra il tuo primo vaso PLANT!
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                  {devices.map(dev => (
                    <div key={dev.id} className="account-card" style={{
                      padding: '20px', border: '1px solid var(--border-color)', borderRadius: '16px',
                      display: 'flex', flexDirection: 'column', gap: '15px', position: 'relative',
                      overflow: 'hidden', background: 'var(--card-bg)'
                    }}>
                      {/* Status Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{dev.name}</h4>
                          <span style={{ fontSize: '0.8rem', color: '#86868b' }}>{dev.product?.name || 'Vaso Smart'}</span>
                        </div>
                        <div style={{ 
                          padding: '6px', borderRadius: '50%', 
                          background: dev.device_status?.type === 'Active' ? 'var(--accent-green-light)' : '#f5f5f7',
                          color: dev.device_status?.type === 'Active' ? '#166534' : '#86868b'
                        }}>
                          {dev.device_status?.type === 'Active' ? <Wifi size={18} /> : <WifiOff size={18} />}
                        </div>
                      </div>

                      {/* Mockup Live Stats */}
                      <div style={{ display: 'flex', gap: '15px', padding: '10px 0' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '5px', fontWeight: '600' }}>
                            <span>Umidità</span>
                            <span style={{ color: 'var(--accent-green)' }}>42%</span>
                          </div>
                          <div style={{ height: '6px', background: '#eee', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: '42%', height: '100%', background: 'var(--accent-green)', borderRadius: '3px' }}></div>
                          </div>
                        </div>
                        <div style={{ borderLeft: '1px solid #eee', paddingLeft: '15px' }}>
                          <div style={{ fontSize: '0.75rem', color: '#86868b', marginBottom: '2px' }}>Temp.</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: '700' }}>24°C</div>
                        </div>
                      </div>

                      {/* Footer Info */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
                        <code style={{ fontSize: '0.7rem', color: '#999' }}>{dev.mac_address || '00:00:00:00:00'}</code>
                        <button style={{ 
                          padding: '6px 12px', fontSize: '0.8rem', fontWeight: '600', 
                          borderRadius: '20px', border: '1px solid #eee', background: 'white',
                          cursor: 'pointer', transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#f9f9f9'}
                        onMouseLeave={(e) => e.target.style.background = 'white'}
                        >
                          Gestisci
                        </button>
                      </div>

                      {/* Top Accent Strip */}
                      <div style={{ 
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '4px',
                        background: dev.device_status?.type === 'Active' ? 'var(--accent-green)' : '#ddd'
                      }}></div>
                    </div>
                  ))}
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
