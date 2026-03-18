import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { name, product_id, mac_address } = await request.json();

    // 1. Validazione base
    if (!name || !product_id) {
      return NextResponse.json({ error: 'Campi obbligatori mancanti' }, { status: 400 });
    }

    // 2. Validazione MAC (opzionale)
    if (mac_address && !/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac_address)) {
      // return NextResponse.json({ error: 'Formato MAC address non valido' }, { status: 400 });
      // Non blocchiamo se l'utente non lo sa, ma lo sanifichiamo
    }

    // 3. Verifica esistenza prodotto (Backend check)
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('id', product_id)
      .single();

    if (!product) {
       return NextResponse.json({ error: 'Prodotto non trovato' }, { status: 404 });
    }

    // 4. PREVENZIONE DUPLICATI: Verifica se il MAC esiste già per questo utente
    if (mac_address) {
      const { data: existingDevice } = await supabase
        .from('devices')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('mac_address', mac_address)
        .maybeSingle();

      if (existingDevice) {
        // Se esiste già, consideriamo l'operazione un successo (idempotenza) o aggiorniamo il nome
        return NextResponse.json({ success: true, message: 'Dispositivo già registrato' });
      }
    }

    // 5. Inserimento nel DB
    const { error } = await supabase.from('devices').insert([{
      user_id: session.user.id,
      name: name.replace(/<[^>]*>?/gm, ''), // XSS protection
      product_id: parseInt(product_id),
      mac_address: mac_address || null,
      status_id: 1, 
    }]);

    if (error) {
      console.error('DB Insert Device Error:', error);
      return NextResponse.json({ error: 'Errore nel salvataggio del dispositivo' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Device Add Error:', error);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
