// ================================================================
//  NodeMCU LoLin V3 — WiFi Bridge + Web Server
//  Protocollo: JSON su Serial ↔ Mega  |  JSON su HTTP ↔ PC/Browser
//  Librerie: ESP8266WiFi, ESP8266WebServer, WiFiUdp,
//            ESP8266mDNS, ArduinoJson 6.x
//  Board: NodeMCU 1.0 (ESP-12E Module)
//  Vedi: schema_json.md per il protocollo completo
// ================================================================
//  CONNESSIONI FISICHE:
//    NodeMCU RX  <- Mega TX1 (pin 18)  via partitore 1kΩ+2kΩ
//    NodeMCU TX  -> Mega RX1 (pin 19)  diretto
//    NodeMCU GND -- Mega GND           comune
//    NodeMCU USB <- Alimentazione USB dedicata
// ================================================================

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <WiFiUdp.h>
#include <ESP8266mDNS.h>
#include <EEPROM.h>
#include <ArduinoJson.h>

#define DEVICE_NAME       "NodeMCU-PompaWiFi"
#define DEVICE_TYPE       "NodeMCU LoLin V3"
#define FIRMWARE_VERSION  "2.0.0"
#define MDNS_NAME         "pompa"
#define AP_SSID           "PompaWiFi-Setup"
#define AP_PASSWORD       "configura"
#define AP_IP_STR         "192.168.4.1"

#define UDP_LISTEN_PORT    4210
#define UDP_BROADCAST_PORT 4211
#define DISCOVER_MAGIC     "DISCOVER"

#define BROADCAST_INTERVAL    10000
#define CARD_INTERVAL_NO_WIFI  8000
#define CARD_INTERVAL_NO_MEGA 15000
#define MEGA_TIMEOUT          10000

#define EEPROM_SIZE  96
#define EEPROM_SSID   0
#define EEPROM_PASS  33

// ── Oggetti ──────────────────────────────────────────────────────
ESP8266WebServer server(80);
WiFiUDP          udp;

// ── Stato WiFi ───────────────────────────────────────────────────
String wifiSSID = "", wifiPASS = "";
bool   wifiConnesso = false, modalitaAP = false;

// ── Stato sistema (specchio del Mega) ────────────────────────────
float  temp        = 0.0;
float  hum         = 0.0;
float  phValue     = 7.0;
bool   tempAlert   = false;
bool   humAlert    = false;
bool   phAlertLow  = false;
bool   phAlertHigh = false;
bool   buzzerOn    = false;
int    buzzerFreq  = 0;
bool   btnPressed  = false;
bool   pumpOn      = false;
int    pumpSpeed   = 0;
String pumpLastOn  = "mai";
bool   monitorOn   = false;

// Data/ora/geo
int    dtYear=2025,dtMonth=1,dtDay=1,dtHour=0,dtMinute=0,dtSecond=0;
String dtWeekday="---";
float  geoLat=0.0, geoLon=0.0;
String geoCity="";

unsigned long lastDataMs=0, lastCardMs=0, lastBcastMs=0;
String serialBuffer="";

