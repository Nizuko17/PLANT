import FadeIn from '@/components/FadeIn';
import { createClient } from '@/utils/supabase/server';
import { Droplets, Wind, Leaf, Users, Sprout, Globe } from 'lucide-react';

export const metadata = {
  title: 'Impatto Ambientale | PLANT',
  description: 'Scopri l\'impatto positivo della community PLANT sull\'ambiente: acqua risparmiata e ossigeno generato.',
};

export default async function Impatto() {
  const supabase = await createClient();
  
  // Statistiche aggregate globali
  const { count: totalDevices } = await supabase.from('devices').select('*', { count: 'exact', head: true });
  const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  const { count: totalOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true });

  const devCount = totalDevices || 0;
  const userCount = totalUsers || 0;

  // Stime ecologiche globali
  const avgDaysActive = 60; // media ipotetica di attività per dispositivo
  const globalWaterSaved = devCount * avgDaysActive * 0.15; // Litri risparmiati
  const globalOxygen = devCount * avgDaysActive * 5; // grammi O2
  const globalCO2Absorbed = devCount * avgDaysActive * 8; // grammi CO2 assorbiti

  return (
    <main>
      {/* Hero */}
      <section className="page-hero text-center" style={{ 
        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #eff6ff 100%)',
        padding: '100px 0 60px'
      }}>
        <div className="container">
          <FadeIn>
            <Globe size={50} style={{ color: '#22c55e', marginBottom: '20px' }} />
            <h1 className="hero-title" style={{ fontSize: '2.8rem', color: '#14532d' }}>
              Il Nostro Impatto
            </h1>
            <p className="hero-subtitle" style={{ maxWidth: '600px', margin: '0 auto', color: '#166534' }}>
              Ogni vaso PLANT contribuisce a un mondo più verde. Insieme, stiamo facendo la differenza.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* KPI Globali */}
      <section style={{ padding: '60px 0' }}>
        <div className="container">
          <FadeIn>
            <div style={{ 
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '20px',
              marginBottom: '50px'
            }}>
              {/* Acqua Risparmiata */}
              <div style={{ 
                padding: '35px 25px', borderRadius: '16px', textAlign: 'center',
                background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.1)'
              }}>
                <Droplets size={40} style={{ color: '#3b82f6', marginBottom: '15px' }} />
                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#1e40af', lineHeight: 1 }}>
                  {globalWaterSaved >= 1000 ? `${(globalWaterSaved / 1000).toFixed(1)}K` : globalWaterSaved.toFixed(0)}
                </div>
                <div style={{ fontSize: '1.1rem', color: '#1e40af', marginTop: '5px' }}>Litri d'Acqua Risparmiati</div>
                <p style={{ fontSize: '0.8rem', color: '#3b82f6', marginTop: '10px' }}>
                  L'irrigazione smart riduce il consumo idrico fino al 40% rispetto all'innaffiatura manuale.
                </p>
              </div>

              {/* Ossigeno Generato */}
              <div style={{ 
                padding: '35px 25px', borderRadius: '16px', textAlign: 'center',
                background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                boxShadow: '0 4px 15px rgba(34, 197, 94, 0.1)'
              }}>
                <Wind size={40} style={{ color: '#22c55e', marginBottom: '15px' }} />
                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#166534', lineHeight: 1 }}>
                  {globalOxygen >= 1000 ? `${(globalOxygen / 1000).toFixed(1)}K` : globalOxygen.toFixed(0)}
                </div>
                <div style={{ fontSize: '1.1rem', color: '#166534', marginTop: '5px' }}>Grammi di O₂ Generati</div>
                <p style={{ fontSize: '0.8rem', color: '#22c55e', marginTop: '10px' }}>
                  Le piante curate producono ossigeno in modo continuo, migliorando la qualità dell'aria domestica.
                </p>
              </div>

              {/* CO2 Assorbita */}
              <div style={{ 
                padding: '35px 25px', borderRadius: '16px', textAlign: 'center',
                background: 'linear-gradient(135deg, #fefce8, #fef9c3)',
                boxShadow: '0 4px 15px rgba(202, 138, 4, 0.1)'
              }}>
                <Leaf size={40} style={{ color: '#ca8a04', marginBottom: '15px' }} />
                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#854d0e', lineHeight: 1 }}>
                  {globalCO2Absorbed >= 1000 ? `${(globalCO2Absorbed / 1000).toFixed(1)}K` : globalCO2Absorbed.toFixed(0)}
                </div>
                <div style={{ fontSize: '1.1rem', color: '#854d0e', marginTop: '5px' }}>Grammi di CO₂ Assorbiti</div>
                <p style={{ fontSize: '0.8rem', color: '#ca8a04', marginTop: '10px' }}>
                  Ogni pianta viva assorbe anidride carbonica, contribuendo a un ambiente più pulito.
                </p>
              </div>
            </div>
          </FadeIn>

          {/* Statistiche Community */}
          <FadeIn>
            <div style={{ 
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px',
              padding: '30px', borderRadius: '16px', background: 'var(--bg-card)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
            }}>
              <div style={{ textAlign: 'center', padding: '15px' }}>
                <Users size={28} style={{ color: 'var(--accent-green)', marginBottom: '8px' }} />
                <div style={{ fontSize: '1.8rem', fontWeight: '800' }}>{userCount}</div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>Utenti Registrati</div>
              </div>
              <div style={{ textAlign: 'center', padding: '15px' }}>
                <Sprout size={28} style={{ color: 'var(--accent-green)', marginBottom: '8px' }} />
                <div style={{ fontSize: '1.8rem', fontWeight: '800' }}>{devCount}</div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>Vasi Attivi</div>
              </div>
              <div style={{ textAlign: 'center', padding: '15px' }}>
                <Droplets size={28} style={{ color: '#3b82f6', marginBottom: '8px' }} />
                <div style={{ fontSize: '1.8rem', fontWeight: '800' }}>{(totalOrders || 0)}</div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>Ordini Completati</div>
              </div>
            </div>
          </FadeIn>

          {/* Sezione Messaggio */}
          <FadeIn>
            <div style={{ 
              marginTop: '50px', padding: '40px', borderRadius: '16px', textAlign: 'center',
              background: 'linear-gradient(135deg, #14532d, #166534)',
              color: 'white'
            }}>
              <Sprout size={40} style={{ marginBottom: '15px', opacity: 0.9 }} />
              <h2 style={{ fontSize: '1.8rem', marginBottom: '15px' }}>Unisciti alla Rivoluzione Verde</h2>
              <p style={{ maxWidth: '550px', margin: '0 auto 25px', opacity: 0.9, lineHeight: 1.6 }}>
                Ogni vaso PLANT è un piccolo ecosistema che lavora per te e per il pianeta.
                Risparmia acqua, crea ossigeno, assorbi CO₂. Tutto in automatico.
              </p>
              <a href="/prodotti" className="btn" style={{ 
                background: 'white', color: '#166534', padding: '12px 28px', borderRadius: '8px',
                fontWeight: '600', textDecoration: 'none', display: 'inline-block'
              }}>
                Scopri i Vasi PLANT
              </a>
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
  );
}
