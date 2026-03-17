import FadeIn from '@/components/FadeIn';

export const metadata = {
  title: 'Privacy Policy | PLANT',
  description: 'Informativa sulla privacy di PLANT e trattamento dei dati.',
};

export default function PrivacyPolicy() {
  return (
    <main>
      <section className="page-hero text-center">
        <div className="container">
          <FadeIn>
            <h1 className="hero-title">Privacy Policy</h1>
            <p className="hero-subtitle">Il tuo verde è privato, e anche i tuoi dati.</p>
          </FadeIn>
        </div>
      </section>

      <section className="account-section">
        <div className="container" style={{ maxWidth: '800px' }}>
          <FadeIn className="account-card" style={{ padding: '40px' }}>
            <h3>Informativa sul trattamento dei Dati Personali</h3>
            <p className="form-note">Ultimo aggiornamento: 17 Marzo 2026</p>
            
            <h4 style={{ marginTop: '30px' }}>1. Dati Raccolti</h4>
            <p style={{ marginTop: '10px' }}>Raccogliamo informazioni sull'umidità e salute delle piante per fornire previsioni accurate, assieme ai dati base dell'account in fase di registrazione.</p>

            <h4 style={{ marginTop: '30px' }}>2. Utilizzo e Protezione</h4>
            <p style={{ marginTop: '10px' }}>Non vendiamo alcun dato a terzi. Tutti i dati dei sensori vengono elaborati in Europa e protetti da crittografia end-to-end.</p>
            
            <h4 style={{ marginTop: '30px' }}>3. Diritti dell'utente</h4>
            <p style={{ marginTop: '10px' }}>Conformemente al GDPR, hai diritto di accedere o richiedere l'eliminazione dei tuoi dati in qualsiasi istante dalla pagina del profilo.</p>
          </FadeIn>
        </div>
      </section>
    </main>
  );
}
