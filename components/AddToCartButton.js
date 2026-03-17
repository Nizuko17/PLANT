'use client';

import { useCart } from '@/context/CartContext';
import { ShoppingBag, Check } from 'lucide-react';
import { useState } from 'react';

export default function AddToCartButton({ product, text = "Aggiungi al Carrello", className = "btn btn-primary" }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    addToCart(product);
    setAdded(true);
    
    setTimeout(() => {
      setAdded(false);
    }, 2000);
  };

  return (
    <button 
      onClick={handleAdd} 
      className={className} 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: '8px', 
        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        transform: added ? 'scale(1.05)' : 'scale(1)',
        background: added ? 'var(--accent-green)' : '',
        borderColor: added ? 'var(--accent-green)' : ''
      }}
    >
      {added ? <Check size={18} /> : <ShoppingBag size={18} />}
      {added ? 'Aggiunto!' : text}
    </button>
  );
}