// =================================================================
//  SETUP
// =================================================================
void setup() {
  Serial.begin(9600);
  EEPROM.begin(EEPROM_SIZE);
  caricaCredenziali();

  inviaAlMega("{\"type\":\"STATUS\",\"msg\":\"BOOT\"}");

  if (wifiSSID.length() > 0) {
    if (!connetti()) avviaAP();
  } else {
    avviaAP();
  }

  server.on("/",            HTTP_GET,  handleRoot);
  server.on("/info",        HTTP_GET,  handleInfo);
  server.on("/setup",       HTTP_GET,  handleSetupPage);
  server.on("/dosetup",     HTTP_GET,  handleDoSetup);
  server.on("/api/data",    HTTP_GET,  handleGetData);
  server.on("/api/scan",    HTTP_GET,  handleScan);
  server.on("/api/set",     HTTP_GET,  handleSet);
  server.on("/api/setwifi", HTTP_GET,  handleSetWifi);
  server.on("/api/reboot",  HTTP_GET,  handleReboot);
  server.onNotFound([]() { server.send(404,"text/plain","Not found"); });
  server.begin();
  udp.begin(UDP_LISTEN_PORT);

  if (wifiConnesso) {
    avviaMDNS();
    inviaUDPBroadcast();
    lastBcastMs = millis();
    inviaAlMega("{\"type\":\"STATUS\",\"msg\":\"CONNECTED\",\"ip\":\"" + WiFi.localIP().toString() + "\"}");
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

  if (!wifiConnesso && ora - lastCardMs > CARD_INTERVAL_NO_WIFI)
    { inviaBigliettoSerial(); lastCardMs = ora; }
  else if (wifiConnesso && lastDataMs > 0 && ora - lastDataMs > MEGA_TIMEOUT
           && ora - lastCardMs > CARD_INTERVAL_NO_MEGA)
    { inviaBigliettoSerial(); lastCardMs = ora; }

  if (wifiConnesso && ora - lastBcastMs > BROADCAST_INTERVAL)
    { inviaUDPBroadcast(); lastBcastMs = ora; }

  // Richiedi dati al Mega ogni 3s
  static unsigned long lastReq = 0;
  if (wifiConnesso && ora - lastReq > 3000) {
    lastReq = ora;
    inviaAlMega("{\"type\":\"GET\"}");
  }

  if (wifiConnesso && WiFi.status() != WL_CONNECTED)
    { wifiConnesso=false; Serial.println("STATUS:WIFI_LOST"); avviaAP(); }
}

// =================================================================
//  INVIO AL MEGA (JSON su Serial)
// =================================================================
void inviaAlMega(String json) {
  Serial.println(json);
}

// =================================================================
//  LETTURA SERIAL DAL MEGA
// =================================================================
void leggiSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n') {
      serialBuffer.trim();
      if (serialBuffer.length() > 0) gestisciMsgMega(serialBuffer);
      serialBuffer = "";
    } else if (c != '\r') serialBuffer += c;
  }
}

void gestisciMsgMega(String raw) {
  // Configurazione WiFi (non JSON)
  if (raw.startsWith("SETWIFI_B64:")) { gestisciSetWifiB64(raw); return; }
  if (raw.startsWith("SETWIFI_SEP:")) { gestisciSetWifiSep(raw); return; }
  if (raw.startsWith("SETWIFI:"))     { gestisciSetWifiLegacy(raw); return; }
  if (raw == "RESETWIFI") { wifiSSID="";wifiPASS="";salvaCredenziali();WiFi.disconnect();wifiConnesso=false;avviaAP(); return; }
  if (raw == "GETIP")     { Serial.println(wifiConnesso?"IP:"+WiFi.localIP().toString():"STATUS:NOT_CONNECTED"); return; }
  if (raw == "REBOOT")    { Serial.println("STATUS:REBOOTING"); delay(200); ESP.restart(); }

  // Parsing JSON dal Mega
  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, raw)) return;   // non JSON, ignora

  String type = doc["type"] | "";

  if (type == "DATA") {
    // Aggiorna specchio stato dal Mega
    if (doc.containsKey("temperature")) {
      temp      = doc["temperature"]["value"] | 0.0f;
      tempAlert = doc["temperature"]["alert"] | false;
    }
    if (doc.containsKey("humidity")) {
      hum      = doc["humidity"]["value"] | 0.0f;
      humAlert = doc["humidity"]["alert"] | false;
    }
    if (doc.containsKey("ph")) {
      phValue     = doc["ph"]["value"] | 7.0f;
      phAlertLow  = doc["ph"]["alert_low"] | false;
      phAlertHigh = doc["ph"]["alert_high"] | false;
    }
    if (doc.containsKey("buzzer")) {
      buzzerOn   = doc["buzzer"]["on"]  | false;
      buzzerFreq = doc["buzzer"]["freq"] | 0;
    }
    if (doc.containsKey("button"))  btnPressed = doc["button"]["pressed"] | false;
    if (doc.containsKey("pump")) {
      pumpOn    = doc["pump"]["on"]    | false;
      pumpSpeed = doc["pump"]["speed"] | 0;
      pumpLastOn = doc["pump"]["last_on"] | "mai";
    }
    if (doc.containsKey("monitor")) monitorOn = doc["monitor"]["on"] | false;
    if (doc.containsKey("datetime")) {
      dtYear    = doc["datetime"]["year"]    | 2025;
      dtMonth   = doc["datetime"]["month"]   | 1;
      dtDay     = doc["datetime"]["day"]     | 1;
      dtHour    = doc["datetime"]["hour"]    | 0;
      dtMinute  = doc["datetime"]["minute"]  | 0;
      dtSecond  = doc["datetime"]["second"]  | 0;
      dtWeekday = doc["datetime"]["weekday"] | "---";
    }
    if (doc.containsKey("geo")) {
      geoLat  = doc["geo"]["lat"]  | 0.0f;
      geoLon  = doc["geo"]["lon"]  | 0.0f;
      geoCity = doc["geo"]["city"] | "";
    }
    lastDataMs = millis();
  }

  if (type == "EVENT") {
    String ev = doc["event"] | "";
    if (ev == "BUTTON") btnPressed = doc["pressed"] | false;
  }

  if (type == "ACK") {
    // ACK da Mega — ignorato o loggabile
  }
}

