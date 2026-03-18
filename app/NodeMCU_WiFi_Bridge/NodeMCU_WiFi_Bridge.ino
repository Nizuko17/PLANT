// ================================================================
//  NodeMCU LoLin V3  —  WiFi Bridge + Web Server + AP Config
//  Modalita AP: se non ha credenziali WiFi, crea rete propria
//    SSID: "PompaWiFi-Setup"  Password: "configura"
//    Collegati e apri: http://192.168.4.1
//    Inserisci SSID e password del tuo router -> si connette
//  Una volta connesso al router:
//    - Dashboard su http://<IP> oppure http://pompa.local
//    - Discovery UDP broadcast ogni 10s
//    - Risponde a pacchetto DISCOVER sulla porta 4210
// ================================================================
//  CONNESSIONI FISICHE:
//    NodeMCU RX  <- Mega TX1 (pin 18)  via partitore 1kOhm+2kOhm
//    NodeMCU TX  -> Mega RX1 (pin 19)  diretto
//    NodeMCU GND -- Mega GND           comune
//    NodeMCU USB <- Alimentazione USB dedicata
// ================================================================

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <WiFiUdp.h>
#include <ESP8266mDNS.h>
#include <EEPROM.h>

// ── Identita dispositivo ─────────────────────────────────────────
#define DEVICE_NAME       "NodeMCU-PompaWiFi"
#define DEVICE_TYPE       "NodeMCU LoLin V3"
#define FIRMWARE_VERSION  "1.0.2"
#define MDNS_NAME         "pompa"

// ── Access Point (modalita configurazione) ───────────────────────
#define AP_SSID     "PompaWiFi-Setup"
#define AP_PASSWORD "configura"
#define AP_IP_STR   "192.168.4.1"

// ── Porte UDP ────────────────────────────────────────────────────
#define UDP_LISTEN_PORT    4210
#define UDP_BROADCAST_PORT 4211
#define DISCOVER_MAGIC     "DISCOVER"

// ── Intervalli ───────────────────────────────────────────────────
#define BROADCAST_INTERVAL    10000
#define CARD_INTERVAL_NO_WIFI  8000
#define CARD_INTERVAL_NO_MEGA 15000
#define MEGA_TIMEOUT          10000

// ── EEPROM ───────────────────────────────────────────────────────
#define EEPROM_SIZE  96
#define EEPROM_SSID   0
#define EEPROM_PASS  33

// ── Oggetti ──────────────────────────────────────────────────────
ESP8266WebServer server(80);
WiFiUDP          udp;

// ── Stato ────────────────────────────────────────────────────────
String wifiSSID     = "";
String wifiPASS     = "";
bool   wifiConnesso = false;
bool   modalitaAP   = false;

bool   pumpOn    = false;
int    pumpSpeed = 0;
float  tempVal   = 0.0;
int    levelVal  = 0;
String lastMsg   = "---";
unsigned long lastDataMs  = 0;
unsigned long lastCardMs  = 0;
unsigned long lastBcastMs = 0;

String serialBuffer = "";

// =================================================================
//  SETUP
// =================================================================
void setup() {
  Serial.begin(9600);
  EEPROM.begin(EEPROM_SIZE);
  caricaCredenziali();

  Serial.println("STATUS:BOOT");

  if (wifiSSID.length() > 0) {
    // Credenziali salvate -> prova a connettersi
    bool ok = connetti();
    if (!ok) avviaAP();   // connessione fallita -> fallback AP
  } else {
    // Nessuna credenziale -> modalita AP
    avviaAP();
  }

  // Routes web server (valide sia in AP che in STA)
  server.on("/",            HTTP_GET,  handleRoot);
  server.on("/info",        HTTP_GET,  handleInfo);
  server.on("/api/data",    HTTP_GET,  handleGetData);
  server.on("/api/pump",    HTTP_GET,  handlePump);
  server.on("/api/speed",   HTTP_GET,  handleSpeed);
  server.on("/api/setwifi", HTTP_GET,  handleSetWifi);
  server.on("/api/reboot",  HTTP_GET,  handleReboot);
  // Route configurazione AP
  server.on("/setup",       HTTP_GET,  handleSetupPage);
  server.on("/dosetup",     HTTP_POST, handleDoSetup);
  server.on("/dosetup",     HTTP_GET,  handleDoSetup);
  server.onNotFound([]() { server.send(404, "text/plain", "Not found"); });
  server.begin();

  udp.begin(UDP_LISTEN_PORT);

  if (wifiConnesso) {
    avviaMDNS();
    inviaUDPBroadcast();
    lastBcastMs = millis();
    Serial.println("STATUS:CONNECTED");
    Serial.println("IP:" + WiFi.localIP().toString());
  }
}

