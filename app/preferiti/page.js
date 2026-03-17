'use client';

import FadeIn from '@/components/FadeIn';
import { createClient } from '@/utils/supabase/client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Heart, Trash2, ShoppingBag, Leaf } from 'lucide-react';
import { useCart } from '@/context/CartContext';

export default function Preferiti() {
  const supabase = createClient();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchFavorites = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('favorites')
        .select('*, product:products(*)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (data) setFavorites(data);
      setLoading(false);
    };

    fetchFavorites();
  }, [supabase]);

  const removeFavorite = async (favId) => {
    await supabase.from('favorites').delete().eq('id', favId);
    setFavorites(prev => prev.filter(f => f.id !== favId));
  };

  const handleAddToCart = (product) => {
    addToCart(product);
  };

  if (loading) return <main className="page-hero text-center"><div className="container">Caricamento preferiti...</div></main>;

  return (
    <main>
      <section className="page-hero text-center" style={{ paddingBottom: '30px' }}>
        <div className="container">
          <FadeIn>
            <h1 className="hero-title" style={{ fontSize: '2.5rem' }}>
              <Heart size={36} style={{ verticalAlign: 'middle', marginRight: '10px', color: 'var(--accent-green)' }} />
              I tuoi Preferiti
            </h1>
            <p className="hero-subtitle">{favorites.length} {favorites.length === 1 ? 'prodotto salvato' : 'prodotti salvati'}</p>
          </FadeIn>
        </div>
      </section>

      <section className="account-section" style={{ paddingTop: 0 }}>
        <div className="container">
          {favorites.length === 0 ? (
            <FadeIn>
              <div className="account-card text-center" style={{ padding: '60px 20px' }}>
                <Heart size={60} style={{ color: '#ccc', marginBottom: '20px' }} />
                <h3>Nessun preferito</h3>
                <p style={{ color: '#666', marginBottom: '25px' }}>Clicca il cuore su un prodotto per salvarlo qui.</p>
                <a href="/prodotti" className="btn btn-primary">Esplora i prodotti</a>
              </div>
            </FadeIn>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {favorites.map((fav) => (
                <FadeIn key={fav.id}>
                  <div className="account-card" style={{ padding: '25px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                      <div className="product-image" style={{ width: '100px', height: '100px', flexShrink: 0, background: '#f5f5f7', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                        {fav.product?.image_urls ? (
                          <Image 
                            src={fav.product.image_urls} 
                            alt={fav.product.name} 
                            fill
                            style={{ objectFit: 'cover' }} 
                          />
                        ) : (
                          <div style={{ color: '#ccc' }}>
                            <Leaf size={24} strokeWidth={1} />
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <h4 style={{ margin: '0 0 5px' }}>{fav.product?.name || 'Prodotto'}</h4>
                            <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#666', lineHeight: '1.4' }}>
                              {fav.product?.description?.substring(0, 60)}...
                            </p>
                            <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--accent-green)' }}>
                              &euro; {fav.product?.price?.toFixed(2)}
                            </div>
                          </div>
                          <button onClick={() => removeFavorite(fav.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cc4444', padding: '5px' }}>
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleAddToCart(fav.product)}
                      className="btn btn-primary btn-full" 
                      style={{ marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <ShoppingBag size={18} /> Aggiungi al carrello
                    </button>
                  </div>
                </FadeIn>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