// =================================================================
//  HTTP — /api/data  → JSON completo stato sistema
// =================================================================
void handleGetData() {
  StaticJsonDocument<768> doc;
  doc["type"] = "DATA";

  JsonObject t = doc.createNestedObject("temperature");
  t["value"]  = serialized(String(temp,1));
  t["unit"]   = "C";
  t["status"] = tempAlert ? "ALLERTA" : "OK";
  t["alert"]  = tempAlert;

  JsonObject h = doc.createNestedObject("humidity");
  h["value"] = serialized(String(hum,1));
  h["unit"]  = "%";
  h["alert"] = humAlert;

  JsonObject ph = doc.createNestedObject("ph");
  ph["value"]      = serialized(String(phValue, 2));
  ph["alert_low"]  = phAlertLow;
  ph["alert_high"] = phAlertHigh;
  ph["status"]     = phAlertLow ? "ACIDO" : (phAlertHigh ? "BASICO" : "OK");

  JsonObject bz = doc.createNestedObject("buzzer");
  bz["on"]   = buzzerOn;
  bz["freq"] = buzzerFreq;

  JsonObject bn = doc.createNestedObject("button");
  bn["pressed"] = btnPressed;

  JsonObject pm = doc.createNestedObject("pump");
  pm["on"]      = pumpOn;
  pm["speed"]   = pumpSpeed;
  pm["last_on"] = pumpLastOn;

  JsonObject mo = doc.createNestedObject("monitor");
  mo["on"] = monitorOn;

  JsonObject dt = doc.createNestedObject("datetime");
  dt["year"]=dtYear; dt["month"]=dtMonth; dt["day"]=dtDay;
  dt["hour"]=dtHour; dt["minute"]=dtMinute; dt["second"]=dtSecond;
  dt["weekday"]=dtWeekday;

  JsonObject geo = doc.createNestedObject("geo");
  geo["lat"]=serialized(String(geoLat,6));
  geo["lon"]=serialized(String(geoLon,6));
  geo["city"]=geoCity;

  JsonObject net = doc.createNestedObject("network");
  net["wifi"]   = wifiConnesso ? "connesso" : (modalitaAP ? "access_point" : "disconnesso");
  net["ip"]     = WiFi.localIP().toString();
  net["rssi"]   = WiFi.RSSI();
  net["ssid"]   = wifiSSID;
  net["mdns"]   = String(MDNS_NAME) + ".local";
  net["uptime"] = millis()/1000;
  net["data_age"] = lastDataMs>0 ? (millis()-lastDataMs)/1000 : -1;

  String out;
  serializeJson(doc, out);
  server.sendHeader("Access-Control-Allow-Origin","*");
  server.send(200,"application/json",out);
}

