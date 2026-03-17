import FadeIn from '@/components/FadeIn';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/server';
import { Check, X, Leaf } from 'lucide-react';
import FavoriteButton from '@/components/FavoriteButton';
import AddToCartButton from '@/components/AddToCartButton';

export const metadata = {
  title: 'Prodotti | PLANT',
  description: 'Scopri i nostri modelli PLANT One, Pro e Max. Tecnologia e natura, progettate per la tua casa.',
};

export default async function Prodotti() {
  const supabase = await createClient();
  // SSR Data Fetch da Supabase per Prodotti (Category 1)
  const { data: prodotti, error } = await supabase
    .from('products')
    .select('*')
    .eq('category_id', 1)
    .eq('is_active', true)
    .order('price', { ascending: true });

  const displayProducts = error || !prodotti ? [] : prodotti;

  return (
    <main>
      {/* Prodotti Hero */}
      <section className="page-hero text-center">
        <div className="container">
          <FadeIn>
            <h1 className="hero-title">I nostri Prodotti</h1>
            <p className="hero-subtitle">Tecnologia e natura, progettate per la tua casa.</p>
          </FadeIn>
        </div>
      </section>

      {/* Products Grid */}
      <section className="products-section">
        <div className="container">
          <div className="products-grid">
            {displayProducts.map((p) => (
              <FadeIn key={p.id} className="product-card" style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 10 }}>
                  <FavoriteButton productId={p.id} />
                </div>
                <div className="product-image" style={{ position: 'relative', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '260px', overflow: 'hidden' }}>
                  {p.image_urls ? (
                    <Image 
                      src={p.image_urls} 
                      alt={p.name} 
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
                  <h3>{p.name}</h3>
                  <p className="product-desc">{p.description}</p>
                  <div className="product-price">&euro; {p.price?.toFixed(2)}</div>
                  <AddToCartButton product={p} text="Aggiungi al carrello" />
                </div>
              </FadeIn>
            ))}
            {displayProducts.length === 0 && !error && (
              <p style={{textAlign: "center", gridColumn:"1/-1"}}>Nessun prodotto disponibile al momento.</p>
            )}
            {error && (
              <p style={{textAlign: "center", gridColumn:"1/-1", color:"red"}}>Errore nel caricamento del catalogo.</p>
            )}
          </div>
        </div>
      </section>

      {/* Features Comparison */}
      <section className="comparison-section bg-light">
        <div className="container text-center">
          <FadeIn>
            <h2>Confronta i modelli</h2>
            <div className="comparison-table-wrapper">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Funzionalità</th>
                    {displayProducts.map(p => (
                      <th key={p.id}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <CompareTableRows products={displayProducts} />
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
  );
}

// Subcomponent per fare il render dinamico delle righe della tabella basate su components del DB
async function CompareTableRows({ products }) {
  const supabase = await createClient();
  
  // Estrai tutti i componenti definiti nel DB
  const { data: components } = await supabase.from('components').select('*').order('id', { ascending: true });
  
  if (!components || components.length === 0 || products.length === 0) {
    return <tr><td colSpan={products.length + 1}>Nessun dato di confronto disponibile</td></tr>;
  }
  
  // Estrai tutte le relazioni di prodotto-componente per i prodotti mostrati
  const productIds = products.map(p => p.id);
  const { data: prodComps } = await supabase.from('product_components').select('*').in('product_id', productIds);

  const pcRelations = prodComps || [];

  return (
    <>
      {components.map(comp => (
        <tr key={comp.id}>
          <td style={{ textAlign: 'left', fontWeight: '500' }}>
            {comp.name}
            <div style={{ fontSize: '0.8rem', color: '#666', fontWeight: '400' }}>{comp.description}</div>
          </td>
          {products.map(p => {
            const hasComponent = pcRelations.some(pc => pc.product_id === p.id && pc.component_id === comp.id);
            return (
              <td key={p.id}>
                {hasComponent ? 
                  <Check size={20} style={{ color: 'var(--accent-green)', margin: '0 auto' }} /> : 
                  <X size={20} style={{ color: '#ccc', margin: '0 auto' }} />
                }
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
