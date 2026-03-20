'use client';

import FadeIn from '@/components/FadeIn';
import Model3D from '@/components/Model3D';
import { Cpu, Server, Wifi, Database, Search, ArrowRight, Layers, FileJson } from 'lucide-react';

export default function SchemaTecnico() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-color)', paddingBottom: '80px' }}>
      <section className="page-hero text-center" style={{ paddingBottom: '50px', paddingTop: '60px' }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          <FadeIn>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '60px', height: '60px', borderRadius: '20px',
              background: 'var(--accent-green-light)', color: 'var(--accent-green)',
              marginBottom: '20px'
            }}>
              <Layers size={30} />
            </div>
            <h1 className="hero-title" style={{ fontSize: '3rem', marginBottom: '20px' }}>Schema Tecnico</h1>
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

        <FadeIn delay={0.15}>
          <div style={{
            background: 'var(--card-bg)', borderRadius: '24px', padding: '40px',
            border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)',
            marginBottom: '40px'
          }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cpu size={24} color="#8b5cf6" /> Schema Elettrico (Mega 2560 + NodeMCU)
            </h2>
            <div style={{ width: '100%', overflowX: 'auto', display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
              <WiringDiagram />
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div style={{
            background: 'var(--card-bg)', borderRadius: '24px', padding: '40px',
            border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)'
          }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileJson size={24} color="#f59e0b" /> Struttura Dati API (JSON Payload) - Endpoint: /api/data
            </h2>
            <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '0.85rem', overflowX: 'auto', lineHeight: '1.6' }}>
<pre style={{ margin: 0 }}>
{`{
  "device_name": "PLANT NodeMCU",
  "mac": "XX:XX:XX:XX:XX:XX",
  "temperature": {
    "value": 24.5,
    "unit": "C",
    "online": true
  },
  "humidity": {
    "value": 45.2,
    "unit": "%"
  },
  "ph": {
    "value": 6.8,
    "unit": "pH"
  },
  "pump": {
    "on": false,
    "speed": 80,
    "last_on": "2026-03-20T10:00:00Z"
  },
  "buzzer": {
    "on": false,
    "frequency": 1000
  },
  "button": {
    "pressed": false
  },
  "network": {
    "mega_online": true,
    "data_age": 150
  }
}`}
</pre>
            </div>
            
            <h3 style={{ marginTop: '30px', fontSize: '1.1rem', marginBottom: '15px' }}>Endpoint di Controllo (/api/set)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
              <div style={{ padding: '15px', background: 'var(--bg-alt)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <span style={{ display: 'inline-block', padding: '3px 8px', background: '#3b82f6', color: 'white', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '8px' }}>GET</span>
                <code style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '8px' }}>?target=pump&on=true&speed=80</code>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Attiva la pompa di irrigazione a una velocità specifica.</p>
              </div>
              <div style={{ padding: '15px', background: 'var(--bg-alt)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <span style={{ display: 'inline-block', padding: '3px 8px', background: '#3b82f6', color: 'white', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '8px' }}>GET</span>
                <code style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '8px' }}>?target=buzzer&on=true&freq=1500</code>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Fai suonare il buzzer alla frequenza prestabilita.</p>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>
    </main>
  );
}

