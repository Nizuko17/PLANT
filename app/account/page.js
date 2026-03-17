'use client';

import FadeIn from '@/components/FadeIn';
import { createClient } from '@/utils/supabase/client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Account() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  const supabase = createClient();



  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name }
          }
        });
        if (error) throw error;
        // Se non creiamo backend table profiles, salviamo solo in auth.users
        alert('Registrazione completata! Verifica la tua email se richiesto.');
      }
      router.push('/account/profilo');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <section className="page-hero text-center">
        <div className="container">
          <FadeIn>
            <h1 className="hero-title">Il tuo Account</h1>
            <p className="hero-subtitle">Accedi per gestire i tuoi ordini e le tue piante.</p>
          </FadeIn>
        </div>
      </section>

      <section className="account-section">
        <div className="container">
          <div className="account-grid" style={{ display: 'flex', justifyContent: 'center' }}>
            <FadeIn className="account-card" style={{ width: '100%', maxWidth: '400px' }}>
              <h3>{isLogin ? 'Accedi' : 'Registrati'}</h3>
              {error && <p style={{ color: 'red', fontSize: '0.9rem', marginBottom: '16px' }}>{error}</p>}
              <form onSubmit={handleAuth} className="account-form">
                {!isLogin && (
                  <div className="form-group">
                    <label htmlFor="regName">Nome completo</label>
                    <input 
                      type="text" 
                      id="regName" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Mario Rossi" 
                      required={!isLogin} 
                    />
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input 
                    type="email" 
                    id="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tuaemail@esempio.com" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input 
                    type="password" 
                    id="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isLogin ? "La tua password" : "Crea una password"} 
                    required 
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                  {loading ? 'Caricamento...' : (isLogin ? 'Accedi' : 'Crea account')}
                </button>
              </form>
              <p className="form-note">
                <a href="/account/reset-password" style={{ display: 'block', marginBottom: '8px' }}>Hai dimenticato la password?</a>
                {isLogin ? "Non hai un account? " : "Hai già un account? "}
                <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(!isLogin); }}>
                  {isLogin ? 'Registrati' : 'Accedi'}
                </a>
              </p>
            </FadeIn>
          </div>
        </div>
      </section>
    </main>
  );
}