// =================================================================
//  HTTP — /api/set?target=...&...  → invia SET al Mega
// =================================================================
void handleSet() {
  if (!server.hasArg("target")) { server.send(400,"application/json","{\"ok\":false,\"msg\":\"target mancante\"}"); return; }
  String target = server.arg("target");

  StaticJsonDocument<256> cmd;
  cmd["type"]   = "SET";
  cmd["target"] = target;

  if (target == "buzzer") {
    if (server.hasArg("freq")) {
      cmd["freq"] = server.arg("freq").toInt();
      if (server.hasArg("duration")) cmd["duration"] = server.arg("duration").toInt();
    } else {
      cmd["value"] = server.arg("value") == "true" || server.arg("value") == "1";
    }
  }
  else if (target == "pump") {
    if (server.hasArg("on"))    cmd["on"]    = server.arg("on") == "true" || server.arg("on") == "1";
    if (server.hasArg("speed")) cmd["speed"] = server.arg("speed").toInt();
  }
  else if (target == "monitor") {
    cmd["value"] = server.arg("value") == "true" || server.arg("value") == "1";
  }
  else if (target == "datetime") {
    if (server.hasArg("year"))    cmd["year"]    = server.arg("year").toInt();
    if (server.hasArg("month"))   cmd["month"]   = server.arg("month").toInt();
    if (server.hasArg("day"))     cmd["day"]     = server.arg("day").toInt();
    if (server.hasArg("hour"))    cmd["hour"]    = server.arg("hour").toInt();
    if (server.hasArg("minute"))  cmd["minute"]  = server.arg("minute").toInt();
    if (server.hasArg("second"))  cmd["second"]  = server.arg("second").toInt();
    if (server.hasArg("weekday")) cmd["weekday"] = server.arg("weekday");
  }
  else if (target == "geo") {
    if (server.hasArg("lat"))  cmd["lat"]  = server.arg("lat").toFloat();
    if (server.hasArg("lon"))  cmd["lon"]  = server.arg("lon").toFloat();
    if (server.hasArg("city")) cmd["city"] = server.arg("city");
  }
  else {
    server.send(400,"application/json","{\"ok\":false,\"msg\":\"target sconosciuto\"}");
    return;
  }

  String out;
  serializeJson(cmd, out);
  inviaAlMega(out);

  // Aggiorna anche lo specchio locale per risposta immediata
  if (target == "buzzer") {
    if (cmd.containsKey("freq")) {
      buzzerFreq = cmd["freq"] | 0;
      buzzerOn   = (buzzerFreq > 0);
    } else {
      buzzerOn   = cmd["value"] | false;
      buzzerFreq = buzzerOn ? 1000 : 0;
    }
  }
  if (target == "monitor") monitorOn = cmd["value"] | false;
  if (target == "pump") {
    if (cmd.containsKey("on"))    pumpOn    = cmd["on"] | false;
    if (cmd.containsKey("speed")) pumpSpeed = cmd["speed"] | 0;
  }
  if (target == "datetime") {
    if (cmd.containsKey("year"))    dtYear    = cmd["year"];
    if (cmd.containsKey("month"))   dtMonth   = cmd["month"];
    if (cmd.containsKey("day"))     dtDay     = cmd["day"];
    if (cmd.containsKey("hour"))    dtHour    = cmd["hour"];
    if (cmd.containsKey("minute"))  dtMinute  = cmd["minute"];
    if (cmd.containsKey("second"))  dtSecond  = cmd["second"];
    if (cmd.containsKey("weekday")) dtWeekday = cmd["weekday"].as<String>();
  }
  if (target == "geo") {
    if (cmd.containsKey("lat"))  geoLat  = cmd["lat"];
    if (cmd.containsKey("lon"))  geoLon  = cmd["lon"];
    if (cmd.containsKey("city")) geoCity = cmd["city"].as<String>();
  }

  server.sendHeader("Access-Control-Allow-Origin","*");
  server.send(200,"application/json","{\"ok\":true,\"sent\":" + out + "}");
}

// =================================================================
//  WIFI SETUP (Base64, SEP, legacy)
// =================================================================
String b64decode(String input) {
  const char* b64c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  String out=""; int val=0,bits=-8;
  for (unsigned int i=0;i<input.length();i++) {
    char ch=input[i]; if(ch=='=') break;
    const char* pos=strchr(b64c,ch); if(!pos) continue;
    val=(val<<6)+(int)(pos-b64c); bits+=6;
    if(bits>=0){out+=(char)((val>>bits)&0xFF);bits-=8;}
  }
  return out;
}

void gestisciSetWifiB64(String cmd) {
  String p=cmd.substring(12); int sep=p.indexOf('|');
  if(sep>0){wifiSSID=b64decode(p.substring(0,sep));wifiPASS=b64decode(p.substring(sep+1));
    Serial.println("STATUS:WIFI_SAVED");salvaCredenziali();connetti();}
}
void gestisciSetWifiSep(String cmd) {
  String p=cmd.substring(12); int sep=p.indexOf("|||");
  if(sep>=0){wifiSSID=p.substring(0,sep);wifiPASS=p.substring(sep+3);
    Serial.println("STATUS:WIFI_SAVED");salvaCredenziali();connetti();}
}
void gestisciSetWifiLegacy(String cmd) {
  String p=cmd.substring(8); int sep=p.indexOf(',');
  if(sep>0){wifiSSID=p.substring(0,sep);wifiPASS=p.substring(sep+1);
    Serial.println("STATUS:WIFI_SAVED");salvaCredenziali();connetti();}
}

