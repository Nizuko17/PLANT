'use client';

import FadeIn from '@/components/FadeIn';
import { createClient } from '@/utils/supabase/client';
import { useState } from 'react';
import Link from 'next/link';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const supabase = createClient();

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/account/update-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Ti abbiamo inviato un link via email per reimpostare la password. Controlla la posta in arrivo e cliccalo.');
    }
    
    setLoading(false);
  };

  return (
    <main>
      <section className="page-hero text-center">
        <div className="container">
          <FadeIn>
            <h1 className="hero-title">Recupera Password</h1>
            <p className="hero-subtitle">Ti invieremo un link per accedere nuovamente al tuo account.</p>
          </FadeIn>
        </div>
      </section>

      <section className="account-section">
        <div className="container">
          <div className="account-grid" style={{ display: 'flex', justifyContent: 'center' }}>
            <FadeIn className="account-card" style={{ width: '100%', maxWidth: '400px' }}>
              <h3>Hai dimenticato la password?</h3>
              {error && <p style={{ color: 'red', fontSize: '0.9rem', marginBottom: '16px' }}>{error}</p>}
              {message && <p style={{ color: 'var(--accent-green)', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '16px' }}>{message}</p>}
              
              {!message && (
                <form onSubmit={handleReset} className="account-form">
                  <div className="form-group">
                    <label htmlFor="email">La tua email registrata</label>
                    <input 
                      type="email" 
                      id="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tuaemail@esempio.com" 
                      required 
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                    {loading ? 'Invio in corso...' : 'Invia Link di Recupero'}
                  </button>
                </form>
              )}
              <p className="form-note">
                <Link href="/account">Torna al Login</Link>
              </p>
            </FadeIn>
          </div>
        </div>
      </section>
    </main>
  );
}
