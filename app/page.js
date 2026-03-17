import Link from 'next/link';
import Image from 'next/image';
import FadeIn from '@/components/FadeIn';
import { Leaf, Waves, Cpu, Droplets, Thermometer, Activity, Smartphone, ChevronDown } from 'lucide-react';

export default function Home() {
  return (
    <main>
      {/* Hero Section */}
      <section className="hero-section text-center">
        <div className="container">
          <FadeIn>
            <h1 className="hero-title">Natura ed eleganza,<br/>nelle tue mani.</h1>
            <p className="hero-subtitle">Scopri PLANT. Il vaso intelligente che si prende cura del tuo verde domestico.</p>
            <div className="hero-cta">
              <Link href="/prodotti" className="btn btn-primary">Acquista ora</Link>
              <a href="#scopri" className="btn btn-secondary">Scopri di più <ChevronDown size={18} /></a>
            </div>
          </FadeIn>
          <FadeIn className="mt-5">
            <div className="hero-image-wrapper">
              <Image src="/assets/hero.png" alt="PLANT - Vaso Intelligente" width={800} height={500} layout="responsive" className="hero-img" />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Product Presentation */}
      <section id="scopri" className="features-section">
        <div className="container">
          <div className="feature-grid">
            <FadeIn className="feature-text">
              <h2>Perfetto in ogni dettaglio.</h2>
              <p>Costruito con una struttura bicolore moderna: una parte superiore bianca opaca con il nostro iconico logo in rilievo, e una base verde chiaro semi-trasparente che rivela il futuro della cura botanica. Un design minimalista che si fonde perfettamente con l'estetica di casa tua.</p>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Tech Section */}
      <section className="tech-section bg-light">
        <div className="container">
          <div className="tech-grid">
            <FadeIn className="tech-image-wrapper">
              <Image src="/assets/tech.png" alt="Tecnologia interna" width={600} height={600} layout="responsive" className="tech-img" />
            </FadeIn>
            <FadeIn className="tech-text">
              <h2>Cervello smart,<br/>cuore verde.</h2>
              <p>All'interno del design pulito si nasconde una sofisticata tecnologia basata su sensori di precisione, per garantirti che le tue piante ricevano sempre le cure esatte di cui hanno bisogno.</p>
              <ul className="tech-list">
                <li><Droplets /> Monitoraggio umidità del terreno</li>
                <li><Thermometer /> Sensore temperatura integrato</li>
                <li><Activity /> Rilevamento costante del pH</li>
                <li><Smartphone /> Irrigazione automatica via App</li>
              </ul>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Environmental Impact Section */}
      <section className="impact-teaser-section text-center bg-light" style={{ padding: '80px 0' }}>
        <div className="container">
          <FadeIn>
            <div style={{ 
              display: 'inline-flex', padding: '8px 20px', borderRadius: '30px', 
              background: 'var(--accent-green-light)', color: '#166534',
              fontSize: '0.85rem', fontWeight: '600', marginBottom: '20px'
            }}>
              SOSTENIBILITÀ
            </div>
            <h2 style={{ marginBottom: '20px' }}>Insieme per un pianeta più verde.</h2>
            <p style={{ maxWidth: '700px', margin: '0 auto 40px' }}>
              Ogni vaso PLANT non è solo un oggetto di design: è un alleato dell'ambiente. 
              Monitoriamo il risparmio idrico globale e la produzione di ossigeno della nostra community.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginBottom: '40px', maxWidth: '800px', margin: '0 auto 40px' }}>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--accent-green)' }}>+150K</div>
                <div style={{ fontSize: '0.9rem', color: '#86868b' }}>Litri Risparmiati</div>
              </div>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--accent-green)' }}>+2.4T</div>
                <div style={{ fontSize: '0.9rem', color: '#86868b' }}>O₂ Generato</div>
              </div>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--accent-green)' }}>100%</div>
                <div style={{ fontSize: '0.9rem', color: '#86868b' }}>Digital & Green</div>
              </div>
            </div>
            <Link href="/impatto" className="btn btn-primary">Scopri il nostro impatto</Link>
          </FadeIn>
        </div>
      </section>

      {/* Mission Highlights */}
      <section className="mission-section text-center">
        <div className="container">
          <FadeIn>
            <h2>La nostra Missione</h2>
          </FadeIn>
          <div className="mission-cards">
            <FadeIn className="mission-card">
              <Leaf />
              <h4>Cura del verde</h4>
              <p>Riportiamo la natura all'interno degli spazi urbani, offrendo alle tue piante l'ambiente perfetto per prosperare.</p>
            </FadeIn>
            <FadeIn className="mission-card">
              <Waves />
              <h4>Risparmio Idrico</h4>
              <p>Grazie all'irrigazione intelligente, PLANT fornisce acqua solo quando necessario, evitando sprechi.</p>
            </FadeIn>
            <FadeIn className="mission-card">
              <Cpu />
              <h4>Innovazione</h4>
              <p>Connettiamo la natura alla rete per offrirti un controllo totale tramite la nostra app dedicata.</p>
            </FadeIn>
          </div>
        </div>
      </section>
    </main>
  );
}