// =================================================================
//  LOOP
// =================================================================
void loop() {
  server.handleClient();
  if (wifiConnesso) MDNS.update();
  leggiSerial();
  leggiUDP();

  unsigned long ora = millis();
  bool megaSilenzioso = (lastDataMs > 0) && (ora - lastDataMs > MEGA_TIMEOUT);

  // Biglietto Serial
  if (!wifiConnesso) {
    if (ora - lastCardMs > CARD_INTERVAL_NO_WIFI) {
      inviaBigliettoSerial();
      lastCardMs = ora;
    }
  } else if (megaSilenzioso) {
    if (ora - lastCardMs > CARD_INTERVAL_NO_MEGA) {
      inviaBigliettoSerial();
      lastCardMs = ora;
    }
  }

  // Broadcast UDP
  if (wifiConnesso && ora - lastBcastMs > BROADCAST_INTERVAL) {
    inviaUDPBroadcast();
    lastBcastMs = ora;
  }

  // Richiedi dati Mega
  static unsigned long lastReq = 0;
  if (wifiConnesso && ora - lastReq > 3000) {
    lastReq = ora;
    Serial.println("GET:DATA");
  }

  // Watchdog WiFi
  if (wifiConnesso && WiFi.status() != WL_CONNECTED) {
    wifiConnesso = false;
    Serial.println("STATUS:WIFI_LOST");
    avviaAP();
  }
}

// =================================================================
//  ACCESS POINT
// =================================================================
void avviaAP() {
  modalitaAP = true;
  wifiConnesso = false;
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  IPAddress ip = WiFi.softAPIP();
  Serial.println("STATUS:AP_MODE");
  Serial.println("AP_SSID:" + String(AP_SSID));
  Serial.println("AP_IP:" + ip.toString());
  Serial.println("CMD:CONNECT_TO_AP");
}

// =================================================================
//  CONNESSIONE WiFi STA
// =================================================================
String wifiStatusStr(wl_status_t s) {
  switch(s) {
    case WL_IDLE_STATUS:     return "IDLE";
    case WL_NO_SSID_AVAIL:   return "SSID_NOT_FOUND";
    case WL_SCAN_COMPLETED:  return "SCAN_COMPLETED";
    case WL_CONNECTED:       return "CONNECTED";
    case WL_CONNECT_FAILED:  return "WRONG_PASSWORD";
    case WL_CONNECTION_LOST: return "CONNECTION_LOST";
    case WL_DISCONNECTED:    return "DISCONNECTED";
    default:                 return "UNKNOWN(" + String(s) + ")";
  }
}

