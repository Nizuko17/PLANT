import FadeIn from '@/components/FadeIn';

export const metadata = {
  title: 'Termini di Servizio | PLANT',
  description: 'Condizioni d\'uso dei dispositivi e servizi PLANT.',
};

export default function TerminiDiServizio() {
  return (
    <main>
      <section className="page-hero text-center">
        <div className="container">
          <FadeIn>
            <h1 className="hero-title">Termini di Servizio</h1>
            <p className="hero-subtitle">Le condizioni per utilizzare i prodotti e l'App PLANT.</p>
          </FadeIn>
        </div>
      </section>

      <section className="account-section">
        <div className="container" style={{ maxWidth: '800px' }}>
          <FadeIn className="account-card" style={{ padding: '40px' }}>
            <h3>Condizioni d'Uso</h3>
            
            <h4 style={{ marginTop: '30px' }}>1. Accettazione</h4>
            <p style={{ marginTop: '10px' }}>L'utilizzo dell'app PLANT e dei dispositivi ad essa collegati comporta l'accettazione integrale dei presenti termini.</p>

            <h4 style={{ marginTop: '30px' }}>2. Limitazioni</h4>
            <p style={{ marginTop: '10px' }}>La garanzia legale copre 24 mesi da difetti di conformità. I danni da versamento di liquidi esterni sul circuito stampato non sono coperti.</p>
            
            <h4 style={{ marginTop: '30px' }}>3. Irrigazione Automatica</h4>
            <p style={{ marginTop: '10px' }}>L'algoritmo di irrigazione è uno strumento di supporto; PLANT declina responsabilità per eccesso o carenza d'acqua dovuta a calibrazione non idonea da parte dell'utente.</p>
          </FadeIn>
        </div>
      </section>
    </main>
  );
}
