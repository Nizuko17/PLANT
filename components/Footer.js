'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function Footer() {
  const supabase = createClient();
  const [dbStatus, setDbStatus] = useState('Verifica...');
  const [dbTimestamp, setDbTimestamp] = useState('');
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    // Check theme initially
    if (document.body.classList.contains('dark-mode')) {
      setTheme('dark');
    }
    
    // Set timestamp
    const now = new Date();
    setDbTimestamp(now.toLocaleString('it-IT', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }));

    // Check DB Connection
    const checkDb = async () => {
      try {
        // Interroghiamo la nuova tabella pubblica "status" per una verifica 100% reale
        const { data, error } = await supabase.from('status').select('*').limit(1);
        
        // Se non ci sono errori e la query risponde, siamo esplicitamente connessi al DB Supabase
        if (!error && data !== null) {
           setDbStatus('Connesso');
        } else {
           setDbStatus('Non connesso');
        }
      } catch (err) {
        setDbStatus('Non connesso');
      }
    };

    checkDb();
  }, []);

  const handleThemeToggle = () => {
    const isDark = document.body.classList.contains('dark-mode');
    if (isDark) {
      document.body.classList.remove('dark-mode');
      document.body.classList.add('light-mode');
      localStorage.setItem('plant-theme', 'light');
      setTheme('light');
    } else {
      document.body.classList.remove('light-mode');
      document.body.classList.add('dark-mode');
      localStorage.setItem('plant-theme', 'dark');
      setTheme('dark');
    }
  };

  return (
    <footer>
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <h4>Esplora</h4>
            <ul>
              <li><Link href="/">Home</Link></li>
              <li><Link href="/prodotti">Prodotti</Link></li>
              <li><Link href="/accessori">Accessori</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Account</h4>
            <ul>
              <li><Link href="/account">Il mio account</Link></li>
              <li><Link href="/ordini">Ordini e resi</Link></li>
              <li><Link href="/preferiti">Preferiti</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Azienda</h4>
            <ul>
              <li><Link href="/chi-siamo">Chi siamo</Link></li>
              <li><Link href="/lavora-con-noi">Lavora con noi</Link></li>
              <li><Link href="/sostenibilita">Sostenibilità</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Social</h4>
            <ul>
              <li><a href="#">Instagram</a></li>
              <li><a href="#">X (Twitter)</a></li>
              <li><a href="#">LinkedIn</a></li>
            </ul>
          </div>
        </div>

        {/* DB Status & Theme Toggle */}
        <div className="footer-status-bar">
          <div className="db-status">
            <span className={`db-status-dot ${dbStatus === 'Connesso' ? 'connected' : 'disconnected'}`}></span>
            Database: <strong>{dbStatus}</strong>
            {dbTimestamp && <span> &mdash; Ultimo check: {dbTimestamp}</span>}
          </div>
          <button 
            className="theme-toggle-btn" 
            onClick={handleThemeToggle}
            aria-label="Cambia tema"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            <span className="theme-label">Tema</span>
          </button>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2026 PLANT S.p.A. Tutti i diritti riservati.</p>
          <div className="legal-links">
            <Link href="/privacy">Privacy Policy</Link> | <Link href="/termini">Termini di Servizio</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
