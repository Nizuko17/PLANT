# Schema JSON — Protocollo Mega ↔ NodeMCU ↔ PC

## Direzione: Mega → NodeMCU (ogni 3s o su richiesta)

```json
{
  "type": "DATA",
  "temperature": {
    "value": 24.5,
    "unit": "C",
    "status": "OK",
    "alert": false
  },
  "humidity": {
    "value": 62.0,
    "unit": "%",
    "alert": false
  },
  "buzzer": {
    "on": false,
    "freq": 0
  },
  "button": {
    "pressed": false
  },
  "ph": {
    "value": 7.15,
    "alert_low": false,
    "alert_high": false,
    "status": "OK",
    "min": 6.0,
    "max": 8.0
  },
  "pump": {
    "on": true,
    "speed": 75,
    "last_on": "12s fa"
  },
  "monitor": {
    "on": true
  },
  "datetime": {
    "year": 2025,
    "month": 6,
    "day": 14,
    "hour": 10,
    "minute": 30,
    "second": 45,
    "weekday": "Sabato"
  },
  "geo": {
    "lat": 45.464161,
    "lon": 9.190336,
    "city": "Milano"
  }
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
    "data_age": 2
  }
}
```

## HTTP API (NodeMCU) — chiamate GET dal browser/PC

| Endpoint | Parametri | Descrizione |
|---|---|---|
| GET /api/data | — | Tutti i dati sistema |
| GET /info | — | Biglietto da visita |
| GET /api/set | target=buzzer&value=true | Imposta buzzer (ON/OFF) |
| GET /api/set | target=buzzer&freq=880&duration=1000 | Suona buzzer a freq (Hz) |
| GET /api/set | target=pump&on=true&speed=80 | Imposta pompa |
| GET /api/set | target=monitor&value=true | Imposta monitor |
| GET /api/set | target=datetime&year=2025&month=6&day=14&hour=10&minute=30 | Imposta data/ora |
| GET /api/set | target=geo&lat=45.46&lon=9.19&city=Milano | Imposta posizione |
| GET /api/scan | — | Lista reti WiFi vicine |
| GET /api/setwifi | ssid=Rete&pass=Password | Cambia rete WiFi |
| GET /api/reboot | — | Riavvia NodeMCU |
| GET /setup | — | Pagina configurazione AP |

## Valori campo "status" temperatura

| Valore | Condizione |
|---|---|
| "OK" | temp < 30°C |
| "ALLERTA" | temp >= 30°C |

## Note sul protocollo

- Ogni messaggio termina con `\n`
- Tutti i valori numerici float usano il punto come separatore decimale
- `data_age` indica i secondi dall'ultimo aggiornamento dal Mega
- Se `data_age > 10` il Mega è considerato offline
- Il campo `last_on` della pompa è una stringa human-readable
