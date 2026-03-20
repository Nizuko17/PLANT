# Schema JSON — Protocollo Mega ↔ NodeMCU ↔ PC — v3.0.0

## Direzione: Mega → NodeMCU (Ogni 1s in round-robin / 3 cicli)

I dispositivi scambiano meno dati alla volta inviando messaggi frammentati in 3 cicli continui (Sensori -> Attuatori -> Impostazioni/Data). 
Il NodeMCU raccoglie i frammenti aggiornando lo stato generale in memoria.

**Ciclo 0: Sensori**
```json
{
  "type": "DATA",
  "temperature": { "value": 24.5, "unit": "C", "status": "OK", "alert": false, "online": true },
  "humidity": { "value": 62.0, "unit": "%", "alert": false },
  "ph": { "value": 7.15, "alert_low": false, "alert_high": false, "status": "OK", "min": 6.0, "max": 8.0 }
}
```

**Ciclo 1: Attuatori**
```json
{
  "type": "DATA",
  "buzzer": { "on": false, "freq": 0 },
  "button": { "pressed": false },
  "pump": { "on": true, "speed": 75, "last_on": "12s fa" },
  "monitor": { "on": true }
}
```

**Ciclo 2: Impostazioni, Data, Geo**
```json
{
  "type": "DATA",
  "settings": { "buzzer_alarms": true },
  "datetime": { "year": 2025, "month": 6, "day": 14, "hour": 10, "minute": 30, "second": 45, "weekday": "Sabato" },
  "geo": { "lat": 45.464161, "lon": 9.190336, "city": "Milano" }
}
```


## Direzione: Mega → NodeMCU (heartbeat ogni 5s)

```json
{
  "type": "HEARTBEAT",
  "uptime": 3600,
  "free_ram": 5120
}
```

## Direzione: Mega → NodeMCU (evento immediato pulsante)

```json
{
  "type": "EVENT",
  "event": "BUTTON",
  "pressed": true
}
```

## Direzione: NodeMCU → Mega (richiesta dati)

```json
{ "type": "GET" }
```

## Direzione: PC/Browser → NodeMCU → Mega (comando SET)

### Buzzer
```json
{ "type": "SET", "target": "buzzer", "value": true }
```
Oppure tramite frequenza (Hz) e durata (ms):
```json
{ "type": "SET", "target": "buzzer", "freq": 1000, "duration": 500 }
```

### Pompa
```json
{ "type": "SET", "target": "pump", "on": true, "speed": 80 }
```

### Monitor TFT
```json
{ "type": "SET", "target": "monitor", "value": true }
```

### Data e ora
```json
{
  "type": "SET",
  "target": "datetime",
  "year": 2025,
  "month": 6,
  "day": 14,
  "hour": 10,
  "minute": 30,
  "second": 0,
  "weekday": "Sabato"
}
```

### Posizione geografica
```json
{
  "type": "SET",
  "target": "geo",
  "lat": 45.464161,
  "lon": 9.190336,
  "city": "Milano"
}
```

## Direzione: Mega → NodeMCU (risposta ACK)

```json
{
  "type": "ACK",
  "target": "buzzer",
  "ok": true
}
```

## Direzione: NodeMCU → PC (risposta /api/data)
Stesso schema di DATA con aggiunta blocco network:

```json
{
  "type": "DATA",
  "...tutti i campi DATA...",
  "network": {
    "wifi": "connesso",
    "ip": "192.168.1.87",
    "rssi": -62,
    "ssid": "CasaMia",
    "mdns": "pompa.local",
    "uptime": 3600,
    "data_age": 2,
    "mega_online": true
  }
}
```

## Direzione: NodeMCU → PC (risposta /api/status)

```json
{
  "device": "NodeMCU-PompaWiFi",
  "firmware": "3.0.0",
  "uptime_s": 7200,
  "free_heap": 32768,
  "wifi": "connesso",
  "ip": "192.168.1.87",
  "rssi": -62,
  "mega": {
    "online": true,
    "uptime_s": 3600,
    "free_ram": 5120,
    "data_age": 2
  },
  "errors": {
    "json_parse": 0,
    "buffer_overflow": 0,
    "wifi_lost": 1
  }
}
```

