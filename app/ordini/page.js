'use client';

import FadeIn from '@/components/FadeIn';
import { createClient } from '@/utils/supabase/client';
import { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle } from 'lucide-react';

export default function Ordini() {
  const supabase = createClient();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data } = await supabase
        .from('orders')
        .select('*, status:status(type), order_items(*, product:products(name, price, image_urls))')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (data) setOrders(data);
      setLoading(false);
    };

    fetchOrders();
  }, [supabase]);

  const statusColor = (type) => {
    switch(type) {
      case 'Active': return '#22c55e';
      case 'Pending': return '#f59e0b';
      case 'Inactive': return '#ef4444';
      default: return '#999';
    }
  };

  if (loading) return <main className="page-hero text-center"><div className="container">Caricamento ordini...</div></main>;

  return (
    <main>
      <section className="page-hero text-center" style={{ paddingBottom: '30px' }}>
        <div className="container">
          <FadeIn>
            <h1 className="hero-title" style={{ fontSize: '2.5rem' }}>
              <Package size={36} style={{ verticalAlign: 'middle', marginRight: '10px' }} />
              I tuoi Ordini
            </h1>
            <p className="hero-subtitle">{orders.length} ordini effettuati</p>
          </FadeIn>
        </div>
      </section>

      <section className="account-section" style={{ paddingTop: 0 }}>
        <div className="container">
          {orders.length === 0 ? (
            <FadeIn>
              <div className="account-card text-center" style={{ padding: '60px 20px' }}>
                <Package size={60} style={{ color: '#ccc', marginBottom: '20px' }} />
                <h3>Nessun ordine</h3>
                <p style={{ color: '#666', marginBottom: '25px' }}>Non hai ancora effettuato acquisti.</p>
                <a href="/prodotti" className="btn btn-primary">Scopri i prodotti</a>
              </div>
            </FadeIn>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {orders.map((order) => (
                <FadeIn key={order.id}>
                  <div className="account-card" style={{ padding: '25px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h4 style={{ margin: 0 }}>Ordine #{order.id}</h4>
                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#666' }}>
                          <Clock size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
                          {new Date(order.created_at).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600',
                          background: statusColor(order.status?.type) + '20', color: statusColor(order.status?.type)
                        }}>
                          {order.status?.type || 'Pending'}
                        </span>
                        <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>&euro; {Number(order.total_amount).toFixed(2)}</span>
                      </div>
                    </div>
                    
                    {order.order_items && order.order_items.length > 0 && (
                      <div style={{ borderTop: '1px solid #eee', paddingTop: '15px' }}>
                        {order.order_items.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '0.9rem' }}>
                            <span>{item.product?.name || 'Prodotto'} x{item.quantity}</span>
                            <span>&euro; {(item.price_per_item * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
