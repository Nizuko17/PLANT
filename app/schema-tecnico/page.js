'use client';

import FadeIn from '@/components/FadeIn';
import Model3D from '@/components/Model3D';
import { Cpu, Server, Wifi, Database, Layers, ArrowRight, Monitor, Radio, Zap, Thermometer, Droplets, FlaskConical, Volume2, ToggleRight, PlusCircle } from 'lucide-react';

export default function SchemaTecnico() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-color)', paddingBottom: '80px' }}>
      <section className="page-hero text-center" style={{ paddingBottom: '50px', paddingTop: '60px' }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          <FadeIn>

            <h1 className="hero-title" style={{ fontSize: '3rem', marginBottom: '20px' }}>Scheda Tecnica</h1>
            <p className="hero-subtitle" style={{ fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
              Panoramica dell'architettura di sistema intelligente di PLANT, dai dispositivi fisici all'infrastruttura Cloud.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="container" style={{ maxWidth: '1000px' }}>
        <FadeIn delay={0.1}>
          <div style={{ marginBottom: '40px' }}>
            <Model3D />
          </div>
        </FadeIn>

        {/* Architettura High-Level */}
        <FadeIn delay={0.15}>
          <div style={{
            background: 'var(--card-bg)', borderRadius: '24px', padding: '40px',
            border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)',
            marginBottom: '40px'
          }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Server size={24} color="var(--accent-green)" /> Architettura High-Level
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* NodeMCU Device */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', background: 'var(--bg-alt)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Cpu size={24} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>Dispositivo Hardware (NodeMCU / Mega)</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Raccoglie i dati dai sensori (temperatura, umidità, pH), gestisce attuatori (pompa, buzzer) e fornisce un server API HTTP in rete locale.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ArrowRight size={24} color="var(--text-secondary)" style={{ transform: 'rotate(90deg)' }} />
              </div>

              {/* Local Network */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', background: 'var(--bg-alt)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Wifi size={24} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>Rete Locale / Discovery (UDP)</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    La web app usa richieste API serverless (Next.js) per inviare broadcast UDP e trovare automaticamente i dispositivi nella rete (pompa.local).
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ArrowRight size={24} color="var(--text-secondary)" style={{ transform: 'rotate(90deg)' }} />
              </div>

              {/* Cloud DB & Web App */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', background: 'var(--bg-alt)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Database size={24} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>Supabase / Next.js Web App</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    La piattaforma memorizza impostazioni e registrazioni su database PostgreSQL, e l'interfaccia React permette controllo in tempo reale con polling API ogni 3s verso gli IP salvati.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Dispositivi Hardware */}
        <FadeIn delay={0.2}>
          <div style={{
            background: 'var(--card-bg)', borderRadius: '24px', padding: '40px',
            border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)',
            marginBottom: '40px'
          }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cpu size={24} color="#8b5cf6" /> Dispositivi Hardware
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <HardwareCard
                icon={<Cpu size={22} />}
                title="Arduino Mega 2560"
                desc="Microcontrollore principale. Gestisce tutti i sensori e gli attuatori via I/O digitali e analogici."
                color="#2563eb"
                bg="#dbeafe"
              />
              <HardwareCard
                icon={<Wifi size={22} />}
                title="NodeMCU ESP8266 LoLin v3"
                desc="Bridge Wi-Fi. Comunica con il Mega via Serial e fornisce il server HTTP nella rete locale."
                color="#16a34a"
                bg="#dcfce7"
              />
              <HardwareCard
                icon={<Thermometer size={22} />}
                title="Sensore DHT11"
                desc="Rileva temperatura e umidità ambientale. Collegato al pin digitale D2 del Mega."
                color="#d97706"
                bg="#fef3c7"
              />
              <HardwareCard
                icon={<FlaskConical size={22} />}
                title="Sensore pH-4502C"
                desc="Misura il livello di acidità/basicità del terreno o dell'acqua. Collegato al pin analogico A2."
                color="#7c3aed"
                bg="#ede9fe"
              />
              <HardwareCard
                icon={<Volume2 size={22} />}
                title="Buzzer Piezoelettrico"
                desc="Emette allarmi sonori e melodie personalizzabili. Controllabile in frequenza e durata."
                color="#ea580c"
                bg="#ffedd5"
              />
              <HardwareCard
                icon={<ToggleRight size={22} />}
                title="Pulsante Fisico"
                desc="Pulsante hardware collegato al pin D7 per attivazione manuale diretta."
                color="#0891b2"
                bg="#cffafe"
              />
            </div>
          </div>
        </FadeIn>

        {/* Espandibilità */}
        <FadeIn delay={0.25}>
          <div style={{
            background: 'var(--card-bg)', borderRadius: '24px', padding: '40px',
            border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)'
          }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PlusCircle size={24} color="#10b981" /> Espandibilità
            </h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '30px' }}>
              PLANT è progettato per essere modulare. L'architettura aperta permette di aggiungere facilmente nuovi componenti al sistema:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <ExpansionCard
                icon={<Monitor size={22} />}
                title="Display TFT"
                items={['Schermo TFT ILI9488 3.5" SPI a colori', 'Schermi TFT/IPS di varie dimensioni', 'Dashboard locale personalizzabile', 'Interfaccia touch per controllo diretto']}
                color="#0284c7"
                bg="#e0f2fe"
              />
              <ExpansionCard
                icon={<Radio size={22} />}
                title="Sensori"
                items={['Sensore luminosità (LDR / BH1750)', 'Sensore umidità del suolo capacitivo', 'Sensore livello acqua nel serbatoio', 'Sensore qualità dell\'aria (MQ-135)']}
                color="#7c3aed"
                bg="#ede9fe"
              />
              <ExpansionCard
                icon={<Droplets size={22} />}
                title="Pompa Acqua"
                items={['Pompa per irrigazione automatica', 'Controllo tramite relay/MOSFET (es. pin D4)', 'Attivazione basata su timer o sensori']}
                color="#be185d"
                bg="#fce7f3"
              />
              <ExpansionCard
                icon={<Zap size={22} />}
                title="Dispositivi Smart"
                items={['Lampade LED grow-light controllabili', 'Valvole solenoidi per irrigazione multi-zona', 'Ventole PWM per circolazione aria', 'Modulo fotocamera per time-lapse']}
                color="#ea580c"
                bg="#ffedd5"
              />
            </div>
          </div>
        </FadeIn>
      </section>
    </main>
  );
}

function HardwareCard({ icon, title, desc, color, bg }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '15px', padding: '18px',
      background: 'var(--bg-alt)', borderRadius: '16px', border: '1px solid var(--border-color)',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}>
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px', background: bg, color: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        {icon}
      </div>
      <div>
        <h3 style={{ margin: '0 0 5px 0', fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</p>
      </div>
    </div>
  );
}

function ExpansionCard({ icon, title, items, color, bg }) {
  return (
    <div style={{
      padding: '22px', background: 'var(--bg-alt)', borderRadius: '16px',
      border: '1px solid var(--border-color)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px', background: bg, color: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          {icon}
        </div>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{title}</h3>
      </div>
      <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
