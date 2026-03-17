'use client';

import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function FavoriteButton({ productId, initialIsFavorite = false }) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    // Check iniziale per vedere se l'utente ha il prodotto nei preferiti (evita props drilling)
    const checkFavorite = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('product_id', productId)
        .single();
        
      if (data) setIsFavorite(true);
    };
    
    checkFavorite();
  }, [productId, supabase]);

  const toggleFavorite = async (e) => {
    e.preventDefault();
    e.stopPropagation(); // Evita eventuali link wrapper
    
    if (loading) return;
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      alert("Per aggiungere un prodotto ai preferiti devi effettuare l'accesso.");
      router.push('/account');
      setLoading(false);
      return;
    }

    if (isFavorite) {
      // Rimuovi
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', session.user.id)
        .eq('product_id', productId);
        
      if (!error) setIsFavorite(false);
    } else {
      // Aggiungi
      const { error } = await supabase
        .from('favorites')
        .insert([{ user_id: session.user.id, product_id: productId }]);
        
      if (!error) setIsFavorite(true);
    }
    
    setLoading(false);
  };

  return (
    <button 
      onClick={toggleFavorite} 
      disabled={loading}
      style={{
        background: 'rgba(255, 255, 255, 0.9)',
        border: 'none',
        cursor: 'pointer',
        padding: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        transform: isFavorite ? 'scale(1.1)' : 'scale(1)',
        zIndex: 10
      }}
      aria-label={isFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.2)';
        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = isFavorite ? 'scale(1.1)' : 'scale(1)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
      }}
    >
      <Heart 
        size={20} 
        fill={isFavorite ? 'var(--accent-green)' : 'transparent'} 
        color={isFavorite ? 'var(--accent-green)' : '#555'} 
        strokeWidth={2.5}
        style={{ transition: 'all 0.2s' }}
      />
    </button>
  );
}
