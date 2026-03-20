export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import dgram from 'dgram';
import { NextResponse } from 'next/server';

export async function GET() {
  return new Promise((resolve) => {
    let server;
    try {
      server = dgram.createSocket('udp4');
    } catch(e) {
      return resolve(NextResponse.json({ success: false, error: "UDP non supportato nel runtime corrente" }, { status: 500 }));
    }
    
    const devices = [];
    const DISCOVER_MAGIC = "DISCOVER";
    const PORT = 4210;
    
    server.on('error', (err) => {
      console.error(`Socket UDP server error:\n${err.stack}`);
      server.close();
      resolve(NextResponse.json({ success: false, error: err.message }, { status: 500 }));
    });

    server.bind(0, () => {
      server.setBroadcast(true);
      
      const message = Buffer.from(DISCOVER_MAGIC);
      // Invia broadcast
      server.send(message, 0, message.length, PORT, '255.255.255.255', (err) => {
        if (err) {
          console.error("Errore invio UDP:", err);
          server.close();
          resolve(NextResponse.json({ success: false, error: err.message }, { status: 500 }));
        }
      });
    });

    server.on('message', (msg, rinfo) => {
      try {
        const strMsg = msg.toString('utf-8');
        let data;
        if (strMsg.startsWith('CARD:')) {
            data = JSON.parse(strMsg.substring(5));
        } else {
            data = JSON.parse(strMsg);
        }
        
        // Evita duplicati per IP o MAC
        if (!devices.find(d => d.mac === data.mac || d.ip === rinfo.address)) {
          data.source_ip = rinfo.address;
          devices.push(data);
        }
      } catch (e) {
        // Ignora pacchetti non validi
      }
    });

    // Timeout: aspetta 3 secondi prima di chiudere
    setTimeout(() => {
      try {
        server.close();
      } catch (e) { }
      resolve(NextResponse.json({ success: true, count: devices.length, devices }));
    }, 3000);
  });
}