void handleSetWifi() {
  if(server.hasArg("ssid")&&server.hasArg("pass")){
    wifiSSID=server.arg("ssid");wifiPASS=server.arg("pass");salvaCredenziali();
    server.send(200,"text/plain","Riconnessione...");delay(500);connetti();
  } else server.send(400,"text/plain","ssid+pass richiesti");
}

// =================================================================
//  ACCESS POINT / CONNESSIONE
// =================================================================
void avviaAP() {
  modalitaAP=true; wifiConnesso=false;
  WiFi.mode(WIFI_AP); WiFi.softAP(AP_SSID,AP_PASSWORD);
  Serial.println("STATUS:AP_MODE");
  Serial.println("AP_SSID:" + String(AP_SSID));
}

bool connetti() {
  if(wifiSSID.length()==0) return false;
  modalitaAP=false; WiFi.mode(WIFI_STA); WiFi.begin(wifiSSID.c_str(),wifiPASS.c_str());
  Serial.println("STATUS:CONNECTING");
  int t=0; while(WiFi.status()!=WL_CONNECTED&&t<40){delay(500);t++;}
  if(WiFi.status()==WL_CONNECTED){wifiConnesso=true;return true;}
  wifiConnesso=false; Serial.println("STATUS:FAILED"); return false;
}

void avviaMDNS() {
  if(MDNS.begin(MDNS_NAME)) MDNS.addService("http","tcp",80);
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
  wifiSSID="";wifiPASS="";
  for(int i=0;i<32;i++){char c=(char)EEPROM.read(EEPROM_SSID+i);if(!c)break;wifiSSID+=c;}
  for(int i=0;i<63;i++){char c=(char)EEPROM.read(EEPROM_PASS+i);if(!c)break;wifiPASS+=c;}
}

// =================================================================
//  UDP DISCOVERY
// =================================================================
String getBiglietto() {
  String wst = wifiConnesso?"connesso":(modalitaAP?"access_point":"disconnesso");
  String ipStr = wifiConnesso?WiFi.localIP().toString():AP_IP_STR;
  String j="{\n";
  j+="  \"device_type\": \""      +String(DEVICE_TYPE)     +"\",\n";
  j+="  \"device_name\": \""      +String(DEVICE_NAME)     +"\",\n";
  j+="  \"firmware_version\": \"" +String(FIRMWARE_VERSION)+"\",\n";
  j+="  \"mac\": \""              +WiFi.macAddress()       +"\",\n";
  j+="  \"ip\": \""               +ipStr                   +"\",\n";
  j+="  \"wifi_status\": \""      +wst                     +"\",\n";
  j+="  \"mdns\": \""             +String(MDNS_NAME)       +".local\",\n";
  j+="  \"uptime_s\": "           +String(millis()/1000)   +"\n";
  j+="}"; return j;
}
void inviaBigliettoSerial() { Serial.println("CARD:"+getBiglietto()); }
void inviaUDPBroadcast() {
  if(!wifiConnesso) return;
  IPAddress ip=WiFi.localIP(),mask=WiFi.subnetMask(),bcast;
  for(int i=0;i<4;i++) bcast[i]=ip[i]|(~mask[i]&0xFF);
  String p=getBiglietto();
  udp.beginPacket(bcast,UDP_BROADCAST_PORT);udp.print(p);udp.endPacket();
}
void leggiUDP() {
  int sz=udp.parsePacket(); if(sz==0) return;
  char buf[32]; int len=udp.read(buf,sizeof(buf)-1); if(len<=0) return;
  buf[len]='\0'; String msg=String(buf); msg.trim();
  if(msg==DISCOVER_MAGIC){String r=getBiglietto();udp.beginPacket(udp.remoteIP(),udp.remotePort());udp.print(r);udp.endPacket();}
}

// =================================================================
//  ROUTE PAGINA SETUP AP
// =================================================================
void handleRoot() {
  server.sendHeader("Cache-Control","no-cache");
  if(modalitaAP){server.sendHeader("Location","/setup");server.send(302,"text/plain","");}
  else server.send(200,"text/html; charset=utf-8","<html><head><meta http-equiv='refresh' content='0;url=/api/data'></head></html>");
}

void handleInfo() {
  server.sendHeader("Access-Control-Allow-Origin","*");
  server.send(200,"application/json",getBiglietto());
}