bool connetti() {
  if (wifiSSID.length() == 0) return false;
  modalitaAP = false;

  // Scansione preventiva
  Serial.println("STATUS:SCANNING");
  Serial.println("SCAN:Cerco: " + wifiSSID);
  WiFi.mode(WIFI_STA);
  int n = WiFi.scanNetworks();
  bool reteVista = false;
  Serial.println("SCAN:Reti trovate: " + String(n));
  for (int i = 0; i < n; i++) {
    String found = WiFi.SSID(i);
    String line  = "SCAN:" + found + " (" + String(WiFi.RSSI(i)) + "dBm)";
    if (found == wifiSSID) { line += " <-- TROVATA"; reteVista = true; }
    Serial.println(line);
  }
  WiFi.scanDelete();

  if (!reteVista) {
    Serial.println("STATUS:FAILED");
    Serial.println("ERR:SSID non trovato - " + wifiSSID);
    Serial.println("ERR:1. Nome rete errato? (maiuscole contano)");
    Serial.println("ERR:2. Rete a 5GHz? ESP8266 supporta SOLO 2.4GHz");
    Serial.println("ERR:3. Router lontano o spento?");
    return false;
  }

  // Connessione
  Serial.println("STATUS:CONNECTING");
  WiFi.begin(wifiSSID.c_str(), wifiPASS.c_str());

  int t = 0;
  wl_status_t stato;
  while (t < 40) {
    delay(500); t++;
    stato = WiFi.status();
    if (t % 6 == 0) Serial.println("CONN:tentativo " + String(t) + "/40 " + wifiStatusStr(stato));
    if (stato == WL_CONNECTED)    break;
    if (stato == WL_CONNECT_FAILED) break;
  }

  stato = WiFi.status();
  if (stato == WL_CONNECTED) { wifiConnesso = true; return true; }

  wifiConnesso = false;
  Serial.println("STATUS:FAILED");
  if      (stato == WL_CONNECT_FAILED) Serial.println("ERR:PASSWORD ERRATA");
  else if (stato == WL_NO_SSID_AVAIL)  Serial.println("ERR:RETE NON TROVATA");
  else                                  Serial.println("ERR:" + wifiStatusStr(stato));
  return false;
}

void avviaMDNS() {
  if (MDNS.begin(MDNS_NAME)) {
    MDNS.addService("http", "tcp", 80);
  }
}

