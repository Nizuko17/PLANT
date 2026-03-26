'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Image from 'next/image';

export default function Footer() {
  const supabase = createClient();
  const [dbStatus, setDbStatus] = useState('Verifica...');
  const [dbTimestamp, setDbTimestamp] = useState('');
  const [theme, setTheme] = useState('light');
  const pathname = usePathname();

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

  if (pathname === '/maintenance') return null;

  return (
    <footer>
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
              <Image 
                src="/assets/Logo.png" 
                alt="PLANT Logo" 
                width={30} 
                height={30} 
                style={{ objectFit: 'contain', height: '30px', width: 'auto' }}
              />
              <span style={{ 
                fontSize: '1.2rem', 
                fontWeight: '800', 
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)'
              }}>PLANT</span>
            </Link>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '200px' }}>
              Tecnologia e natura in perfetta armonia per la tua casa.
            </p>
          </div>
          <div className="footer-col">
            <h4>Esplora</h4>
            <ul>
              <li><Link href="/">Home</Link></li>
              <li><Link href="/prodotti">Prodotti</Link></li>
              <li><Link href="/news">News</Link></li>
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
            <h4>Risorse</h4>
            <ul>
              <li><Link href="/schema-tecnico">Scheda Tecnica</Link></li>
              <li><a href="https://gamma.app/docs/PLANT-nfza4jlmn09u2f3?mode=present" target="_blank" rel="noopener noreferrer">Presentazione</a></li>
              <li><Link href="/plant-game" style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>Plant.GAME</Link></li>
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
