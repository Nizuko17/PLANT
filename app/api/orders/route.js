import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Questa route salva l'ordine nel DB dopo un checkout riuscito
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const { items, totalAmount } = await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Nessun articolo' }, { status: 400 });
    }

    // 1. Cerca o crea un indirizzo di default per l'utente (placeholder)
    let { data: address } = await supabase
      .from('addresses')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('is_default', true)
      .single();

    if (!address) {
      // Crea un indirizzo placeholder
      const { data: newAddr } = await supabase
        .from('addresses')
        .insert([{
          user_id: session.user.id,
          street: 'Da definire',
          city: 'Da definire',
          postal_code: '00000',
          country: 'Italia',
          is_default: true,
        }])
        .select('id')
        .single();
      address = newAddr;
    }

    if (!address) {
      return NextResponse.json({ error: 'Impossibile creare indirizzo' }, { status: 500 });
    }

    // 2. Crea l'ordine
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        user_id: session.user.id,
        total_amount: totalAmount,
        address_id: address.id,
        status_id: 3, // 3 = Pending
      }])
      .select('id')
      .single();

    if (orderError || !order) {
      console.error('Order creation error:', orderError);
      return NextResponse.json({ error: 'Impossibile creare ordine' }, { status: 500 });
    }

    // 3. Inserisci le righe dell'ordine
    const orderItems = items.map(item => ({
      order_id: order.id,
      product_id: item.id,
      quantity: item.quantity,
      price_per_item: item.price,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    
    if (itemsError) {
      console.error('Order items error:', itemsError);
    }

    return NextResponse.json({ orderId: order.id, success: true });
  } catch (err) {
    console.error('Record order error:', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