function WiringDiagram() {
  return (
    <svg width="100%" viewBox="0 0 680 820" xmlns="http://www.w3.org/2000/svg" style={{ maxWidth: '680px', margin: '0 auto', display: 'block', background: '#0f1117', borderRadius: '16px', padding: '24px' }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>
      </defs>

      {/* BREADBOARD */}
      <rect x="180" y="60" width="310" height="600" rx="10" fill="#1a1f2e" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
      <rect x="180" y="60" width="310" height="12" rx="10" fill="rgba(255,255,255,0.1)" stroke="none"/>
      <rect x="180" y="648" width="310" height="12" rx="5" fill="rgba(255,255,255,0.1)" stroke="none"/>
      <line x1="200" y1="120" x2="480" y2="120" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"/>
      <line x1="200" y1="180" x2="480" y2="180" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"/>
      <line x1="200" y1="300" x2="480" y2="300" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"/>
      <line x1="200" y1="450" x2="480" y2="450" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"/>
      <line x1="200" y1="560" x2="480" y2="560" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"/>
      <text fontSize="12" fontFamily="sans-serif" x="335" y="80" textAnchor="middle" fill="rgba(255,255,255,0.25)">BREADBOARD</text>

      {/* RESISTORI partitore */}
      <rect x="208" y="250" width="36" height="14" rx="4" fill="#BA7517" stroke="#633806" strokeWidth="1"/>
      <text fontSize="11" fontFamily="sans-serif" x="226" y="260" textAnchor="middle" fill="#FAEEDA">1kΩ</text>
      <rect x="208" y="275" width="36" height="14" rx="4" fill="#BA7517" stroke="#633806" strokeWidth="1"/>
      <text fontSize="11" fontFamily="sans-serif" x="226" y="285" textAnchor="middle" fill="#FAEEDA">2kΩ</text>

      {/* ARDUINO MEGA 2560 */}
      <rect x="10" y="320" width="158" height="260" rx="10" fill="#1a3a6e" stroke="#3b6cbf" strokeWidth="2"/>
      <rect x="10" y="320" width="158" height="22" rx="10" fill="#2563eb"/>
      <rect x="10" y="330" width="158" height="12" rx="0" fill="#2563eb"/>
      <text fontSize="11" fontWeight="500" fontFamily="sans-serif" x="89" y="336" textAnchor="middle" fill="#dbeafe">ARDUINO MEGA 2560</text>
      <text fontSize="11" fontFamily="sans-serif" x="22" y="370" fill="#93c5fd">D2</text>
      <text fontSize="11" fontFamily="sans-serif" x="22" y="395" fill="#a5b4fc">TX1·18</text>
      <text fontSize="11" fontFamily="sans-serif" x="22" y="420" fill="#6ee7b7">RX1·19</text>
      <text fontSize="11" fontFamily="sans-serif" x="22" y="445" fill="#c4b5fd">A2</text>
      <text fontSize="11" fontFamily="sans-serif" x="22" y="470" fill="#f9a8d4">D4</text>
      <text fontSize="11" fontFamily="sans-serif" x="22" y="495" fill="#9ca3af">GND</text>
      <text fontSize="11" fontFamily="sans-serif" x="22" y="520" fill="#fca5a5">5V</text>
      <circle cx="168" cy="366" r="4" fill="#fbbf24" stroke="#92400e" strokeWidth="1"/>
      <circle cx="168" cy="391" r="4" fill="#a5b4fc" stroke="#3730a3" strokeWidth="1"/>
      <circle cx="168" cy="416" r="4" fill="#6ee7b7" stroke="#065f46" strokeWidth="1"/>
      <circle cx="168" cy="441" r="4" fill="#c4b5fd" stroke="#5b21b6" strokeWidth="1"/>
      <circle cx="168" cy="466" r="4" fill="#f9a8d4" stroke="#9d174d" strokeWidth="1"/>
      <circle cx="168" cy="491" r="4" fill="#9ca3af" stroke="#374151" strokeWidth="1"/>
      <circle cx="168" cy="516" r="4" fill="#fca5a5" stroke="#991b1b" strokeWidth="1"/>

      {/* NodeMCU LoLin */}
      <rect x="512" y="100" width="148" height="220" rx="10" fill="#14532d" stroke="#16a34a" strokeWidth="2"/>
      <rect x="512" y="100" width="148" height="22" rx="10" fill="#16a34a"/>
      <rect x="512" y="110" width="148" height="12" rx="0" fill="#16a34a"/>
      <text fontSize="11" fontWeight="500" fontFamily="sans-serif" x="586" y="116" textAnchor="middle" fill="#dcfce7">NodeMCU</text>
      <text fontSize="11" fontFamily="sans-serif" x="586" y="130" textAnchor="middle" fill="#86efac">ESP8266 LoLin v3</text>
      <text fontSize="11" fontFamily="sans-serif" x="645" y="168" fill="#6ee7b7" textAnchor="end">RX</text>
      <text fontSize="11" fontFamily="sans-serif" x="645" y="193" fill="#a5b4fc" textAnchor="end">TX</text>
      <text fontSize="11" fontFamily="sans-serif" x="645" y="218" fill="#fca5a5" textAnchor="end">VIN</text>
      <text fontSize="11" fontFamily="sans-serif" x="645" y="243" fill="#9ca3af" textAnchor="end">GND</text>
      <circle cx="512" cy="164" r="4" fill="#6ee7b7" stroke="#065f46" strokeWidth="1"/>
      <circle cx="512" cy="189" r="4" fill="#a5b4fc" stroke="#3730a3" strokeWidth="1"/>
      <circle cx="512" cy="214" r="4" fill="#fca5a5" stroke="#991b1b" strokeWidth="1"/>
      <circle cx="512" cy="239" r="4" fill="#9ca3af" stroke="#374151" strokeWidth="1"/>

      {/* DHT11 */}
      <rect x="30" y="100" width="100" height="70" rx="8" fill="#78350f" stroke="#d97706" strokeWidth="1.5"/>
      <text fontSize="12" fontWeight="500" fontFamily="sans-serif" x="80" y="125" textAnchor="middle" fill="#fde68a">DHT11</text>
      <text fontSize="11" fontFamily="sans-serif" x="80" y="143" textAnchor="middle" fill="#fcd34d">Temp/Umidità</text>
      <circle cx="130" cy="152" r="4" fill="#fbbf24" stroke="#92400e" strokeWidth="1"/>
      <text fontSize="11" fontFamily="sans-serif" x="22" y="156" fill="#fcd34d">Signal</text>

      {/* pH Sensor pH-4502C */}
      <rect x="30" y="580" width="110" height="80" rx="8" fill="#3b1f6b" stroke="#7c3aed" strokeWidth="1.5"/>
      <text fontSize="12" fontWeight="500" fontFamily="sans-serif" x="85" y="605" textAnchor="middle" fill="#e9d5ff">pH-4502C</text>
      <text fontSize="11" fontFamily="sans-serif" x="85" y="622" textAnchor="middle" fill="#c4b5fd">Sensore pH</text>
      <circle cx="140" cy="632" r="4" fill="#c4b5fd" stroke="#5b21b6" strokeWidth="1"/>
      <text fontSize="11" fontFamily="sans-serif" x="22" y="636" fill="#c4b5fd">OUT</text>
      <circle cx="140" cy="648" r="4" fill="#fca5a5" stroke="#991b1b" strokeWidth="1"/>
      <text fontSize="11" fontFamily="sans-serif" x="22" y="652" fill="#fca5a5">5V</text>
      <circle cx="140" cy="663" r="4" fill="#9ca3af" stroke="#374151" strokeWidth="1"/>
      <text fontSize="11" fontFamily="sans-serif" x="22" y="667" fill="#9ca3af">GND</text>

      {/* TFT Monitor */}
      <rect x="530" y="370" width="130" height="70" rx="8" fill="#164e63" stroke="#0891b2" strokeWidth="1.5"/>
      <text fontSize="12" fontWeight="500" fontFamily="sans-serif" x="595" y="398" textAnchor="middle" fill="#cffafe">Monitor TFT</text>
      <text fontSize="11" fontFamily="sans-serif" x="595" y="415" textAnchor="middle" fill="#67e8f9">ON/OFF ctrl</text>
      <circle cx="530" cy="408" r="4" fill="#22d3ee" stroke="#0e7490" strokeWidth="1"/>

      {/* Relay / MOSFET */}
      <rect x="530" y="490" width="130" height="70" rx="8" fill="#500724" stroke="#be185d" strokeWidth="1.5"/>
      <text fontSize="12" fontWeight="500" fontFamily="sans-serif" x="595" y="515" textAnchor="middle" fill="#fce7f3">Relay/MOSFET</text>
      <text fontSize="11" fontFamily="sans-serif" x="595" y="532" textAnchor="middle" fill="#f9a8d4">→ VIN NodeMCU</text>
      <circle cx="530" cy="524" r="4" fill="#f9a8d4" stroke="#9d174d" strokeWidth="1"/>

      {/* FILI */}
      {/* DHT11 Signal → D2 */}
      <path d="M130,152 L178,152 L178,366 L168,366" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#arrow)"/>
      <text fontSize="11" fontFamily="sans-serif" x="162" y="148" textAnchor="middle" fill="#fbbf24">D2</text>

      {/* Mega TX1(18) → partitore → NodeMCU RX */}
      <path d="M168,391 L226,391 L226,264" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M226,250 L226,220 L512,220 L512,164" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#arrow)"/>
      <text fontSize="11" fontFamily="sans-serif" x="370" y="210" textAnchor="middle" fill="#a5b4fc">TX1→RX  (via 1kΩ+2kΩ)</text>

      {/* Mega RX1(19) ← NodeMCU TX */}
      <path d="M168,416 L300,416 L300,380 L512,380 L512,189" fill="none" stroke="#6ee7b7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#arrow)"/>
      <text fontSize="11" fontFamily="sans-serif" x="370" y="376" textAnchor="middle" fill="#6ee7b7">TX→RX1  (diretto)</text>

      {/* pH OUT → A2 */}
      <path d="M140,632 L178,632 L178,441 L168,441" fill="none" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#arrow)"/>
      <text fontSize="11" fontFamily="sans-serif" x="165" y="628" textAnchor="end" fill="#c4b5fd">A2</text>

      {/* D4 → Relay */}
      <path d="M168,466 L490,466 L490,524 L530,524" fill="none" stroke="#f9a8d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#arrow)"/>

      {/* Relay OUT → NodeMCU VIN */}
      <path d="M530,524 L505,524 L505,214 L512,214" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#arrow)"/>

      {/* D10 → TFT */}
      <path d="M440,230 L490,230 L490,408 L530,408" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#arrow)"/>
      <circle cx="440" cy="230" r="5" fill="#22d3ee" stroke="#0e7490" strokeWidth="1"/>
      <text fontSize="11" fontFamily="sans-serif" x="440" y="220" textAnchor="middle" fill="#22d3ee">D10</text>

      {/* GND comune */}
      <path d="M168,491 L500,491 L500,239 L512,239" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="6,3" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#arrow)"/>
      <text fontSize="11" fontFamily="sans-serif" x="340" y="503" textAnchor="middle" fill="#9ca3af">GND comune</text>

      {/* 5V pH sensor */}
      <path d="M140,648 L178,648 L178,516 L168,516" fill="none" stroke="#fca5a5" strokeWidth="1.5" strokeDasharray="4,3" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#arrow)"/>

      {/* LEGENDA */}
      <rect x="15" y="716" width="648" height="92" rx="8" fill="#1a1f2e" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
      <text fontSize="13" fontWeight="500" fontFamily="sans-serif" x="339" y="736" textAnchor="middle" fill="#e8e6de">Legenda</text>
      <line x1="30" y1="752" x2="58" y2="752" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round"/>
      <text fontSize="11" fontFamily="sans-serif" x="64" y="756" fill="#a8a49c">TX Serial (via partitore)</text>
      <line x1="210" y1="752" x2="238" y2="752" stroke="#6ee7b7" strokeWidth="2.5" strokeLinecap="round"/>
      <text fontSize="11" fontFamily="sans-serif" x="244" y="756" fill="#a8a49c">RX Serial (diretto)</text>
      <line x1="380" y1="752" x2="408" y2="752" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round"/>
      <text fontSize="11" fontFamily="sans-serif" x="414" y="756" fill="#a8a49c">DHT11 signal</text>
      <line x1="510" y1="752" x2="538" y2="752" stroke="#c4b5fd" strokeWidth="2.5" strokeLinecap="round"/>
      <text fontSize="11" fontFamily="sans-serif" x="544" y="756" fill="#a8a49c">pH analog</text>
      <line x1="30" y1="776" x2="58" y2="776" stroke="#f9a8d4" strokeWidth="2.5" strokeLinecap="round"/>
      <text fontSize="11" fontFamily="sans-serif" x="64" y="780" fill="#a8a49c">Relay ctrl (D4)</text>
      <line x1="210" y1="776" x2="238" y2="776" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round"/>
      <text fontSize="11" fontFamily="sans-serif" x="244" y="780" fill="#a8a49c">TFT ctrl (D10)</text>
      <line x1="380" y1="776" x2="408" y2="776" stroke="#fca5a5" strokeWidth="2.5" strokeLinecap="round"/>
      <text fontSize="11" fontFamily="sans-serif" x="414" y="780" fill="#a8a49c">VIN / 5V alimentazione</text>
      <line x1="510" y1="772" x2="538" y2="772" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="6,3" strokeLinecap="round"/>
      <text fontSize="11" fontFamily="sans-serif" x="544" y="780" fill="#a8a49c">GND comune</text>
    </svg>
  );
}
