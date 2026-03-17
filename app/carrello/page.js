'use client';

import FadeIn from '@/components/FadeIn';
import { useCart } from '@/context/CartContext';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Carrello() {
  const { cart, removeFromCart, updateQuantity, cartTotal, clearCart, cartCount } = useCart();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart }),
      });
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        if (data.error?.includes('login')) {
          alert('Devi effettuare l\'accesso per completare l\'acquisto.');
          router.push('/account');
        } else {
          alert(data.error || 'Errore durante il checkout');
        }
      }
    } catch (err) {
      alert('Impossibile contattare il servizio di pagamento.');
    }
    setLoading(false);
  };

  return (
    <main>
      <section className="page-hero text-center" style={{ paddingBottom: '30px' }}>
        <div className="container">
          <FadeIn>
            <h1 className="hero-title" style={{ fontSize: '2.5rem' }}>
              <ShoppingBag size={36} style={{ verticalAlign: 'middle', marginRight: '10px' }} />
              Il tuo Carrello
            </h1>
            <p className="hero-subtitle">{cartCount} {cartCount === 1 ? 'articolo' : 'articoli'}</p>
          </FadeIn>
        </div>
      </section>

      <section className="account-section" style={{ paddingTop: 0 }}>
        <div className="container">
          {cart.length === 0 ? (
            <FadeIn>
              <div className="account-card text-center" style={{ padding: '60px 20px' }}>
                <ShoppingBag size={60} style={{ color: '#ccc', marginBottom: '20px' }} />
                <h3>Il tuo carrello è vuoto</h3>
                <p style={{ color: '#666', marginBottom: '25px' }}>Esplora il nostro catalogo e aggiungi i prodotti che preferisci.</p>
                <a href="/prodotti" className="btn btn-primary">Scopri i prodotti</a>
              </div>
            </FadeIn>
          ) : (
            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
              {/* Lista articoli */}
              <div style={{ flex: '2 1 500px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {cart.map((item) => (
                    <FadeIn key={item.id}>
                      <div className="account-card" style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '20px', gap: '20px', flexWrap: 'wrap'
                      }}>
                        <div style={{ flex: '1 1 200px' }}>
                          <h4 style={{ margin: '0 0 5px' }}>{item.name}</h4>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>{item.description?.substring(0, 80)}...</p>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            style={{ 
                              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #ddd',
                              background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer' 
                            }}
                          >
                            <Minus size={16} />
                          </button>
                          <span style={{ fontWeight: '600', minWidth: '24px', textAlign: 'center' }}>{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            style={{ 
                              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #ddd',
                              background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer' 
                            }}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                        
                        <div style={{ fontWeight: '700', fontSize: '1.1rem', minWidth: '90px', textAlign: 'right' }}>
                          &euro; {(item.price * item.quantity).toFixed(2)}
                        </div>
                        
                        <button
                          onClick={() => removeFromCart(item.id)}
                          style={{ 
                            background: 'none', border: 'none', cursor: 'pointer', color: '#cc4444',
                            padding: '8px', display: 'flex', alignItems: 'center' 
                          }}
                          aria-label="Rimuovi"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </FadeIn>
                  ))}
                </div>
              </div>
              
              {/* Riepilogo */}
              <div style={{ flex: '1 1 300px' }}>
                <FadeIn>
                  <div className="account-card" style={{ padding: '30px', position: 'sticky', top: '100px' }}>
                    <h3 style={{ marginTop: 0 }}>Riepilogo Ordine</h3>
                    <div style={{ borderTop: '1px solid #eee', paddingTop: '15px' }}>
                      {cart.map((item) => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.9rem' }}>
                          <span>{item.name} x{item.quantity}</span>
                          <span>&euro; {(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ 
                      borderTop: '2px solid var(--accent-green)', paddingTop: '15px', marginTop: '15px',
                      display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '1.2rem' 
                    }}>
                      <span>Totale</span>
                      <span>&euro; {cartTotal.toFixed(2)}</span>
                    </div>
                    <button 
                      onClick={handleCheckout} 
                      disabled={loading}
                      className="btn btn-primary btn-full"
                      style={{ marginTop: '25px', padding: '15px', fontSize: '1rem' }}
                    >
                      {loading ? 'Redirect a Stripe...' : 'Procedi al Pagamento'}
                    </button>
                    <button 
                      onClick={clearCart}
                      style={{ 
                        marginTop: '10px', width: '100%', padding: '10px', border: '1px solid #ddd',
                        borderRadius: '8px', background: 'transparent', cursor: 'pointer', color: '#666', fontSize: '0.85rem'
                      }}
                    >
                      Svuota Carrello
                    </button>
                  </div>
                </FadeIn>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