// =================================================================
//  WEB SERVER — PAGINA CONFIGURAZIONE AP
// =================================================================
void handleSetupPage() {
  String html = R"====(
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Configura WiFi</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;
       display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}
  .card{background:#1e293b;border:1px solid #334155;border-radius:14px;
        padding:28px 24px;width:100%;max-width:360px}
  .logo{text-align:center;margin-bottom:20px}
  .logo-icon{width:52px;height:52px;background:#0284c7;border-radius:14px;
             display:flex;align-items:center;justify-content:center;
             font-size:26px;margin:0 auto 10px}
  h1{font-size:20px;font-weight:700;color:#7dd3fc;text-align:center}
  .sub{font-size:13px;color:#94a3b8;text-align:center;margin-top:4px;margin-bottom:24px}
  label{font-size:12px;color:#94a3b8;display:block;margin-bottom:4px;margin-top:14px}
  input{width:100%;padding:10px 12px;background:#0f172a;border:1px solid #334155;
        border-radius:8px;color:#e2e8f0;font-size:14px;outline:none}
  input:focus{border-color:#0284c7}
  .btn{width:100%;padding:12px;background:#0284c7;color:#fff;border:none;
       border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;margin-top:22px}
  .btn:active{opacity:.85}
  .info{background:#1e3a5f;border:1px solid #1d4ed8;border-radius:8px;
        padding:10px 12px;font-size:12px;color:#93c5fd;margin-top:16px;line-height:1.5}
  .scan-btn{width:100%;padding:8px;background:transparent;color:#7dd3fc;
            border:1px solid #334155;border-radius:8px;font-size:13px;
            cursor:pointer;margin-top:10px}
  #networks{margin-top:8px;display:none}
  .net-item{padding:8px 10px;background:#0f172a;border:1px solid #334155;
            border-radius:6px;margin-bottom:4px;cursor:pointer;font-size:13px;
            display:flex;justify-content:space-between;align-items:center}
  .net-item:hover{border-color:#0284c7;color:#7dd3fc}
  .rssi{font-size:11px;color:#64748b}
  #msg{margin-top:14px;padding:10px;border-radius:8px;font-size:13px;display:none;text-align:center}
  .msg-ok{background:#14532d;color:#4ade80;border:1px solid #16a34a}
  .msg-err{background:#450a0a;color:#f87171;border:1px solid #dc2626}
  .spinner{display:none;text-align:center;margin-top:16px;color:#94a3b8;font-size:13px}
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <div class="logo-icon">W</div>
    <h1>Configura WiFi</h1>
    <div class="sub">NodeMCU PompaWiFi &mdash; primo accesso</div>
  </div>

  <button class="scan-btn" onclick="scanReti()">Scansiona reti disponibili</button>
  <div id="networks"></div>

  <label>Nome rete (SSID)</label>
  <input type="text" id="ssid" placeholder="Nome della tua rete WiFi" autocomplete="off">

  <label>Password</label>
  <input type="password" id="pass" placeholder="Password WiFi">

  <button class="btn" onclick="salva()">Connetti e salva</button>

  <div class="info">
    Dopo aver premuto "Connetti", il dispositivo si collegher&agrave; alla tua rete.<br>
    Riconnetti il PC alla rete normale e cerca il dispositivo su <strong>http://pompa.local</strong>
    oppure usa lo scanner Python.
  </div>

  <div id="msg"></div>
  <div class="spinner" id="spin">Connessione in corso... attendere 15 secondi</div>
</div>

<script>
function scanReti() {
  const btn = document.querySelector('.scan-btn');
  btn.textContent = 'Scansione...';
  btn.disabled = true;
  fetch('/api/scan')
    .then(r => r.json())
    .then(reti => {
      const div = document.getElementById('networks');
      div.style.display = 'block';
      div.innerHTML = reti.map(r =>
        `<div class="net-item" onclick="seleziona('${r.ssid}')">
          <span>${r.ssid}</span>
          <span class="rssi">${r.rssi} dBm ${r.enc ? 'WPA' : 'aperta'}</span>
        </div>`
      ).join('');
      btn.textContent = 'Aggiorna lista';
      btn.disabled = false;
    })
    .catch(() => { btn.textContent = 'Scansiona reti disponibili'; btn.disabled = false; });
}

function seleziona(ssid) {
  document.getElementById('ssid').value = ssid;
  document.getElementById('pass').focus();
}

function salva() {
  const s = document.getElementById('ssid').value.trim();
  const p = document.getElementById('pass').value;
  if (!s) { mostraMsg('Inserisci il nome della rete', false); return; }
  document.getElementById('spin').style.display = 'block';
  document.querySelector('.btn').disabled = true;
  fetch('/dosetup?ssid=' + encodeURIComponent(s) + '&pass=' + encodeURIComponent(p))
    .then(r => r.json())
    .then(d => {
      if (d.ok) {
        mostraMsg('Credenziali salvate! Riconnetti il PC alla rete normale.', true);
      } else {
        mostraMsg('Errore: ' + d.msg, false);
        document.getElementById('spin').style.display = 'none';
        document.querySelector('.btn').disabled = false;
      }
    })
    .catch(() => {
      mostraMsg('Connessione avviata — riconnetti il PC alla tua rete e cerca pompa.local', true);
    });
}

function mostraMsg(t, ok) {
  const m = document.getElementById('msg');
  m.textContent = t;
  m.className = ok ? 'msg-ok' : 'msg-err';
  m.style.display = 'block';
}

// Scansione automatica al caricamento
window.onload = () => setTimeout(scanReti, 800);
</script>
</body>
</html>
)====";
  server.send(200, "text/html; charset=utf-8", html);
}

// POST/GET /dosetup?ssid=...&pass=...
void handleDoSetup() {
  if (!server.hasArg("ssid")) {
    server.send(400, "application/json", "{\"ok\":false,\"msg\":\"ssid mancante\"}");
    return;
  }
  wifiSSID = server.arg("ssid");
  wifiPASS = server.hasArg("pass") ? server.arg("pass") : "";
  salvaCredenziali();

  server.send(200, "application/json", "{\"ok\":true}");
  Serial.println("STATUS:WIFI_SAVED");

  // Attendi che il browser riceva la risposta, poi connetti
  delay(1000);
  bool ok = connetti();
  if (ok) {
    avviaMDNS();
    inviaUDPBroadcast();
    lastBcastMs = millis();
    Serial.println("STATUS:CONNECTED");
    Serial.println("IP:" + WiFi.localIP().toString());
    modalitaAP = false;
  } else {
    avviaAP();  // fallback
  }
}

// GET /api/scan  -> lista reti WiFi visibili
void handleScan() {
  int n = WiFi.scanNetworks();
  String json = "[";
  for (int i = 0; i < n; i++) {
    if (i > 0) json += ",";
    json += "{\"ssid\":\"" + WiFi.SSID(i) + "\",";
    json += "\"rssi\":"    + String(WiFi.RSSI(i)) + ",";
    json += "\"enc\":"     + String(WiFi.encryptionType(i) != ENC_TYPE_NONE ? "true" : "false") + "}";
  }
  json += "]";
  server.send(200, "application/json", json);
}

// =================================================================
//  WEB SERVER — ROUTE ROOT
//  In modalita AP mostra pagina setup, altrimenti dashboard
// =================================================================
void handleRoot() {
  server.sendHeader("Cache-Control", "no-cache");
  if (modalitaAP) {
    // Redirect alla pagina di configurazione
    server.sendHeader("Location", "/setup");
    server.send(302, "text/plain", "");
  } else {
    server.send(200, "text/html; charset=utf-8", getDashboardHTML());
  }
}

// =================================================================
//  BIGLIETTO DA VISITA
// =================================================================
String getBiglietto() {
  String wifiSt, ipStr;
  if (wifiConnesso) {
    wifiSt = "connesso";
    ipStr  = WiFi.localIP().toString();
  } else if (modalitaAP) {
    wifiSt = "access_point";
    ipStr  = AP_IP_STR;
  } else {
    wifiSt = "non_configurato";
    ipStr  = "non_assegnato";
  }
  String json = "{\n";
  json += "  \"device_type\": \""      + String(DEVICE_TYPE)      + "\",\n";
  json += "  \"device_name\": \""      + String(DEVICE_NAME)      + "\",\n";
  json += "  \"firmware_version\": \"" + String(FIRMWARE_VERSION) + "\",\n";
  json += "  \"mac\": \""              + WiFi.macAddress()        + "\",\n";
  json += "  \"ip\": \""               + ipStr                    + "\",\n";
  json += "  \"wifi_status\": \""      + wifiSt                   + "\",\n";
  json += "  \"mdns\": \""             + String(MDNS_NAME)        + ".local\",\n";
  json += "  \"setup_url\": \""        + (modalitaAP ? "http://" + String(AP_IP_STR) + "/setup" : "") + "\",\n";
  json += "  \"uptime_s\": "           + String(millis() / 1000)  + "\n";
  json += "}";
  return json;
}

void inviaBigliettoSerial() { Serial.println("CARD:" + getBiglietto()); }
void handleInfo() { server.sendHeader("Access-Control-Allow-Origin","*"); server.send(200,"application/json",getBiglietto()); }

// =================================================================
//  UDP
// =================================================================
void leggiUDP() {
  int sz = udp.parsePacket();
  if (sz == 0) return;
  char buf[32]; int len = udp.read(buf, sizeof(buf)-1); if(len<=0) return;
  buf[len]='\0'; String msg=String(buf); msg.trim();
  if (msg == DISCOVER_MAGIC) {
    String r = getBiglietto();
    udp.beginPacket(udp.remoteIP(), udp.remotePort());
    udp.print(r); udp.endPacket();
  }
}

void inviaUDPBroadcast() {
  if (!wifiConnesso) return;
  IPAddress ip=WiFi.localIP(), mask=WiFi.subnetMask(), bcast;
  for(int i=0;i<4;i++) bcast[i]=ip[i]|(~mask[i]&0xFF);
  String p=getBiglietto();
  udp.beginPacket(bcast,UDP_BROADCAST_PORT); udp.print(p); udp.endPacket();
}

// =================================================================
//  SERIAL
// =================================================================
void leggiSerial() {
  while (Serial.available()) {
    char c=(char)Serial.read();
    if(c=='\n'){serialBuffer.trim();if(serialBuffer.length()>0)gestisciComandoSerial(serialBuffer);serialBuffer="";}
    else serialBuffer+=c;
  }
}

void gestisciComandoSerial(String cmd) {
  if(cmd.startsWith("DATA:")) { parseData(cmd.substring(5)); lastDataMs=millis(); return; }
  if(cmd.startsWith("MSG:"))  { lastMsg=cmd.substring(4); return; }

  // SETWIFI_B64:<base64_ssid>|<base64_pass>  -- gestisce qualsiasi carattere
  if (cmd.startsWith("SETWIFI_B64:")) {
    String payload = cmd.substring(12);
    int sep = payload.indexOf('|');
    if (sep > 0) {
      wifiSSID = b64decode(payload.substring(0, sep));
      wifiPASS = b64decode(payload.substring(sep + 1));
      Serial.println("STATUS:WIFI_SAVED");
      Serial.println("SSID_DECODED:" + wifiSSID);
      salvaCredenziali(); connetti();
    } else { Serial.println("ERR:FORMATO_B64"); }
    return;
  }

  // SETWIFI_SEP:<ssid>|||<pass>  -- separatore triplo, ok con spazi
  if (cmd.startsWith("SETWIFI_SEP:")) {
    String payload = cmd.substring(12);
    int sep = payload.indexOf("|||");
    if (sep >= 0) {
      wifiSSID = payload.substring(0, sep);
      wifiPASS = payload.substring(sep + 3);
      Serial.println("STATUS:WIFI_SAVED");
      Serial.println("SSID_DECODED:" + wifiSSID);
      salvaCredenziali(); connetti();
    } else { Serial.println("ERR:FORMATO_SEP"); }
    return;
  }

  // SETWIFI:<ssid>,<pass>  -- legacy, no spazi/virgole
  if (cmd.startsWith("SETWIFI:")) {
    String p = cmd.substring(8);
    int sep = p.indexOf(',');
    if (sep > 0) {
      wifiSSID = p.substring(0, sep);
      wifiPASS = p.substring(sep + 1);
      Serial.println("STATUS:WIFI_SAVED");
      salvaCredenziali(); connetti();
    } else { Serial.println("ERR:FORMATO_VIRGOLA"); }
    return;
  }

  if(cmd=="GETIP")    { Serial.println(wifiConnesso?"IP:"+WiFi.localIP().toString():"STATUS:NOT_CONNECTED"); return; }
  if(cmd=="RESETWIFI"){ wifiSSID="";wifiPASS="";salvaCredenziali();WiFi.disconnect();wifiConnesso=false;avviaAP(); return; }
  if(cmd=="REBOOT")   { Serial.println("STATUS:REBOOTING"); delay(200); ESP.restart(); }
}

// =================================================================
//  BASE64 DECODER
// =================================================================
String b64decode(String input) {
  const char* b64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  String output = "";
  int val = 0, bits = -8;
  for (unsigned int i = 0; i < input.length(); i++) {
    char ch = input[i];
    if (ch == '=') break;
    const char* pos = strchr(b64chars, ch);
    if (!pos) continue;
    val = (val << 6) + (int)(pos - b64chars);
    bits += 6;
    if (bits >= 0) { output += (char)((val >> bits) & 0xFF); bits -= 8; }
  }
  return output;
}

// =================================================================
//  EEPROM
// =================================================================
void salvaCredenziali() {
  for(int i=0;i<EEPROM_SIZE;i++) EEPROM.write(i,0);
  for(int i=0;i<(int)wifiSSID.length()&&i<32;i++) EEPROM.write(EEPROM_SSID+i,wifiSSID[i]);
  for(int i=0;i<(int)wifiPASS.length()&&i<63;i++) EEPROM.write(EEPROM_PASS+i,wifiPASS[i]);
  EEPROM.commit();
}

void caricaCredenziali() {
  wifiSSID=""; wifiPASS="";
  for(int i=0;i<32;i++){char c=(char)EEPROM.read(EEPROM_SSID+i);if(!c)break;wifiSSID+=c;}
  for(int i=0;i<63;i++){char c=(char)EEPROM.read(EEPROM_PASS+i);if(!c)break;wifiPASS+=c;}
}

// =================================================================
//  PARSING DATI MEGA
// =================================================================
void parseData(String payload) {
  while(payload.length()>0){
    int idx=payload.indexOf(',');
    String token=(idx>=0)?payload.substring(0,idx):payload;
    payload=(idx>=0)?payload.substring(idx+1):"";
    int eq=token.indexOf('='); if(eq<0) continue;
    String key=token.substring(0,eq),val=token.substring(eq+1);
    if(key=="pump")  pumpOn   =(val.toInt()==1);
    if(key=="speed") pumpSpeed=val.toInt();
    if(key=="temp")  tempVal  =val.toFloat();
    if(key=="level") levelVal =val.toInt();
    if(key=="msg")   lastMsg  =val;
  }
}

// =================================================================
//  ROUTES API
// =================================================================
void handleGetData() {
  unsigned long age=(millis()-lastDataMs)/1000;
  String wifiSt;
  if      (wifiConnesso) wifiSt = "connesso";
  else if (modalitaAP)   wifiSt = "access_point";
  else                   wifiSt = "disconnesso";
  String json="{";
  json+="\"pump\":"   + String(pumpOn?"true":"false") + ",";
  json+="\"speed\":"  + String(pumpSpeed) + ",";
  json+="\"temp\":"   + String(tempVal,1) + ",";
  json+="\"level\":"  + String(levelVal) + ",";
  json+="\"wifi\":\"" + wifiSt + "\",";
  json+="\"ssid\":\"" + wifiSSID + "\",";
  json+="\"ip\":\""   + WiFi.localIP().toString() + "\",";
  json+="\"rssi\":"   + String(WiFi.RSSI()) + ",";
  json+="\"msg\":\""  + lastMsg + "\",";
  json+="\"dataAge\":" + String(age);
  json+="}";
  server.sendHeader("Access-Control-Allow-Origin","*");
  server.send(200,"application/json",json);
  Serial.println("GET:DATA");
}

void handlePump() {
  if(server.hasArg("state")){String s=server.arg("state");s.toUpperCase();if(s=="ON"||s=="OFF"){Serial.println("PUMP:"+s);delay(80);Serial.println("GET:DATA");}}
  server.send(200,"text/plain","ok");
}
void handleSpeed() {
  if(server.hasArg("value")){int v=constrain(server.arg("value").toInt(),0,100);Serial.println("PUMP:"+String(v));}
  server.send(200,"text/plain","ok");
}
void handleSetWifi() {
  if(server.hasArg("ssid")&&server.hasArg("pass")){
    wifiSSID=server.arg("ssid");wifiPASS=server.arg("pass");salvaCredenziali();
    server.send(200,"text/plain","Credenziali salvate. Riconnessione...");delay(500);connetti();
  } else server.send(400,"text/plain","Parametri mancanti");
}
void handleReboot(){ server.send(200,"text/plain","Riavvio..."); delay(300); ESP.restart(); }

// =================================================================
//  DASHBOARD HTML
// =================================================================
String getDashboardHTML() {
  return R"====(
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Controllo Pompa</title>
<style>
  :root{--bg:#0f172a;--card:#1e293b;--border:#334155;--text:#e2e8f0;--muted:#94a3b8;--blue:#7dd3fc;--green:#4ade80;--red:#f87171;--amber:#fbbf24}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);padding:16px}
  h1{font-size:18px;font-weight:600;color:var(--blue);margin-bottom:16px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:480px}
  .card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px}
  .full{grid-column:1/-1}
  .label{font-size:11px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px}
  .value{font-size:24px;font-weight:700}
  .unit{font-size:13px;color:var(--muted);margin-left:2px;font-weight:400}
  .on{color:var(--green)}.off{color:var(--red)}.ok{color:var(--green)}.warn{color:var(--amber)}
  .btn{width:100%;padding:10px;border:none;border-radius:7px;font-size:14px;font-weight:600;cursor:pointer;margin-top:6px}
  .btn-green{background:#16a34a;color:#fff}.btn-red{background:#dc2626;color:#fff}.btn-blue{background:#0284c7;color:#fff}
  input[type=range]{width:100%;margin-top:8px;accent-color:var(--blue)}
  .bar-wrap{background:#0f172a;border-radius:4px;height:8px;margin-top:6px;overflow:hidden}
  .bar{height:100%;border-radius:4px;background:var(--blue);transition:width .4s}
  .info-row{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:4px}
  .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px}
  .dot-green{background:var(--green)}.dot-red{background:var(--red)}
  input[type=text],input[type=password]{width:100%;padding:7px 10px;background:#0f172a;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;margin-top:4px}
  .age{font-size:11px;color:var(--muted);text-align:right;margin-top:6px}
  #toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1e293b;border:1px solid #334155;color:#e2e8f0;padding:8px 18px;border-radius:8px;font-size:13px;opacity:0;transition:opacity .3s;pointer-events:none}
</style>
</head>
<body>
<h1>Pannello controllo pompa</h1>
<div class="grid">
  <div class="card">
    <div class="label">Stato pompa</div>
    <div class="value" id="pumpVal">---</div>
    <button class="btn btn-green" onclick="sendPump('ON')">Accendi</button>
    <button class="btn btn-red" onclick="sendPump('OFF')" style="margin-top:5px">Spegni</button>
  </div>
  <div class="card">
    <div class="label">Velocita</div>
    <div class="value"><span id="speedVal">0</span><span class="unit">%</span></div>
    <input type="range" id="speedSlider" min="0" max="100" value="0"
      oninput="document.getElementById('speedVal').textContent=this.value"
      onchange="sendSpeed(this.value)">
    <div class="info-row"><span>0%</span><span>100%</span></div>
  </div>
  <div class="card">
    <div class="label">Temperatura</div>
    <div class="value"><span id="tempVal">--</span><span class="unit">C</span></div>
  </div>
  <div class="card">
    <div class="label">Livello acqua</div>
    <div class="value"><span id="levelVal">--</span><span class="unit">%</span></div>
    <div class="bar-wrap"><div class="bar" id="levelBar" style="width:0%"></div></div>
  </div>
  <div class="card full">
    <div class="label">Rete WiFi</div>
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div><span class="dot" id="wifiDot"></span><span id="wifiVal">---</span></div>
      <span style="font-size:11px;color:var(--muted)" id="rssiVal"></span>
    </div>
    <div style="font-size:12px;color:var(--blue);margin-top:4px">IP: <span id="ipVal">---</span></div>
    <div style="font-size:12px;color:var(--muted);margin-top:2px">Rete: <span id="ssidVal">---</span></div>
    <div class="age" id="ageVal"></div>
  </div>
  <div class="card full">
    <div class="label">Ultimo messaggio da Mega</div>
    <div style="font-size:13px;color:var(--amber);margin-top:4px" id="msgVal">---</div>
  </div>
  <div class="card full">
    <div class="label">Cambia rete WiFi</div>
    <input type="text" id="newSsid" placeholder="Nome rete (SSID)">
    <input type="password" id="newPass" placeholder="Password" style="margin-top:6px">
    <button class="btn btn-blue" onclick="setWifi()" style="margin-top:8px">Salva e connetti</button>
  </div>
</div>
<div id="toast"></div>
<script>
function update(){
  fetch('/api/data').then(r=>r.json()).then(d=>{
    const po=document.getElementById('pumpVal');
    po.textContent=d.pump?'ACCESA':'SPENTA';po.className='value '+(d.pump?'on':'off');
    document.getElementById('speedVal').textContent=d.speed;
    document.getElementById('speedSlider').value=d.speed;
    document.getElementById('tempVal').textContent=d.temp;
    document.getElementById('levelVal').textContent=d.level;
    document.getElementById('levelBar').style.width=d.level+'%';
    const conn=d.wifi==='connesso';
    document.getElementById('wifiVal').textContent=d.wifi;
    document.getElementById('wifiVal').className=conn?'ok':'warn';
    document.getElementById('wifiDot').className='dot '+(conn?'dot-green':'dot-red');
    document.getElementById('ipVal').textContent=d.ip;
    document.getElementById('ssidVal').textContent=d.ssid;
    document.getElementById('rssiVal').textContent=d.rssi+' dBm';
    document.getElementById('msgVal').textContent=d.msg;
    document.getElementById('ageVal').textContent='Dati aggiornati '+d.dataAge+'s fa';
  }).catch(()=>{});
}
function sendPump(s){fetch('/api/pump?state='+s).then(()=>{toast(s==='ON'?'Pompa accesa':'Pompa spenta');setTimeout(update,300)});}
function sendSpeed(v){fetch('/api/speed?value='+v);}
function setWifi(){
  const s=document.getElementById('newSsid').value.trim(),p=document.getElementById('newPass').value;
  if(!s){toast('Inserisci il nome rete');return;}
  fetch('/api/setwifi?ssid='+encodeURIComponent(s)+'&pass='+encodeURIComponent(p)).then(r=>r.text()).then(t=>toast(t));
}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.style.opacity=1;setTimeout(()=>t.style.opacity=0,2500);}
setInterval(update,2500);update();
</script>
</body>
</html>
)====";
}