## HTTP API (NodeMCU) — chiamate GET dal browser/PC

| Endpoint | Parametri | Descrizione |
|---|---|---|
| GET /api/data | — | Tutti i dati sistema |
| GET /api/status | — | Diagnostica: uptime, heap, errori, stato Mega |
| GET /info | — | Biglietto da visita dispositivo |
| GET /api/set | target=buzzer&value=true | Imposta buzzer (ON/OFF) |
| GET /api/set | target=buzzer&freq=880&duration=1000 | Suona buzzer a freq (Hz) |
| GET /api/set | target=pump&on=true&speed=80 | Imposta pompa |
| GET /api/set | target=monitor&value=true | Imposta monitor |
| GET /api/set | target=datetime&year=2025&month=6&... | Imposta data/ora |
| GET /api/set | target=geo&lat=45.46&lon=9.19&city=Milano | Imposta posizione |
| GET /api/scan | — | Lista reti WiFi vicine |
| GET /api/setwifi | ssid=Rete&pass=Password | Cambia rete WiFi |
| GET /api/reboot | — | Riavvia NodeMCU |
| GET /setup | — | Pagina configurazione AP |

## Comandi terminale PLANT OS (Mega e NodeMCU)

Collegandosi alla seriale di una qualsiasi delle due schede è possibile inviare i comandi:

| Comando | Descrizione |
|---|---|
| `help` | Lista comandi |
| `status` | Stato completo sistema |
| `log <on/off>` | Livello log debug |
| `reboot [all]` | Riavvia Mega (e NodeMCU se 'all') o solo NodeMCU |
| `set <var>=<val>` | Imposta variabile |
| `set alarm <tipo> <soglia\|on\|off>` | Imposta soglia o abilita/disabilita singolo allarme |
| `get <var>` | Ottieni valore variabile |
| `wifi <test\|info\|set>` | Impostazioni / info WiFi |
| `send <dati>` | Invia dati JSON raw da terminale Mega a NodeMCU |
| `errors [clear]` | Contatori errori o azzeramento contatori |
| `api <arg>` | Esecuzione API (mock) |
| `update all` | Forza aggiornamento immediato (Mega) o richiede sync (NodeMCU) |
| `sync` | Sincronizza schede |
| `meteo / news / musica / smart` | Stato servizio (se senza argomenti) o Chiamata esterna API |
| `pump [on/off/vel]` | Stato pompa (se senza argomenti) o Aziona/Imposta velocità |
| `buzzer [freq ms / off]` | Stato buzzer (se senza argomenti) o Suona |
| `monitor [on/off]` | Stato monitor (se senza argomenti) o Accendi/Spegni |
| `alarms [on/off]` | Stato riepilogativo allarmi (senza arg) o Abilita Master (on/off) |

## Valori campo "status" temperatura

| Valore | Condizione |
|---|---|
| "OK" | temp < 30°C |
| "ALLERTA" | temp >= 30°C |

## Note tecniche

- Baud rate: **115200** (Serial0 e Serial1 del Mega, Serial del NodeMCU)
- Ogni messaggio termina con `\n`
- Tutti i valori numerici float usano il punto come separatore decimale
- `data_age` indica i secondi dall'ultimo aggiornamento dal Mega
- Se `data_age > 10` il Mega è considerato offline
- `mega_online` = true se heartbeat ricevuto negli ultimi 15s
- Il campo `last_on` della pompa è una stringa human-readable
- `online` nel blocco `temperature` indica se il sensore DHT11 risponde
- Watchdog: Mega (AVR 8s), NodeMCU (ESP 8s)
- OTA disponibile su NodeMCU (password: `plant_ota_2025`)
- Pin 4 del Mega controlla alimentazione NodeMCU via relay/MOSFET
