import FadeIn from '@/components/FadeIn';
import { Recycle, Leaf } from 'lucide-react';

export const metadata = {
  title: 'Sostenibilità | PLANT',
  description: 'Scopri il nostro impegno per un futuro più verde e sostenibile.',
};

export default function Sostenibilita() {
  return (
    <main>
      <section className="page-hero text-center">
        <div className="container">
          <FadeIn>
            <h1 className="hero-title">Il Nostro Impegno</h1>
            <p className="hero-subtitle">Per la natura, in ogni cosa che facciamo.</p>
          </FadeIn>
        </div>
      </section>

      <section className="features-section">
        <div className="container">
          <div className="feature-grid">
            <FadeIn className="feature-text text-center" style={{ maxWidth: '800px', margin: '0 auto' }}>
              <h2>Materiali Riciclati</h2>
              <p>Il 75% della plastica utilizzata per ricalcare le forme sinuose di PLANT proviene da scarti industriali recuperati.</p>
              <Recycle size={60} style={{ color: 'var(--accent-green)', margin: '40px auto 20px' }} />
              <p>Ogni vaso PLANT contribuisce alla rimozione di 2.5kg di CO2 dall'ambiente, sia tramite i processi di lavorazione ottimizzati, sia dando linfa a nuove piante domestiche.</p>
            </FadeIn>
          </div>
        </div>
      </section>
    </main>
  );
}
