'use client';

import FadeIn from '@/components/FadeIn';
import { createClient } from '@/utils/supabase/client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  const supabase = createClient();

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('La tua password è stata aggiornata con successo! Ritorno al profilo...');
      setTimeout(() => {
        router.push('/account/profilo');
      }, 3000);
    }
    
    setLoading(false);
  };

  return (
    <main>
      <section className="page-hero text-center">
        <div className="container">
          <FadeIn>
            <h1 className="hero-title">Nuova Password</h1>
            <p className="hero-subtitle">Inserisci una nuova password sicura per il tuo account.</p>
          </FadeIn>
        </div>
      </section>

      <section className="account-section">
        <div className="container">
          <div className="account-grid" style={{ display: 'flex', justifyContent: 'center' }}>
            <FadeIn className="account-card" style={{ width: '100%', maxWidth: '400px' }}>
              <h3>Scegli la nuova Password</h3>
              {error && <p style={{ color: 'red', fontSize: '0.9rem', marginBottom: '16px' }}>{error}</p>}
              {message && <p style={{ color: 'var(--accent-green)', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '16px' }}>{message}</p>}
              
              {!message && (
                <form onSubmit={handleUpdate} className="account-form">
                  <div className="form-group">
                    <label htmlFor="password">Nuova password</label>
                    <input 
                      type="password" 
                      id="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Digita la nuova password..." 
                      required 
                      minLength={6}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                    {loading ? 'Aggiornamento in corso...' : 'Aggiorna Password'}
                  </button>
                </form>
              )}
            </FadeIn>
          </div>
        </div>
      </section>
    </main>
  );
}