void handleSetupPage() {
  server.send(200,"text/html; charset=utf-8",R"====(
<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Configura WiFi</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}
.card{background:#1e293b;border:1px solid #334155;border-radius:14px;padding:28px 24px;width:100%;max-width:360px}
h1{font-size:20px;font-weight:700;color:#7dd3fc;text-align:center;margin-bottom:4px}
.sub{font-size:13px;color:#94a3b8;text-align:center;margin-bottom:24px}
label{font-size:12px;color:#94a3b8;display:block;margin-bottom:4px;margin-top:14px}
input{width:100%;padding:10px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-size:14px}
input:focus{outline:none;border-color:#0284c7}
.btn{width:100%;padding:12px;background:#0284c7;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;margin-top:22px}
.scan-btn{width:100%;padding:8px;background:transparent;color:#7dd3fc;border:1px solid #334155;border-radius:8px;font-size:13px;cursor:pointer;margin-top:10px}
.net-item{padding:8px 10px;background:#0f172a;border:1px solid #334155;border-radius:6px;margin-bottom:4px;cursor:pointer;font-size:13px;display:flex;justify-content:space-between}
.net-item:hover{border-color:#0284c7}
#networks{margin-top:8px}
#msg{margin-top:14px;padding:10px;border-radius:8px;font-size:13px;display:none;text-align:center}
.ok{background:#14532d;color:#4ade80}.err{background:#450a0a;color:#f87171}
</style></head><body>
<div class="card">
<h1>Configura WiFi</h1>
<div class="sub">PompaWiFi &mdash; primo accesso</div>
<button class="scan-btn" onclick="scan()">Scansiona reti</button>
<div id="networks"></div>
<label>Nome rete (SSID)</label>
<input type="text" id="ssid" placeholder="Nome rete">
<label>Password</label>
<input type="password" id="pass" placeholder="Password">
<button class="btn" onclick="salva()">Connetti e salva</button>
<div id="msg"></div>
</div>
<script>
function scan(){
  document.getElementById('networks').innerHTML='<div style="color:#94a3b8;font-size:12px;padding:8px">Scansione...</div>';
  fetch('/api/scan').then(r=>r.json()).then(reti=>{
    document.getElementById('networks').innerHTML=reti.map(r=>
      `<div class="net-item" onclick="document.getElementById('ssid').value='${r.ssid}'">
        <span>${r.ssid}</span><span style="color:#64748b;font-size:11px">${r.rssi}dBm</span></div>`
    ).join('');
  });
}
function salva(){
  const s=document.getElementById('ssid').value.trim(),p=document.getElementById('pass').value;
  if(!s){msg('Inserisci SSID','err');return;}
  fetch('/dosetup?ssid='+encodeURIComponent(s)+'&pass='+encodeURIComponent(p))
    .then(r=>r.json()).then(d=>msg(d.ok?'Salvato! Riconnetti il PC alla rete normale':'Errore: '+d.msg,d.ok?'ok':'err'))
    .catch(()=>msg('Connessione avviata — riconnetti alla tua rete','ok'));
}
function msg(t,cls){const m=document.getElementById('msg');m.textContent=t;m.className=cls;m.style.display='block';}
window.onload=()=>setTimeout(scan,500);
</script></body></html>
)====");
}

void handleDoSetup() {
  if(!server.hasArg("ssid")){server.send(400,"application/json","{\"ok\":false,\"msg\":\"ssid mancante\"}");return;}
  wifiSSID=server.arg("ssid"); wifiPASS=server.hasArg("pass")?server.arg("pass"):"";
  salvaCredenziali();
  server.send(200,"application/json","{\"ok\":true}");
  Serial.println("STATUS:WIFI_SAVED");
  delay(1000);
  if(connetti()){avviaMDNS();inviaUDPBroadcast();lastBcastMs=millis();
    inviaAlMega("{\"type\":\"STATUS\",\"msg\":\"CONNECTED\",\"ip\":\""+WiFi.localIP().toString()+"\"}");
    modalitaAP=false;
  } else avviaAP();
}

void handleScan() {
  int n=WiFi.scanNetworks(); String j="[";
  for(int i=0;i<n;i++){if(i>0)j+=",";
    j+="{\"ssid\":\""+WiFi.SSID(i)+"\",\"rssi\":"+String(WiFi.RSSI(i))+",\"enc\":"+(WiFi.encryptionType(i)!=ENC_TYPE_NONE?"true":"false")+"}";}
  j+="]"; server.send(200,"application/json",j);
}

void handleReboot(){server.send(200,"text/plain","Riavvio...");delay(300);ESP.restart();}
