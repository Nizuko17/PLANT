import FadeIn from '@/components/FadeIn';

export const metadata = {
  title: 'Lavora con Noi | PLANT',
  description: 'Unisciti al team PLANT e aiutaci a portare la natura in ogni casa.',
};

export default function LavoraConNoi() {
  return (
    <main>
      <section className="page-hero text-center">
        <div className="container">
          <FadeIn>
            <h1 className="hero-title">Lavora con Noi</h1>
            <p className="hero-subtitle">Cerchiamo talenti per crescere assieme.</p>
          </FadeIn>
        </div>
      </section>

      <section className="account-section">
        <div className="container" style={{ maxWidth: '800px' }}>
          <FadeIn className="account-card">
            <h3>Posizioni aperte</h3>
            <div style={{ marginTop: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', marginBottom: '20px' }}>
              <h4>Frontend Developer (React/Next.js)</h4>
              <p className="form-note">Milano / Ibrido</p>
              <p style={{ marginTop: '10px' }}>Cerchiamo uno sviluppatore con esperienza in Next.js e cura del design per migliorare l'esperienza utente.</p>
              <a href="#" className="btn btn-secondary" style={{ marginTop: '15px' }}>Candidati</a>
            </div>
            <div style={{ paddingBottom: '20px' }}>
              <h4>Hardware Engineer</h4>
              <p className="form-note">Torino / Presenza</p>
              <p style={{ marginTop: '10px' }}>Progettazione nuova sensoristica IoT per la gamma PLANT Pro e Max.</p>
              <a href="#" className="btn btn-secondary" style={{ marginTop: '15px' }}>Candidati</a>
            </div>
            
            <h3 style={{ marginTop: '40px' }}>Candidatura spontanea</h3>
            <p>Non vedi la posizione adatta? Inviaci il tuo CV a <strong>lavoro@plant.it</strong></p>
          </FadeIn>
        </div>
      </section>
    </main>
  );
}
