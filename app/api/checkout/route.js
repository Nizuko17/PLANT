import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/utils/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Devi effettuare il login per acquistare.' }, { status: 401 });
    }

    const body = await request.json();
    const origin = request.headers.get('origin') || 'http://localhost:3000';

    // Supporta sia il vecchio formato (singolo product) sia il nuovo (array items dal carrello)
    let lineItems = [];
    let metadataProducts = [];

    if (body.items && Array.isArray(body.items)) {
      // Nuovo formato: carrello multiprodotto
      for (const item of body.items) {
        const { data: product } = await supabase
          .from('products')
          .select('*')
          .eq('id', item.id)
          .single();

        if (!product) continue;

        lineItems.push({
          price_data: {
            currency: 'eur',
            product_data: {
              name: product.name,
              description: product.description,
            },
            unit_amount: Math.round(product.price * 100),
          },
          quantity: item.quantity || 1,
        });

        metadataProducts.push({ id: product.id, qty: item.quantity || 1, price: product.price });
      }
    } else if (body.productId) {
      // Vecchio formato: singolo prodotto
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', body.productId)
        .single();

      if (!product) {
        return NextResponse.json({ error: 'Prodotto non trovato' }, { status: 404 });
      }

      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: product.name,
            description: product.description,
          },
          unit_amount: Math.round(product.price * 100),
        },
        quantity: 1,
      });

      metadataProducts.push({ id: product.id, qty: 1, price: product.price });
    }

    if (lineItems.length === 0) {
      return NextResponse.json({ error: 'Nessun prodotto valido nel carrello' }, { status: 400 });
    }

    // Create Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: session.user.email, // Pre-compila l'email dell'account
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/carrello`,
      client_reference_id: session.user.id,
      metadata: {
        userId: session.user.id,
        products: JSON.stringify(metadataProducts),
      }
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
