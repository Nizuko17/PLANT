'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CheckoutButton({ productId, text = "Acquista", className = "btn btn-primary" }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        if(data.error === 'Devi effettuare il login per acquistare.') {
          alert('Devi effettuare l\'accesso per continuare l\'acquisto');
          router.push('/account');
        } else {
          alert(data.error || 'Errore durante il checkout');
        }
      }
    } catch (err) {
      alert('Impossibile contattare Stripe al momento.');
    }
    setLoading(false);
  };

  return (
    <button onClick={handleCheckout} disabled={loading} className={className}>
      {loading ? 'Caricamento...' : text}
    </button>
  );
}
