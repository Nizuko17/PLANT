'use client';

import FadeIn from '@/components/FadeIn';
import { useCart } from '@/context/CartContext';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SuccessContent() {
  const { cart, clearCart, cartTotal } = useCart();
  const [orderSaved, setOrderSaved] = useState(false);
  const hasSaved = useRef(false);
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const saveOrder = async () => {
      if (hasSaved.current || cart.length === 0) return;
      hasSaved.current = true;

      try {
        await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: cart, totalAmount: cartTotal }),
        });
        setOrderSaved(true);
        clearCart();
      } catch (err) {
        console.error('Error saving order:', err);
      }
    };

    saveOrder();
  }, [cart, cartTotal, clearCart]);

  return (
    <main>
      <section className="page-hero text-center" style={{ padding: '120px 0 80px' }}>
        <div className="container">
          <FadeIn>
            <div style={{ 
              width: '100px', height: '100px', borderRadius: '50%', 
              background: 'linear-gradient(135deg, #4ade80, #22c55e)',
              margin: '0 auto 30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 10px 30px rgba(74, 222, 128, 0.3)'
            }}>
              <span style={{ fontSize: '48px' }}>🌱</span>
            </div>
            <h1 className="hero-title" style={{ fontSize: '2.5rem' }}>Pagamento Riuscito!</h1>
            <p className="hero-subtitle" style={{ maxWidth: '500px', margin: '0 auto' }}>
              Il tuo ordine è stato registrato con successo. 
              Grazie per sostenere il verde in casa con noi.
            </p>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '35px', flexWrap: 'wrap' }}>
              <a href="/ordini" className="btn btn-primary">I miei Ordini</a>
              <a href="/prodotti" className="btn btn-secondary" style={{ border: '1px solid #ddd' }}>Continua lo shopping</a>
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="container text-center" style={{ padding: '120px 0' }}>Caricamento...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
