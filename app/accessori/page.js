import FadeIn from '@/components/FadeIn';
import { createClient } from '@/utils/supabase/server';
import Image from 'next/image';
import { Leaf } from 'lucide-react';
import FavoriteButton from '@/components/FavoriteButton';
import AddToCartButton from '@/components/AddToCartButton';

export const metadata = {
  title: 'Accessori | PLANT',
  description: 'Scopri gli accessori perfetti per il tuo vaso intelligente PLANT.',
};

export default async function Accessori() {
  const supabase = await createClient();
  // SSR Data Fetch da Supabase per Accessori (Category 2)
  const { data: accessori, error } = await supabase
    .from('products')
    .select('*')
    .eq('category_id', 2)
    .eq('is_active', true)
    .order('price', { ascending: true });

  const displayAccessori = error || !accessori ? [] : accessori;

  return (
    <main>
      <section className="page-hero text-center">
        <div className="container">
          <FadeIn>
            <h1 className="hero-title">Accessori Ufficiali</h1>
            <p className="hero-subtitle">Complementi studiati per esaltare l'esperienza PLANT.</p>
          </FadeIn>
        </div>
      </section>

      <section className="products-section">
        <div className="container">
          <div className="products-grid">
            {displayAccessori.map((acc) => (
              <FadeIn key={acc.id} className="product-card" style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 10 }}>
                  <FavoriteButton productId={acc.id} />
                </div>
                <div className="product-image" style={{ position: 'relative', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '260px', overflow: 'hidden' }}>
                  {acc.image_urls ? (
                    <Image 
                      src={acc.image_urls} 
                      alt={acc.name} 
                      fill
                      style={{ objectFit: 'cover' }} 
                    />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#ccc' }}>
                      <Leaf size={48} strokeWidth={1} />
                      <p style={{ fontSize: '0.8rem', marginTop: '10px' }}>Immagine non disponibile</p>
                    </div>
                  )}
                </div>
                <div className="product-info">
                  <h3>{acc.name}</h3>
                  <p className="product-desc">{acc.description}</p>
                  <div className="product-price">&euro; {acc.price?.toFixed(2)}</div>
                  <AddToCartButton product={acc} text="Aggiungi al carrello" />
                </div>
              </FadeIn>
            ))}
            {displayAccessori.length === 0 && !error && (
              <p style={{textAlign: "center", gridColumn:"1/-1"}}>Nessun accessorio disponibile al momento.</p>
            )}
            {error && (
               <p style={{textAlign: "center", gridColumn:"1/-1", color:"red"}}>Impossibile caricare il catalogo accessori.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
