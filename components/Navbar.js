'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, ShoppingBag } from 'lucide-react';
import { useCart } from '@/context/CartContext';

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { cartCount, isLoaded } = useCart();

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-logo">
          <Link href="/">PLANT</Link>
        </div>
        <ul className={`nav-links ${isMobileMenuOpen ? 'active' : ''}`}>
          <li><Link href="/" onClick={() => setIsMobileMenuOpen(false)}>Home</Link></li>
          <li><Link href="/prodotti" onClick={() => setIsMobileMenuOpen(false)}>Prodotti</Link></li>
          <li><Link href="/accessori" onClick={() => setIsMobileMenuOpen(false)}>Accessori</Link></li>
          <li><Link href="/account" onClick={() => setIsMobileMenuOpen(false)}>Account</Link></li>
          <li><Link href="/chi-siamo" onClick={() => setIsMobileMenuOpen(false)}>Chi siamo</Link></li>
        </ul>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link href="/carrello" style={{ position: 'relative', display: 'flex', alignItems: 'center', color: 'var(--text-dark)' }}>
            <ShoppingBag size={24} />
            {isLoaded && cartCount > 0 && (
              <span style={{
                position: 'absolute', top: '-8px', right: '-8px',
                background: 'var(--accent-green)', color: 'white',
                borderRadius: '50%', width: '20px', height: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 'bold'
              }}>
                {cartCount}
              </span>
            )}
          </Link>
          <button 
            className="mobile-menu-btn" 
            aria-label="Menu"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <Menu />
          </button>
        </div>
      </div>
    </nav>
  );
}
