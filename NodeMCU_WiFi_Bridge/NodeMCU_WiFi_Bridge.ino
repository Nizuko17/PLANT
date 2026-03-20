// ================================================================
//  NodeMCU LoLin V3 — WiFi Bridge + Web Server  v3.0.0
//  Protocollo: JSON su Serial ↔ Mega  |  JSON su HTTP ↔ PC/Browser
//  Librerie: ESP8266WiFi, ESP8266WebServer, WiFiUdp,
//            ESP8266mDNS, ArduinoJson 6.x, ArduinoOTA

//  Board: NodeMCU 1.0 (ESP-12E Module)
//  Vedi: schema_json.md per il protocollo completo
// ================================================================
//  CONNESSIONI FISICHE:
//    NodeMCU RX  <- Mega TX1 (pin 18)  via partitore 1kΩ+2kΩ
//    NodeMCU TX  -> Mega RX1 (pin 19)  diretto
//    NodeMCU GND -- Mega GND           comune
//    NodeMCU VIN <- Mega pin 4 via relay/MOSFET (alimentazione)
// ================================================================


#include <EEPROM.h>
#include <ESP8266HTTPClient.h>

#include <ESP8266WebServer.h>
#include <ESP8266WiFi.h>
#include <ESP8266mDNS.h>

#include <WiFiClientSecure.h>
#include <WiFiUdp.h>
#include <ArduinoJson.h>
#include <ArduinoOTA.h>
#include <DNSServer.h>


// ── Costanti ─────────────────────────────────────────────────────
// #define DEVICE_NAME "NodeMCU-PlantWiFi" // ORA DINAMICO
String deviceName = "PlantWiFi";
#define DEVICE_TYPE "NodeMCU LoLin V3"
#define FIRMWARE_VERSION "3.0.0"
#define MDNS_NAME "Plant"
#define AP_SSID "PLANT-Setup"
#define AP_PASSWORD                                                            \
  "" // Vuoto = rete AP APERTA (senza password) per facilitare setup
#define AP_IP_STR "192.168.4.1"

#define UDP_LISTEN_PORT 4210
#define UDP_BROADCAST_PORT 4211
#define DISCOVER_MAGIC "DISCOVER"

#define BROADCAST_INTERVAL 10000UL
#define CARD_INTERVAL_NO_WIFI 8000UL
#define CARD_INTERVAL_NO_MEGA 15000UL
#define MEGA_HEARTBEAT_TIMEOUT 15000UL // se no heartbeat per 15s → mega offline
#define DATA_REQUEST_INTERVAL 3000UL

#define EEPROM_SIZE 512
#define EEPROM_SSID 0
#define EEPROM_PASS 33
#define EEPROM_NAME 96
#define EEPROM_METEO_KEY 128
#define EEPROM_NEWS_KEY 160
#define EEPROM_CITY 192
#define EEPROM_SH_URL 224
#define EEPROM_SH_KEY 288
#define EEPROM_SPOTIFY_REFRESH 320
#define EEPROM_SPOTIFY_CREDS 384
#define EEPROM_BUZZER_ALARMS 480

// ── Buffer / protezione ──────────────────────────────────────────
#define SERIAL_BUF_MAX 1024
#define SERIAL_MSG_TIMEOUT 2000UL

// ── WiFi reconnect ───────────────────────────────────────────────
#define WIFI_RETRY_BASE 2000UL
#define WIFI_RETRY_MAX 60000UL
#define WIFI_CONNECT_TIMEOUT                                                   \
  50 // tentativi (x500ms = 25s) per router lenti o instabili

// ── Debug ────────────────────────────────────────────────────────
#define DBG_NONE    0
#define DBG_ERROR   1
#define DBG_WARN    2
#define DBG_INFO    3
#define DBG_VERBOSE 4

uint8_t debugLevel = DBG_WARN; // Default silenziato (livello 2)

// Porta per i log (Serial1 = pin D4/TX solo)
#define LOG_SERIAL Serial1 

#define DBG(lvl, msg) do { \
  if (debugLevel >= (lvl)) { \
    LOG_SERIAL.print(F("[" #lvl "] ")); \
    LOG_SERIAL.println(msg); \
  } \
} while(0)

#define LOG_E(msg) DBG(DBG_ERROR,   msg)
#define LOG_W(msg) DBG(DBG_WARN,    msg)
#define LOG_I(msg) DBG(DBG_INFO,    msg)
#define LOG_V(msg) DBG(DBG_VERBOSE, msg)

// ── API Keys (Placeholder) ──────────────────────────────────────
String meteoApiKey = "TU_API_KEY_OPENWEATHER"; 
String newsApiKey = "TU_API_KEY_NEWSAPI";      
String city = "Milano";

String spotifyToken = "";        
String spotifyRefreshToken = ""; 
String spotifyCredentials = "";  
String smartHomeUrl = "";        
String smartHomeKey = "";        

// ── Timer API ───────────────────────────────────────────────────
unsigned long lastMeteoMs = 0;
unsigned long lastNewsMs = 0;
#define METEO_INTERVAL (30 * 60 * 1000UL) 
#define NEWS_INTERVAL (60 * 60 * 1000UL)  

// ── Oggetti ──────────────────────────────────────────────────────
ESP8266WebServer server(80);
WiFiUDP udp;
DNSServer dnsServer;

// ── Stato WiFi ───────────────────────────────────────────────────
String wifiSSID = "";
String wifiPASS = "";
bool wifiConnesso = false;
bool modalitaAP = false;
unsigned long wifiRetryInterval = WIFI_RETRY_BASE;
unsigned long wifiLastRetryMs = 0;

// ── Stato sistema (specchio del Mega) ────────────────────────────
float temp = 0.0f;
float hum = 0.0f;
float phValue = 7.0f;
bool tempAlert = false;
bool humAlert = false;
bool phAlertLow = false;
bool phAlertHigh = false;
bool dhtOnline = true;
bool buzzerOn = false;
int buzzerFreq = 0;
bool btnPressed = false;
bool pumpOn = false;
int pumpSpeed = 0;
String pumpLastOn = "mai";
bool monitorOn = false;
bool buzzerAlarmsEnabled =
    false; // Master allarmi ricevuto dal Mega (default OFF)

// Data/ora/geo
int dtYear = 2025, dtMonth = 1, dtDay = 1;
int dtHour = 0, dtMinute = 0, dtSecond = 0;
String dtWeekday = "---";
float geoLat = 0.0f, geoLon = 0.0f;
String geoCity = "";
float weatherTemp = 0.0f;
String weatherDesc = "";
String lastNews = "";

// ── Stato Mega ───────────────────────────────────────────────────
bool megaOnline = false;
bool megaSynched = false;
unsigned long lastHeartbeatMs = 0;
unsigned long lastDataMs = 0;
unsigned long lastSyncSentMs = 0;
const unsigned long SYNC_RETRY_INTERVAL = 2000UL;
int megaFreeRam = 0;
unsigned long megaUptime = 0;

// ── Timer ────────────────────────────────────────────────────────
unsigned long lastCardMs = 0;
unsigned long lastBcastMs = 0;
unsigned long lastReqMs = 0;

// ── Buffer seriale ───────────────────────────────────────────────
String serialBuffer = "";
unsigned long serialLastCharMs = 0;

// ── Contatori errori (diagnostica) ──────────────────────────────
uint16_t errJsonParse = 0;
uint16_t errBufferOver = 0;
uint16_t errWifiLost = 0;

// =================================================================
//  SETUP
// =================================================================
void setup() {
  Serial.begin(115200);   // Collegato al Mega (TX/RX)
  Serial1.begin(115200);  // Solo TX (pin D4) per Debug Log
  EEPROM.begin(EEPROM_SIZE);
  caricaCredenziali();

  serialBuffer.reserve(SERIAL_BUF_MAX);

  inviaAlMega(F("{\"type\":\"STATUS\",\"msg\":\"BOOT\"}"));
  DBG(DBG_INFO, F("PLANT NodeMCU v3.0.0 — Avvio"));

  // Connessione WiFi
  if (wifiSSID.length() > 0) {
    if (!connetti()) {
      avviaAP();
    }
  } else {
    avviaAP();
  }

  // ── Route HTTP ──
  server.on("/", HTTP_GET, handleRoot);
  server.on("/info", HTTP_GET, handleInfo);
  server.on("/setup", HTTP_GET, handleSetupPage);
  server.on("/dosetup", HTTP_GET, handleDoSetup);
  server.on("/api/data", HTTP_GET, handleGetData);
  server.on("/api/scan", HTTP_GET, handleScan);
  server.on("/api/set", HTTP_GET, handleSet);
  server.on("/api/setwifi", HTTP_GET, handleSetWifi);
  server.on("/api/reboot", HTTP_GET, handleReboot);
  server.on("/api/status", HTTP_GET, handleStatus);
  server.on("/api/settings", HTTP_GET, handleGetSettings);
  server.on("/api/settings", HTTP_POST, handleSetSettings);

  // ── Captive Portal Detection Routes ──
  server.on("/generate_204", handleCaptivePortal);        // Android / Chrome
  server.on("/favicon.ico", []() { server.send(204); });  // Favicon silent
  server.on("/hotspot-detect.html", handleCaptivePortal); // Apple
  server.on("/connectivitycheck.gstatic.com/generate_204", handleCaptivePortal);
  server.on("/connectivity-check.html", handleCaptivePortal); // Windows 10/11
  server.on("/msftconnecttest.com/connecttest.txt",
            handleCaptivePortal);              // Windows
  server.on("/ncsi.txt", handleCaptivePortal); // Windows
  server.on("/redirect", handleCaptivePortal); // Windows redirect
  server.on("/Library/test/success.html", handleCaptivePortal); // Apple legacy
  server.on("/kindle-wifi/wifiredirect.html", handleCaptivePortal); // Kindle

  // CORS preflight
  server.on("/api/data", HTTP_OPTIONS, sendCORSPreflight);
  server.on("/api/set", HTTP_OPTIONS, sendCORSPreflight);
  server.on("/api/status", HTTP_OPTIONS, sendCORSPreflight);
  server.on("/api/scan", HTTP_OPTIONS, sendCORSPreflight);
  server.on("/api/setwifi", HTTP_OPTIONS, sendCORSPreflight);

  server.onNotFound([]() {
    if (modalitaAP) {
      server.sendHeader("Location", String("http://") + AP_IP_STR + "/setup",
                        true);
      server.send(302, "text/plain", "");
      return;
    }
    addCORSHeaders();
    server.send(404, "application/json",
                F("{\"ok\":false,\"msg\":\"Not found\"}"));
  });

  server.begin();
  udp.begin(UDP_LISTEN_PORT);

  if (wifiConnesso) {
    avviaMDNS();
    setupOTA();
    inviaUDPBroadcast();
    lastBcastMs = millis();
    inviaAlMega(
        String(F("{\"type\":\"STATUS\",\"msg\":\"CONNECTED\",\"ip\":\"")) +
        WiFi.localIP().toString() + String(F("\",\"ssid\":\"")) + wifiSSID +
        String(F("\"}")));
  }

  // Watchdog ESP
  ESP.wdtEnable(WDTO_8S);
  DBG(DBG_INFO, F("Setup completato"));
}

// =================================================================
//  LOOP
// =================================================================
void loop() {
  ESP.wdtFeed();

  server.handleClient();
  if (modalitaAP) {
    dnsServer.processNextRequest();
  }
  if (wifiConnesso) {
    MDNS.update();
    ArduinoOTA.handle();
  }

  leggiSerial();
  leggiUDP();

  unsigned long now = millis();

  // ── Timeout buffer seriale parziale ──
  if (serialBuffer.length() > 0 &&
      (now - serialLastCharMs > SERIAL_MSG_TIMEOUT)) {
    DBG(DBG_WARN, F("Timeout buffer seriale, msg scartato"));
    serialBuffer = "";
    errBufferOver++;
  }

  // ── Biglietto da visita (quando non connesso o Mega offline) ──
  if (!wifiConnesso && (now - lastCardMs > CARD_INTERVAL_NO_WIFI)) {
    inviaBigliettoSerial();
    lastCardMs = now;
  } else if (wifiConnesso && !megaOnline &&
             (now - lastCardMs > CARD_INTERVAL_NO_MEGA)) {
    inviaBigliettoSerial();
    lastCardMs = now;
  }

  // ── Broadcast UDP periodico ──
  if (wifiConnesso && (now - lastBcastMs > BROADCAST_INTERVAL)) {
    inviaUDPBroadcast();
    lastBcastMs = now;
  }

  // ── Richiesta dati periodica al Mega (solo se sincronizzati) ──
  if (megaSynched && (now - lastReqMs > DATA_REQUEST_INTERVAL)) {
    lastReqMs = now;
    inviaAlMega(F("{\"type\":\"GET\"}"));

    // Inoltra ciclicamente lo stato WiFi al Mega dopo il SYNC
    static uint8_t statusCycle = 0;
    statusCycle++;
    if (statusCycle >= 3) { // Ogni ~9 secondi
      statusCycle = 0;
      if (wifiConnesso) {
        inviaAlMega(
            String(F("{\"type\":\"STATUS\",\"msg\":\"CONNECTED\",\"ip\":\"")) +
            WiFi.localIP().toString() + String(F("\",\"ssid\":\"")) + wifiSSID +
            String(F("\"}")));
      } else if (modalitaAP) {
        Serial.println(F("STATUS:AP_MODE"));
      }
    }
  }

  // ── Sincronizzazione Iniziale Handshake ──
  if (!megaSynched && (now - lastSyncSentMs > SYNC_RETRY_INTERVAL)) {
    lastSyncSentMs = now;
    inviaAlMega(F("{\"type\":\"SYNC\",\"step\":1}"));
    DBG(DBG_INFO, F("SYNC: Inviato Step 1..."));
  }

  // ── Stato Mega (heartbeat / data timeout) ──
  if (megaOnline && (now - lastHeartbeatMs > MEGA_HEARTBEAT_TIMEOUT)) {
    megaOnline = false;
    megaSynched = false;
    DBG(DBG_WARN, F("Mega OFFLINE — heartbeat timeout. Richiesto nuovo SYNC."));
  }
  
  // Se siamo sincronizzati ma non riceviamo DATI sensori da troppo tempo
  if (megaSynched && (now - lastDataMs > 30000UL)) {
    megaSynched = false;
    DBG(DBG_WARN, F("Nessun dato sensore per 30s. Reset SYNC."));
  }

  // ── Aggiornamento API Esterne (solo se WiFi connesso) ──
  if (wifiConnesso) {
    if (now - lastMeteoMs > METEO_INTERVAL || lastMeteoMs == 0) {
      updateMeteo();
      lastMeteoMs = now;
    }
    if (now - lastNewsMs > NEWS_INTERVAL || lastNewsMs == 0) {
      updateNews();
      lastNewsMs = now;
    }
  }

  // ── Riconnessione WiFi automatica ──
  if (wifiConnesso && WiFi.status() != WL_CONNECTED) {
    wifiConnesso = false;
    errWifiLost++;
    wifiRetryInterval = WIFI_RETRY_BASE;
    DBG(DBG_WARN, F("WiFi perso, tentativo riconnessione..."));
  }
  if (!wifiConnesso && !modalitaAP && wifiSSID.length() > 0) {
    if (now - wifiLastRetryMs > wifiRetryInterval) {
      wifiLastRetryMs = now;
      DBG(DBG_INFO, String(F("WiFi retry (backoff: ")) +
            String(wifiRetryInterval / 1000) + "s)");
      if (connetti()) {
        wifiRetryInterval = WIFI_RETRY_BASE;
        avviaMDNS();
        setupOTA();
        inviaUDPBroadcast();
        inviaAlMega(
            String(F("{\"type\":\"STATUS\",\"msg\":\"CONNECTED\",\"ip\":\"")) +
            WiFi.localIP().toString() + String(F("\",\"ssid\":\"")) + wifiSSID +
            String(F("\"}")));
      } else {
        // Backoff esponenziale
        wifiRetryInterval = min(wifiRetryInterval * 2, WIFI_RETRY_MAX);
      }
    }
  }
}

// =================================================================
//  CORS helpers
// =================================================================
void addCORSHeaders() {
  server.sendHeader(F("Access-Control-Allow-Origin"), F("*"));
  server.sendHeader(F("Access-Control-Allow-Methods"), F("GET, POST, OPTIONS, PATCH, DELETE"));
  server.sendHeader(F("Access-Control-Allow-Headers"), F("Content-Type, Authorization"));
  // Richiesto da Chrome per connessioni local -> private network (NodeMCU)
  server.sendHeader(F("Access-Control-Allow-Private-Network"), F("true"));
  // Cache delle autorizzazioni CORS per 24 ore (velocizza polling)
  server.sendHeader(F("Access-Control-Max-Age"), F("86400"));
}

void sendCORSPreflight() {
  addCORSHeaders();
  server.send(204, "", "");
}

// =================================================================
//  INVIO AL MEGA (JSON su Serial)
// =================================================================
void inviaAlMega(const String &json) { 
  Serial.print(json); 
  Serial.print('\n');
}

// =================================================================
//  OTA SETUP
// =================================================================
void setupOTA() {
  ArduinoOTA.setHostname(MDNS_NAME);
  ArduinoOTA.setPassword("plant_ota_2025");

  ArduinoOTA.onStart([]() { DBG(DBG_INFO, F("OTA: aggiornamento avviato")); });
  ArduinoOTA.onEnd([]() { DBG(DBG_INFO, F("OTA: completato, riavvio")); });
  ArduinoOTA.onError([](ota_error_t error) {
    DBG(DBG_ERROR, String(F("OTA errore: ")) + String(error));
  });

  ArduinoOTA.begin();
  DBG(DBG_INFO, F("OTA pronto"));
}

// =================================================================
//  LETTURA SERIAL DAL MEGA
// =================================================================
void leggiSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    serialLastCharMs = millis();

    if (c == '\n') {
      serialBuffer.trim();
      if (serialBuffer.length() > 0) {
        gestisciMsgMega(serialBuffer);
      }
      serialBuffer = "";
    } else if (c != '\r') {
      if ((unsigned int)serialBuffer.length() < SERIAL_BUF_MAX) {
        serialBuffer += c;
      } else {
        serialBuffer = "";
        errBufferOver++;
        DBG(DBG_ERROR, F("Buffer overflow seriale, msg scartato"));
      }
    }
  }
}

// =================================================================
//  PARSING MESSAGGI DAL MEGA
// =================================================================
void gestisciMsgMega(const String &rawOriginal) {
  String raw = rawOriginal;
  raw.trim();
  String cmdLow = raw;
  cmdLow.toLowerCase();

  // ── Comandi Legacy ──
  if (raw.startsWith("SETWIFI_B64:")) {
    gestisciSetWifiB64(raw);
    return;
  }
  if (raw.startsWith("SETWIFI_SEP:")) {
    gestisciSetWifiSep(raw);
    return;
  }
  if (raw.startsWith("SETWIFI:")) {
    gestisciSetWifiLegacy(raw);
    return;
  }
  if (raw == "RESETWIFI") {
    wifiSSID = "";
    wifiPASS = "";
    salvaCredenziali();
    WiFi.disconnect();
    wifiConnesso = false;
    avviaAP();
    return;
  }
  if (raw == "GETIP") {
    Serial.println(wifiConnesso ? "IP:" + WiFi.localIP().toString()
                                : F("STATUS:NOT_CONNECTED"));
    return;
  }
  if (raw == "REBOOT") {
    Serial.println(F("STATUS:REBOOTING"));
    delay(200);
    ESP.restart();
    return;
  }

  // ── PLANT OS - Comandi di Base ──
  if (cmdLow == "help" || cmdLow == "?") {
    Serial.println(F("╔══════════════════════════════════╗"));
    Serial.println(F("║  PLANT OS (NodeMCU) - Comandi:   ║"));
    Serial.println(F("╠══════════════════════════════════╣"));
    Serial.println(F("║  status      → stato sistema     ║"));
    Serial.println(F("║  log <on/off>→ livello log debug ║"));
    Serial.println(F("║  reboot [all]→ riavvia scheda/e  ║"));
    Serial.println(F("║  wifi <test|set|info>            ║"));
    Serial.println(F("║  alarms [on/off]→ stato master   ║"));
    Serial.println(F("║  errors [clear]→ registro errori ║"));
    Serial.println(F("║  api <arg>   → info meteo/news.. ║"));
    Serial.println(F("╚══════════════════════════════════╝"));
    return;
  }

  if (cmdLow == "status") {
    Serial.println(F("── STATO NODEMCU ──"));
    Serial.print(F("  Rete WiFi: "));
    Serial.print(wifiSSID);
    Serial.print(F(" | IP: "));
    Serial.println(wifiConnesso ? WiFi.localIP().toString() : "Scollegato");
    Serial.print(F("  Uptime:    "));
    Serial.print(millis() / 1000);
    Serial.println(F("s"));
    Serial.print(F("  Heap lib:  "));
    Serial.print(ESP.getFreeHeap());
    Serial.println(F(" byte"));
    Serial.print(F("  Mega:      "));
    Serial.println(megaOnline ? "Connesso" : "Offline");
    return;
  }

  if (cmdLow.startsWith("log ")) {
    if (cmdLow == "log on") {
      debugLevel = DBG_VERBOSE;
      Serial.println(F("Log abilitati"));
    } else if (cmdLow == "log off") {
      debugLevel = DBG_NONE;
      Serial.println(F("Log disabilitati"));
    }
    return;
  }

  if (cmdLow.startsWith("reboot")) {
    // Gestisce anche "reboot all" in quanto il Mega invierà "REBOOT" al wifi se
    // richiesto
    Serial.println(F("Riavvio NodeMCU..."));
    delay(500);
    ESP.restart();
    return;
  }

  if (cmdLow.startsWith("wifi ")) {
    String arg = raw.substring(5);
    arg.trim();
    if (arg.equalsIgnoreCase("test") || arg.equalsIgnoreCase("info")) {
      Serial.println(F("Stato WiFi: ") +
                     String(wifiConnesso ? "Connesso" : "Disconnesso"));
      if (wifiConnesso) {
        Serial.println(F("SSID: ") + wifiSSID);
        Serial.println(F("IP: ") + WiFi.localIP().toString());
        Serial.println(F("RSSI: ") + String(WiFi.RSSI()) + " dBm");
      }
      return;
    }
    if (arg.substring(0, 4).equalsIgnoreCase("set ")) {
      String creds = arg.substring(4);
      creds.trim();
      int sep = creds.indexOf(' ');
      if (sep > 0) {
        wifiSSID = creds.substring(0, sep);
        wifiPASS = creds.substring(sep + 1);
        Serial.println(F("Nuove credenziali WiFi impostate. Riconnessione..."));
        salvaCredenziali();
        connetti();
      } else {
        Serial.println(F("Uso: wifi set <ssid> <pwd>"));
      }
      return;
    }
    return;
  }

  if (cmdLow.startsWith("alarms")) {
    if (cmdLow == "alarms") {
      Serial.println(F("── STATO ALLARMI (NodeMCU) ──"));
      Serial.print(F("  Master Buzzer (da Mega): "));
      Serial.println(buzzerAlarmsEnabled ? F("ON") : F("OFF"));
      Serial.println(F("  Nota: Le soglie specifiche sono gestite dal Mega."));
    } else {
      Serial.println(F("[NodeMCU] Inoltro comando alarms al Mega..."));
      inviaAlMega(raw);
    }
    return;
  }

  if (cmdLow.startsWith("errors")) {
    if (cmdLow == "errors clear") {
      errJsonParse = 0;
      errBufferOver = 0;
      errWifiLost = 0;
      Serial.println(F("Registri errori cancellati."));
    } else {
      Serial.println(F("── CONTATORI ERRORI NODEMCU ──"));
      Serial.print(F("  JSON parse:  "));
      Serial.println(errJsonParse);
      Serial.print(F("  Buf overflow:"));
      Serial.println(errBufferOver);
      Serial.print(F("  WiFi connect:"));
      Serial.println(errWifiLost);
    }
    return;
  }

  // ── mock API (Meteo, News, Musica, Smart) ──
  if (cmdLow.startsWith("api ")) {
    Serial.print(F("[NodeMCU] API Info: "));
    Serial.println(raw.substring(4));
    return;
  }
  if (cmdLow.startsWith("meteo")) {
    if (cmdLow == "meteo") {
      Serial.println(F("── STATO METEO (NodeMCU) ──"));
      Serial.print(F("  Città:      "));
      Serial.println(geoCity);
      Serial.println(F("  Fetch:      [mock] OK (15m fa)"));
    } else {
      Serial.println(F("[NodeMCU] Fetching weather (MOCK)..."));
    }
    return;
  }
  if (cmdLow.startsWith("news")) {
    if (cmdLow == "news") {
      Serial.println(F("── STATO NEWS (NodeMCU) ──"));
      Serial.println(F("  Service:    [mock] Google News API"));
      Serial.println(F("  Cached:     3 articoli pronti."));
    } else {
      Serial.println(F("[NodeMCU] Fetching news (MOCK)..."));
    }
    return;
  }
  if (cmdLow.startsWith("musica")) {
    if (cmdLow == "musica") {
      Serial.println(F("── STATO MUSICA (NodeMCU) ──"));
      Serial.println(F("  Player:     [mock] IDLE"));
    } else {
      Serial.println(F("[NodeMCU] Inoltro player musicale (MOCK)..."));
    }
    return;
  }
  if (cmdLow.startsWith("smart")) {
    if (cmdLow == "smart") {
      Serial.println(F("── STATO SMART HOME (NodeMCU) ──"));
      Serial.println(F("  Bridge:     [mock] Home Assistant Online"));
      Serial.println(F("  Nodes:      4 dispositivi connessi."));
    } else {
      Serial.println(F("[NodeMCU] Inoltro Smart Home (MOCK)..."));
    }
    return;
  }
  // ── set <var>=<val> ──
  if (cmdLow.startsWith("set ")) {
    String arg = raw.substring(4);
    arg.trim();
    int sepIdx = arg.indexOf('=');
    if (sepIdx < 0)
      sepIdx = arg.indexOf(' ');

    if (sepIdx > 0) {
      String prop = arg.substring(0, sepIdx);
      prop.trim();
      prop.toLowerCase();

      if (prop == "wifi" || prop == "ssid" || prop == "wifi_set") {
        // Gestione locale WiFi se necessario, ma di solito si usa wifi set
        Serial.println(F("[NodeMCU] Usa 'wifi set <ssid> <pwd>' per la rete."));
        return;
      }
      // Inoltro al Mega per tutto il resto (hardware, allarmi, ecc)
      Serial.println(F("[NodeMCU] Inoltro SET al Mega..."));
      inviaAlMega(raw);
    } else {
      Serial.println(F("Uso: set <var>=<val>"));
    }
    return;
  }

  // ── get <var> ──
  if (cmdLow.startsWith("get")) {
    String arg = cmdLow.substring(3);
    arg.trim();
    if (arg == "" || arg == "help" || arg == "list") {
      Serial.println(F("── VARIABILI PLANT (NodeMCU) ──"));
      Serial.println(F("  Locali:  ip, ssid, uptime, rssi, ram, debug"));
      Serial.println(F("  Mega:    (Qualsiasi variabile gestita dal Mega)"));
      Serial.println(F("           Digita 'get <var>' per chiedere al Mega."));
      return;
    }

    if (arg == "ip") {
      Serial.print(F("IP: "));
      Serial.println(WiFi.localIP());
    } else if (arg == "ssid") {
      Serial.print(F("SSID: "));
      Serial.println(wifiSSID);
    } else if (arg == "rssi") {
      Serial.print(F("RSSI: "));
      Serial.println(WiFi.RSSI());
    } else if (arg == "uptime") {
      Serial.print(F("Uptime: "));
      Serial.println(millis() / 1000);
    } else if (arg == "ram") {
      Serial.print(F("Free RAM: "));
      Serial.println(ESP.getFreeHeap());
    } else {
      Serial.println(F("[NodeMCU] Richiesta GET inoltrata al Mega..."));
      inviaAlMega(raw);
    }
    return;
  }

  if (cmdLow == "update all" || cmdLow == "sync") {
    Serial.println(F("[NodeMCU] Richiesta sync con il Mega"));
    inviaAlMega(F("{\"type\":\"GET\"}"));
    return;
  }

  // Se non è JSON e non è uno dei comandi legacy sopra, ignoriamo
  // silenziosamente (evita spam se l'utente scrive comandi nel terminale)
  if (!raw.startsWith("{")) {
    LOG_V(String(F("Msg non-JSON ignorato: ")) + raw);
    return;
  }

  // ── Parsing JSON (dal Mega) ──
  int jsonStart = raw.indexOf('{');
  if (jsonStart < 0) {
    if (raw.startsWith("CARD:") || raw.startsWith("STATUS:")) return;
    LOG_V(String(F("Msg testo da Mega: ")) + raw);
    return;
  }

  String jsonPart = raw.substring(jsonStart);
  StaticJsonDocument<1536> doc;
  DeserializationError err = deserializeJson(doc, jsonPart);

  if (err) {
    errJsonParse++;
    LOG_W(String(F("JSON parse error: ")) + err.c_str() + " | Raw: " + raw.substring(0, 30));
    return;
  }

  const char *type = doc[F("type")] | "";

  // ── HANDSHAKE SYNC ──
  if (strcmp(type, "SYNC") == 0) {
    int step = doc[F("step")] | 0;
    if (step == 2) {
      // Step 2 ricevuto -> Rispondi con Step 3
      inviaAlMega(F("{\"type\":\"SYNC\",\"step\":3}"));
      megaSynched = true;
      megaOnline = true;
      lastHeartbeatMs = millis();
      LOG_I(F("SYNC: Step 2 ricevuto -> Inviato Step 3. BOARD SINCRONIZZATE!"));
    }
    return;
  }

  // ── HEARTBEAT / DATA (Trattiamo ogni JSON valido come segno di vita) ──
  megaOnline = true;
  lastHeartbeatMs = millis();

  if (strcmp(type, "HEARTBEAT") == 0) {
    megaUptime = doc[F("uptime")] | 0UL;
    megaFreeRam = doc[F("free_ram")] | 0;
    LOG_V(String(F("Mega heartbeat — uptime:")) + String(megaUptime) +
          "s ram:" + String(megaFreeRam));
    return;
  }

  // ── DATA ──
  if (strcmp(type, "DATA") == 0) {
    lastDataMs = millis();
    if (doc.containsKey(F("temperature"))) {
      temp = doc[F("temperature")][F("value")] | 0.0f;
      tempAlert = doc[F("temperature")][F("alert")] | false;
      dhtOnline = doc[F("temperature")][F("online")] | true;
    }
    if (doc.containsKey(F("humidity"))) {
      hum = doc[F("humidity")][F("value")] | 0.0f;
      humAlert = doc[F("humidity")][F("alert")] | false;
    }
    if (doc.containsKey(F("ph"))) {
      phValue = doc[F("ph")][F("value")] | 7.0f;
      phAlertLow = doc[F("ph")][F("alert_low")] | false;
      phAlertHigh = doc[F("ph")][F("alert_high")] | false;
    }
    if (doc.containsKey(F("buzzer"))) {
      buzzerOn = doc[F("buzzer")][F("on")] | false;
      buzzerFreq = doc[F("buzzer")][F("freq")] | 0;
    }
    if (doc.containsKey(F("button"))) {
      btnPressed = doc[F("button")][F("pressed")] | false;
    }
    if (doc.containsKey(F("pump"))) {
      pumpOn = doc[F("pump")][F("on")] | false;
      pumpSpeed = doc[F("pump")][F("speed")] | 0;
      pumpLastOn = doc[F("pump")][F("last_on")] | "mai";
    }
    if (doc.containsKey(F("monitor"))) {
      monitorOn = doc[F("monitor")][F("on")] | false;
    }
    if (doc.containsKey(F("datetime"))) {
      dtYear = doc[F("datetime")][F("year")] | 2025;
      dtMonth = doc[F("datetime")][F("month")] | 1;
      dtDay = doc[F("datetime")][F("day")] | 1;
      dtHour = doc[F("datetime")][F("hour")] | 0;
      dtMinute = doc[F("datetime")][F("minute")] | 0;
      dtSecond = doc[F("datetime")][F("second")] | 0;
      dtWeekday = doc[F("datetime")][F("weekday")] | "---";
    }
    if (doc.containsKey(F("geo"))) {
      geoLat = doc[F("geo")][F("lat")] | 0.0f;
      geoLon = doc[F("geo")][F("lon")] | 0.0f;
      geoCity = doc[F("geo")][F("city")] | "";
    }
    if (doc.containsKey(F("settings"))) {
      buzzerAlarmsEnabled = doc[F("settings")][F("buzzer_alarms")] | false;
    }
    lastDataMs = millis();
    megaOnline = true;
    LOG_V(F("DATA ricevuto dal Mega"));
    return;
  }

  // ── EVENT ──
  if (strcmp(type, "EVENT") == 0) {
    const char *ev = doc[F("event")] | "";
    if (strcmp(ev, "BUTTON") == 0) {
      btnPressed = doc[F("pressed")] | false;
      LOG_I(String(F("Evento pulsante: ")) +
            (btnPressed ? "premuto" : "rilasciato"));
    }
    return;
  }

  // ── COMMAND ──
  if (strcmp(type, "COMMAND") == 0) {
    const char *action = doc[F("action")] | "";
    if (strcmp(action, "broadcast") == 0) {
      LOG_I(F("Broadcast UDP (Welcome Card) inviato su richiesta di Mega"));
      inviaUDPBroadcast();
    }
    return;
  }

  // ── SET (dal Mega, es. config wifi) ──
  if (strcmp(type, "SET") == 0) {
    const char *target = doc[F("target")] | "";
    if (strcmp(target, "wifi") == 0) {
      wifiSSID = doc[F("ssid")] | "";
      wifiPASS = doc[F("pwd")] | "";
      LOG_I(String(F("Nuovo WiFi ricevuto da Mega: ")) + wifiSSID);
      salvaCredenziali();
      connetti();
      if (!wifiConnesso)
        avviaAP();
    }
    return;
  }

  // ── ACK ──
  if (strcmp(type, "ACK") == 0) {
    LOG_V(String(F("ACK da Mega: ")) + (doc[F("target")] | "?"));
    return;
  }

  // ── STATUS ──
  if (strcmp(type, "STATUS") == 0) {
    LOG_I(String(F("Mega status: ")) + (doc[F("msg")] | ""));
    return;
  }
}

// =================================================================
//  API — /api/settings (GET/POST)
// =================================================================
void handleGetSettings() {
  StaticJsonDocument<512> doc;
  doc[F("device_name")] = deviceName;
  doc[F("meteo_key")] = meteoApiKey;
  doc[F("news_key")] = newsApiKey;
  doc[F("city")] = city;
  doc[F("sh_url")] = smartHomeUrl;
  doc[F("sh_key")] = smartHomeKey;
  doc[F("spotify_refresh")] = spotifyRefreshToken;
  doc[F("spotify_creds")] = spotifyCredentials;
  doc[F("buzzer_alarms")] = buzzerAlarmsEnabled;

  String out;
  serializeJson(doc, out);
  addCORSHeaders();
  server.send(200, "application/json", out);
}

bool testMeteo(String key, String c) {
  if (key.length() == 0 || key == "TU_API_KEY_OPENWEATHER")
    return true;
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = "https://api.openweathermap.org/data/2.5/weather?q=" + c +
               "&appid=" + key;
  if (http.begin(client, url)) {
    int code = http.GET();
    http.end();
    return (code == 200);
  }
  return false;
}

bool testNews(String key) {
  if (key.length() == 0 || key == "TU_API_KEY_NEWSAPI")
    return true;
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = "https://newsapi.org/v2/top-headlines?country=it&apiKey=" + key;
  if (http.begin(client, url)) {
    int code = http.GET();
    http.end();
    return (code == 200);
  }
  return false;
}

void handleSetSettings() {
  addCORSHeaders();
  String errorMsg = "";

  String newName = server.hasArg("name") ? server.arg("name") : deviceName;
  String newMeteo =
      server.hasArg("meteo_key") ? server.arg("meteo_key") : meteoApiKey;
  String newNews =
      server.hasArg("news_key") ? server.arg("news_key") : newsApiKey;
  String newCity = server.hasArg("city") ? server.arg("city") : city;
  String newShUrl =
      server.hasArg("sh_url") ? server.arg("sh_url") : smartHomeUrl;
  String newShKey =
      server.hasArg("sh_key") ? server.arg("sh_key") : smartHomeKey;
  String newSpotR = server.hasArg("spotify_refresh")
                        ? server.arg("spotify_refresh")
                        : spotifyRefreshToken;
  String newSpotC = server.hasArg("spotify_creds") ? server.arg("spotify_creds")
                                                   : spotifyCredentials;
  bool newBuzzerAlarms = server.hasArg("buzzer_alarms") ? (server.arg("buzzer_alarms") == "true" || server.arg("buzzer_alarms") == "1") : buzzerAlarmsEnabled;

  // Validazione
  if (!testMeteo(newMeteo, newCity))
    errorMsg += "OpenWeather Key non valida o città errata. ";
  if (!testNews(newNews))
    errorMsg += "NewsAPI Key non valida. ";

  if (errorMsg.length() > 0) {
    server.send(400, "application/json",
                "{\"ok\":false,\"msg\":\"" + errorMsg + "\"}");
    return;
  }

  // Se richiesto solo test, fermati qui
  if (server.hasArg("test_only") && server.arg("test_only") == "true") {
    server.send(200, "application/json",
                "{\"ok\":true,\"msg\":\"Test API superato con successo!\"}");
    return;
  }

  // Salvataggio
  deviceName = newName;
  meteoApiKey = newMeteo;
  newsApiKey = newNews;
  city = newCity;
  smartHomeUrl = newShUrl;
  smartHomeKey = newShKey;
  spotifyRefreshToken = newSpotR;
  spotifyCredentials = newSpotC;
  buzzerAlarmsEnabled = newBuzzerAlarms;
  
  // Inoltra al Mega il nuovo stato allarmi
  inviaAlMega("{\"type\":\"SET\",\"target\":\"settings\",\"buzzer_alarms\":" + String(buzzerAlarmsEnabled ? "true" : "false") + "}");
  
  salvaConfig();

  server.send(
      200, "application/json",
      "{\"ok\":true,\"msg\":\"Impostazioni salvate! Riavvio in corso...\"}");
  delay(1000);
  ESP.restart();
}

// =================================================================
//  HTTP — /api/data  → JSON completo stato sistema
// =================================================================
void handleGetData() {
  addCORSHeaders();
  StaticJsonDocument<1536> doc;
  doc[F("type")] = "DATA";

  JsonObject t = doc.createNestedObject(F("temperature"));
  t[F("value")] = serialized(String(temp, 1));
  t[F("unit")] = "C";
  t[F("status")] = tempAlert ? "ALLERTA" : "OK";
  t[F("alert")] = tempAlert;
  t[F("online")] = dhtOnline;

  JsonObject h = doc.createNestedObject(F("humidity"));
  h[F("value")] = serialized(String(hum, 1));
  h[F("unit")] = "%";
  h[F("alert")] = humAlert;

  JsonObject ph = doc.createNestedObject(F("ph"));
  ph[F("value")] = serialized(String(phValue, 2));
  ph[F("alert_low")] = phAlertLow;
  ph[F("alert_high")] = phAlertHigh;
  ph[F("status")] = phAlertLow ? "ACIDO" : (phAlertHigh ? "BASICO" : "OK");

  JsonObject bz = doc.createNestedObject(F("buzzer"));
  bz[F("on")] = buzzerOn;
  bz[F("freq")] = buzzerFreq;

  JsonObject bn = doc.createNestedObject(F("button"));
  bn[F("pressed")] = btnPressed;

  JsonObject pm = doc.createNestedObject(F("pump"));
  pm[F("on")] = pumpOn;
  pm[F("speed")] = pumpSpeed;
  pm[F("last_on")] = pumpLastOn;

  JsonObject mo = doc.createNestedObject(F("monitor"));
  mo[F("on")] = monitorOn;

  JsonObject dt = doc.createNestedObject(F("datetime"));
  dt[F("year")] = dtYear;
  dt[F("month")] = dtMonth;
  dt[F("day")] = dtDay;
  dt[F("hour")] = dtHour;
  dt[F("minute")] = dtMinute;
  dt[F("second")] = dtSecond;
  dt[F("weekday")] = dtWeekday;

  JsonObject geo = doc.createNestedObject(F("geo"));
  geo[F("lat")] = serialized(String(geoLat, 6));
  geo[F("lon")] = serialized(String(geoLon, 6));
  geo[F("city")] = geoCity;

  JsonObject ext = doc.createNestedObject(F("external"));
  ext[F("temp")] = weatherTemp;
  ext[F("desc")] = weatherDesc;
  ext[F("city")] = geoCity;
  ext[F("news")] = lastNews;

  JsonObject net = doc.createNestedObject(F("network"));
  net[F("wifi")] =
      wifiConnesso ? "connesso" : (modalitaAP ? "access_point" : "disconnesso");
  net[F("ip")] = WiFi.localIP().toString();
  net[F("rssi")] = WiFi.RSSI();
  net[F("ssid")] = wifiSSID;
  net[F("mdns")] = String(MDNS_NAME) + ".local";
  net[F("uptime")] = millis() / 1000;
  net[F("data_age")] =
      lastDataMs > 0 ? (long)((millis() - lastDataMs) / 1000) : -1;
  net[F("mega_online")] = megaOnline;

  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

// =================================================================
//  HTTP — /api/status  → diagnostica sistema
// =================================================================
void handleStatus() {
  addCORSHeaders();
  StaticJsonDocument<512> doc;

  doc[F("device")] = deviceName;
  doc[F("firmware")] = FIRMWARE_VERSION;
  doc[F("uptime_s")] = millis() / 1000;
  doc[F("free_heap")] = ESP.getFreeHeap();
  doc[F("wifi")] =
      wifiConnesso ? "connesso" : (modalitaAP ? "access_point" : "disconnesso");
  doc[F("ip")] = WiFi.localIP().toString();
  doc[F("rssi")] = WiFi.RSSI();

  JsonObject mega = doc.createNestedObject(F("mega"));
  mega[F("online")] = megaOnline;
  mega[F("uptime_s")] = megaUptime;
  mega[F("free_ram")] = megaFreeRam;
  mega[F("data_age")] =
      lastDataMs > 0 ? (long)((millis() - lastDataMs) / 1000) : -1;

  JsonObject err = doc.createNestedObject(F("errors"));
  err[F("json_parse")] = errJsonParse;
  err[F("buffer_overflow")] = errBufferOver;
  err[F("wifi_lost")] = errWifiLost;

  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

// =================================================================
//  HTTP — /api/set?target=...&...  → invia SET al Mega
// =================================================================
void handleSet() {
  addCORSHeaders();

  if (!server.hasArg("target")) {
    server.send(400, "application/json",
                F("{\"ok\":false,\"msg\":\"target mancante\"}"));
    return;
  }
  String target = server.arg("target");

  StaticJsonDocument<256> cmd;
  cmd[F("type")] = "SET";
  cmd[F("target")] = target;

  if (target == "buzzer") {
    if (server.hasArg("freq")) {
      cmd[F("freq")] = server.arg("freq").toInt();
      if (server.hasArg("duration"))
        cmd[F("duration")] = server.arg("duration").toInt();
    } else {
      cmd[F("value")] =
          (server.arg("value") == "true" || server.arg("value") == "1");
    }
  } else if (target == "pump") {
    if (server.hasArg("on"))
      cmd[F("on")] = (server.arg("on") == "true" || server.arg("on") == "1");
    if (server.hasArg("speed"))
      cmd[F("speed")] = server.arg("speed").toInt();
    if (server.hasArg("duration"))
      cmd[F("duration")] = server.arg("duration").toInt();
  } else if (target == "monitor") {
    cmd[F("value")] =
        (server.arg("value") == "true" || server.arg("value") == "1");
  } else if (target == "datetime") {
    if (server.hasArg("year"))
      cmd[F("year")] = server.arg("year").toInt();
    if (server.hasArg("month"))
      cmd[F("month")] = server.arg("month").toInt();
    if (server.hasArg("day"))
      cmd[F("day")] = server.arg("day").toInt();
    if (server.hasArg("hour"))
      cmd[F("hour")] = server.arg("hour").toInt();
    if (server.hasArg("minute"))
      cmd[F("minute")] = server.arg("minute").toInt();
    if (server.hasArg("second"))
      cmd[F("second")] = server.arg("second").toInt();
    if (server.hasArg("weekday"))
      cmd[F("weekday")] = server.arg("weekday");
  } else if (target == "geo") {
    if (server.hasArg("lat"))
      cmd[F("lat")] = server.arg("lat").toFloat();
    if (server.hasArg("lon"))
      cmd[F("lon")] = server.arg("lon").toFloat();
    if (server.hasArg("city"))
      cmd[F("city")] = server.arg("city");
  } else if (target == "settings") {
    if (server.hasArg("buzzer_alarms")) {
      cmd[F("buzzer_alarms")] = (server.arg("buzzer_alarms") == "true" ||
                                 server.arg("buzzer_alarms") == "1");
    }
  } else if (target == "spotify") {
    if (server.hasArg("token"))
      spotifyToken = server.arg("token");
    if (server.hasArg("action"))
      spotifyAction(server.arg("action"));
    server.send(200, "application/json",
                F("{\"ok\":true,\"msg\":\"Spotify command sent\"}"));
    return;
  } else if (target == "smarthome") {
    if (server.hasArg("url"))
      smartHomeUrl = server.arg("url");
    if (server.hasArg("action"))
      smartHomeAction(server.arg("action"));
    server.send(200, "application/json",
                F("{\"ok\":true,\"msg\":\"SmartHome command sent\"}"));
    return;
  } else {
    server.send(400, "application/json",
                F("{\"ok\":false,\"msg\":\"target sconosciuto\"}"));
    return;
  }

  String out;
  serializeJson(cmd, out);
  inviaAlMega(out);

  // Aggiorna specchio locale per risposta immediata
  aggiornaSpecchioLocale(target, cmd);

  server.send(200, "application/json", "{\"ok\":true,\"sent\":" + out + "}");
  LOG_I(String(F("SET inoltrato: ")) + target);
}

// =================================================================
//  AGGIORNA SPECCHIO LOCALE (dopo SET)
// =================================================================
void aggiornaSpecchioLocale(const String &target,
                            const StaticJsonDocument<256> &cmd) {
  if (target == "buzzer") {
    if (cmd.containsKey(F("freq"))) {
      buzzerFreq = cmd[F("freq")] | 0;
      buzzerOn = (buzzerFreq > 0);
    } else {
      buzzerOn = cmd[F("value")] | false;
      buzzerFreq = buzzerOn ? 1000 : 0;
    }
  } else if (target == "monitor") {
    monitorOn = cmd[F("value")] | false;
  } else if (target == "pump") {
    if (cmd.containsKey(F("on")))
      pumpOn = cmd[F("on")] | false;
    if (cmd.containsKey(F("speed")))
      pumpSpeed = cmd[F("speed")] | 0;
  } else if (target == "datetime") {
    if (cmd.containsKey(F("year")))
      dtYear = cmd[F("year")];
    if (cmd.containsKey(F("month")))
      dtMonth = cmd[F("month")];
    if (cmd.containsKey(F("day")))
      dtDay = cmd[F("day")];
    if (cmd.containsKey(F("hour")))
      dtHour = cmd[F("hour")];
    if (cmd.containsKey(F("minute")))
      dtMinute = cmd[F("minute")];
    if (cmd.containsKey(F("second")))
      dtSecond = cmd[F("second")];
    if (cmd.containsKey(F("weekday")))
      dtWeekday = cmd[F("weekday")].as<String>();
  } else if (target == "geo") {
    if (cmd.containsKey(F("lat")))
      geoLat = cmd[F("lat")];
    if (cmd.containsKey(F("lon")))
      geoLon = cmd[F("lon")];
    if (cmd.containsKey(F("city")))
      geoCity = cmd[F("city")].as<String>();
  }
}

// =================================================================
//  WIFI SETUP (Base64, SEP, legacy)
// =================================================================
String b64decode(const String &input) {
  const char *b64c =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  String out = "";
  int val = 0, bits = -8;
  for (unsigned int i = 0; i < input.length(); i++) {
    char ch = input[i];
    if (ch == '=')
      break;
    const char *pos = strchr(b64c, ch);
    if (!pos)
      continue;
    val = (val << 6) + (int)(pos - b64c);
    bits += 6;
    if (bits >= 0) {
      out += (char)((val >> bits) & 0xFF);
      bits -= 8;
    }
  }
  return out;
}

void gestisciSetWifiB64(const String &cmd) {
  String p = cmd.substring(12);
  int sep = p.indexOf('|');
  if (sep > 0) {
    wifiSSID = b64decode(p.substring(0, sep));
    wifiPASS = b64decode(p.substring(sep + 1));
    Serial.println(F("STATUS:WIFI_SAVED"));
    salvaCredenziali();
    connetti();
  }
}

void gestisciSetWifiSep(const String &cmd) {
  String p = cmd.substring(12);
  int sep = p.indexOf("|||");
  if (sep >= 0) {
    wifiSSID = p.substring(0, sep);
    wifiPASS = p.substring(sep + 3);
    Serial.println(F("STATUS:WIFI_SAVED"));
    salvaCredenziali();
    connetti();
  }
}

void gestisciSetWifiLegacy(const String &cmd) {
  String p = cmd.substring(8);
  int sep = p.indexOf(',');
  if (sep > 0) {
    wifiSSID = p.substring(0, sep);
    wifiPASS = p.substring(sep + 1);
    Serial.println(F("STATUS:WIFI_SAVED"));
    salvaCredenziali();
    connetti();
  }
}

void handleSetWifi() {
  addCORSHeaders();
  if (server.hasArg("ssid") && server.hasArg("pass")) {
    wifiSSID = server.arg("ssid");
    wifiPASS = server.arg("pass");
    salvaCredenziali();
    server.send(200, "text/plain", F("Riconnessione..."));
    delay(500);
    connetti();
  } else {
    server.send(400, "text/plain", F("ssid+pass richiesti"));
  }
}

// =================================================================
//  ACCESS POINT / CONNESSIONE
// =================================================================
void avviaAP() {
  modalitaAP = true;
  wifiConnesso = false;
  WiFi.softAPdisconnect(true);
  WiFi.mode(WIFI_AP);

  // Se AP_PASSWORD è vuoto, crea una rete APERTA
  if (String(AP_PASSWORD).length() == 0) {
    WiFi.softAP(AP_SSID);
    LOG_I(F("Access Point avviato (RETE APERTA)"));
  } else {
    WiFi.softAP(AP_SSID, AP_PASSWORD);
    LOG_I(String(F("Access Point protetto avviato. PWD: ")) + AP_PASSWORD);
  }

  delay(100); // Piccolo ritardo per stabilizzare l'AP
  dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
  dnsServer.start(53, "*", WiFi.softAPIP());

  Serial.print(F("STATUS:AP_MODE (SSID: "));
  Serial.print(AP_SSID);
  Serial.println(F(")"));
  Serial.println("AP_IP:" + WiFi.softAPIP().toString());
}

bool connetti() {
  if (wifiSSID.length() == 0)
    return false;

  modalitaAP = (WiFi.getMode() & WIFI_AP); // Mantieni AP se già attivo
  if (modalitaAP)
    WiFi.mode(WIFI_AP_STA);
  else
    WiFi.mode(WIFI_STA);

  WiFi.begin(wifiSSID.c_str(), wifiPASS.c_str());
  LOG_I(String(F("Connessione a: ")) + wifiSSID);

  int t = 0;
  while (WiFi.status() != WL_CONNECTED && t < WIFI_CONNECT_TIMEOUT) {
    delay(500);
    t++;
    ESP.wdtFeed(); // non far scattare il watchdog
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnesso = true;
    dnsServer.stop();
    WiFi.mode(WIFI_STA); // Ora che siamo connessi, possiamo spegnere l'AP
    LOG_I(String(F("WiFi connesso — IP: ")) + WiFi.localIP().toString());
    return true;
  }

  wifiConnesso = false;
  LOG_W(F("Connessione WiFi fallita"));
  return false;
}

void avviaMDNS() {
  if (MDNS.begin(MDNS_NAME)) {
    MDNS.addService("http", "tcp", 80);
    LOG_I(String(F("mDNS: ")) + MDNS_NAME + ".local");
  } else {
    LOG_E(F("mDNS fallito"));
  }
}

// =================================================================
//  EEPROM
// =================================================================
void scriviStringaEEPROM(int offset, String str, int maxLen) {
  for (int i = 0; i < maxLen; i++) {
    if (i < (int)str.length())
      EEPROM.write(offset + i, str[i]);
    else
      EEPROM.write(offset + i, 0);
  }
}

String leggiStringaEEPROM(int offset, int maxLen) {
  String res = "";
  for (int i = 0; i < maxLen; i++) {
    char c = (char)EEPROM.read(offset + i);
    if (!c)
      break;
    res += c;
  }
  return res;
}

void salvaConfig() {
  scriviStringaEEPROM(EEPROM_SSID, wifiSSID, 32);
  scriviStringaEEPROM(EEPROM_PASS, wifiPASS, 63);
  scriviStringaEEPROM(EEPROM_NAME, deviceName, 32);
  scriviStringaEEPROM(EEPROM_METEO_KEY, meteoApiKey, 33);
  scriviStringaEEPROM(EEPROM_NEWS_KEY, newsApiKey, 33);
  scriviStringaEEPROM(EEPROM_CITY, city, 32);
  scriviStringaEEPROM(EEPROM_SH_URL, smartHomeUrl, 64);
  scriviStringaEEPROM(EEPROM_SH_KEY, smartHomeKey, 32);
  scriviStringaEEPROM(EEPROM_SPOTIFY_REFRESH, spotifyRefreshToken, 64);
  scriviStringaEEPROM(EEPROM_SPOTIFY_CREDS, spotifyCredentials, 96);
  EEPROM.write(EEPROM_BUZZER_ALARMS, buzzerAlarmsEnabled ? 1 : 0);
  EEPROM.commit();
  LOG_I(F("Configurazione salvata in EEPROM"));
}

void salvaCredenziali() { salvaConfig(); } // Legacy alias

void caricaConfig() {
  wifiSSID = leggiStringaEEPROM(EEPROM_SSID, 32);
  wifiPASS = leggiStringaEEPROM(EEPROM_PASS, 63);

  String n = leggiStringaEEPROM(EEPROM_NAME, 32);
  if (n.length() > 0)
    deviceName = n;

  String mk = leggiStringaEEPROM(EEPROM_METEO_KEY, 33);
  if (mk.length() > 0)
    meteoApiKey = mk;

  String nk = leggiStringaEEPROM(EEPROM_NEWS_KEY, 33);
  if (nk.length() > 0)
    newsApiKey = nk;

  String c = leggiStringaEEPROM(EEPROM_CITY, 32);
  if (c.length() > 0)
    city = c;

  smartHomeUrl = leggiStringaEEPROM(EEPROM_SH_URL, 64);
  smartHomeKey = leggiStringaEEPROM(EEPROM_SH_KEY, 32);
  spotifyRefreshToken = leggiStringaEEPROM(EEPROM_SPOTIFY_REFRESH, 64);
  spotifyCredentials = leggiStringaEEPROM(EEPROM_SPOTIFY_CREDS, 96);
  buzzerAlarmsEnabled = (EEPROM.read(EEPROM_BUZZER_ALARMS) == 1);

  LOG_I("Config caricata. Nome: " + deviceName);
}

void caricaCredenziali() { caricaConfig(); } // Legacy alias

// =================================================================
//  UDP DISCOVERY
// =================================================================
String getBiglietto() {
  StaticJsonDocument<256> doc;
  doc[F("device_type")] = DEVICE_TYPE;
  doc[F("device_name")] = deviceName;
  doc[F("firmware_version")] = FIRMWARE_VERSION;
  doc[F("mac")] = WiFi.macAddress();
  doc[F("ip")] = wifiConnesso ? WiFi.localIP().toString() : AP_IP_STR;
  doc[F("wifi_status")] =
      wifiConnesso ? "connesso" : (modalitaAP ? "access_point" : "disconnesso");
  doc[F("mdns")] = String(MDNS_NAME) + ".local";
  doc[F("uptime_s")] = millis() / 1000;
  doc[F("mega_online")] = megaOnline;

  String out;
  serializeJson(doc, out);
  return out;
}

void inviaBigliettoSerial() { Serial.println("CARD:" + getBiglietto()); }

void inviaUDPBroadcast() {
  if (!wifiConnesso)
    return;
  IPAddress ip = WiFi.localIP(), mask = WiFi.subnetMask(), bcast;
  for (int i = 0; i < 4; i++)
    bcast[i] = ip[i] | (~mask[i] & 0xFF);
  String p = getBiglietto();
  udp.beginPacket(bcast, UDP_BROADCAST_PORT);
  udp.print(p);
  udp.endPacket();
}

void leggiUDP() {
  int sz = udp.parsePacket();
  if (sz == 0)
    return;
  char buf[32];
  int len = udp.read(buf, sizeof(buf) - 1);
  if (len <= 0)
    return;
  buf[len] = '\0';
  String msg = String(buf);
  msg.trim();
  if (msg == DISCOVER_MAGIC) {
    String r = getBiglietto();
    udp.beginPacket(udp.remoteIP(), udp.remotePort());
    udp.print(r);
    udp.endPacket();
    LOG_V(F("Discovery response inviata"));
  }
}

// =================================================================
//  ROUTE PAGINA ROOT
// =================================================================
void handleRoot() {
  server.sendHeader("Cache-Control", "no-cache");
  if (modalitaAP) {
    server.sendHeader("Location", "/setup");
    server.send(302, "text/plain", "");
  } else {
    String html =
        F("<!DOCTYPE html><html lang='it'><head><meta charset='utf-8'><meta "
          "name='viewport' content='width=device-width,initial-scale=1'>");
    html += F("<title>PLANT - Hub Locale</title><style>");
    html +=
        F("body{font-family:'Inter',system-ui,sans-serif;background:#0d0d0d;"
          "color:#f5f5f7;max-width:600px;margin:2rem auto;padding:1rem} ");
    html += F(".card{background:rgba(28,28,30,0.8);border:1px solid "
              "rgba(56,56,58,0.5);border-radius:24px;padding:2rem;backdrop-"
              "filter:blur(20px);box-shadow:0 8px 32px rgba(0,0,0,0.4)} ");
    html += F("h1{color:#8fbf93;margin-top:0;font-size:24px;font-weight:600;"
              "text-align:center;letter-spacing:-0.02em} ");
    html += F(".sub{color:#a1a1a6;font-size:14px;text-align:center;margin-"
              "bottom:1.5rem} ");
    html += F(".stat{display:flex;justify-content:space-between;padding:14px "
              "0;border-bottom:1px solid #2c2c2e;font-size:15px} ");
    html += F(".val{font-weight:600;color:#f5f5f7} ");
    html += F("a{color:#8fbf93;text-decoration:none;transition:color 0.3s} ");
    html += F("a:hover{color:#a7c4aa} ");
    html += F(".footer-link{display:block;text-align:center;margin-top:2rem;"
              "font-size:14px} ");
    html += F("</style></head><body>");
    html += F("<div class='card'><h1>PLANT</h1><div class='sub'>Dashboard "
              "Locale Dispositivo</div>");

    html += F("<div class='stat'><span>IP di rete:</span><span class='val'>") +
            WiFi.localIP().toString() + F("</span></div>");
    html += F("<div class='stat'><span>Temperatura:</span><span class='val'>") +
            String(temp, 1) + F(" &deg;C</span></div>");
    html +=
        F("<div class='stat'><span>Umidit&agrave;:</span><span class='val'>") +
        String(hum, 1) + F(" %</span></div>");
    html += F("<div class='stat'><span>pH:</span><span class='val'>") +
            String(phValue, 2) + F("</span></div>");
    html += F("<div class='stat'><span>Pompa Acqua:</span><span class='val'>") +
            String(pumpOn ? "In funzione \xE2\x8F\xB3" : "Spenta") +
            F("</span></div>");
    html += F("<div class='stat'><span>Buzzer:</span><span class='val'>") +
            String(buzzerOn ? "Suonando" : "Silenzioso") + F("</span></div>");
    html += F("<div class='stat' style='border:none'><span>Arduino "
              "Mega:</span><span class='val'>") +
            String(megaOnline ? "Connesso" : "Offline / Non Rilevato") +
            F("</span></div>");

    html += F("<a class='footer-link' href='/api/data'>&rarr; API JSON Dati "
              "Grezzi</a>");
    html += F("</div></body></html>");

    server.send(200, "text/html; charset=utf-8", html);
  }
}

void handleInfo() {
  addCORSHeaders();
  server.send(200, "application/json", getBiglietto());
}

// =================================================================
//  ROUTE PAGINA SETUP AP
// =================================================================
void handleSetupPage() {
  server.send(200, "text/html; charset=utf-8", R"====(
<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Configura WiFi — PLANT</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,sans-serif;background:#0d0d0d;color:#f5f5f7;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}
.card{background:rgba(28,28,30,0.8);border:1px solid rgba(56,56,58,0.5);border-radius:24px;padding:32px 24px;width:100%;max-width:380px;backdrop-filter:blur(20px);box-shadow:0 8px 32px rgba(0,0,0,0.4)}
h1{font-size:24px;font-weight:600;color:#8fbf93;text-align:center;margin-bottom:8px;letter-spacing:-0.02em}
.sub{font-size:14px;color:#a1a1a6;text-align:center;margin-bottom:28px}
.ver{font-size:11px;color:#555;text-align:center;margin-top:20px}
label{font-size:12px;font-weight:600;color:#f5f5f7;display:block;margin-bottom:8px;margin-top:16px}
input{width:100%;padding:14px 16px;background:#2c2c2e;border:1px solid #38383a;border-radius:12px;color:#f5f5f7;font-size:15px;transition:border-color .3s}
input:focus{outline:none;border-color:#8fbf93}
.btn{width:100%;padding:14px;background:#f5f5f7;color:#0d0d0d;border:none;border-radius:30px;font-size:16px;font-weight:600;cursor:pointer;margin-top:28px;transition:opacity .3s, transform .3s}
.btn:hover{opacity:0.9;transform:translateY(-2px)}
.btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}
.scan-btn{width:100%;padding:12px;background:transparent;color:#8fbf93;border:1px solid #8fbf93;border-radius:30px;font-size:14px;font-weight:500;cursor:pointer;margin-top:10px;transition:background .3s, color .3s}
.scan-btn:hover{background:#8fbf93;color:#0d0d0d}
.net-item{padding:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;margin-bottom:8px;cursor:pointer;font-size:14px;display:flex;justify-content:space-between;transition:border-color .3s}
.net-item:hover{border-color:#8fbf93}
#networks{margin-top:16px;max-height:180px;overflow-y:auto;padding-right:4px}
#networks::-webkit-scrollbar{width:6px}
#networks::-webkit-scrollbar-track{background:transparent}
#networks::-webkit-scrollbar-thumb{background:#555;border-radius:10px}
#msg{margin-top:16px;padding:12px;border-radius:12px;font-size:14px;display:none;text-align:center}
.ok{background:rgba(143,191,147,0.2);color:#8fbf93;border:1px solid rgba(143,191,147,0.3)}
.err{background:rgba(255,59,48,0.2);color:#ff3b30;border:1px solid rgba(255,59,48,0.3)}
</style></head><body>
<div class="card">
<h1>PLANT Setup</h1>
<div class="sub">Connetti il dispositivo alla tua rete</div>
<button class="scan-btn" onclick="scan()">Cerca Reti WiFi</button>
<div id="networks"></div>
<label>Nome rete (SSID)</label>
<input type="text" id="ssid" placeholder="Nome rete">
<label>Password</label>
<input type="password" id="pass" placeholder="Password">
<button class="btn" id="btnSave" onclick="salva()">Connetti a PLANT</button>
<div id="msg"></div>
<div class="ver">PLANT v3.0.0</div>
</div>
<script>
function scan(){
  document.getElementById('networks').innerHTML='<div style="color:#a1a1a6;font-size:13px;text-align:center;padding:12px">Scansione in corso...</div>';
  fetch('/api/scan').then(r=>r.json()).then(reti=>{
    if(!reti.length){document.getElementById('networks').innerHTML='<div style="color:#a1a1a6;font-size:13px;text-align:center;padding:12px">Nessuna rete trovata</div>';return;}
    document.getElementById('networks').innerHTML=reti.map(r=>
      `<div class="net-item" onclick="document.getElementById('ssid').value='${r.ssid}'">
        <span>${r.ssid}</span><span style="color:#a1a1a6;font-size:12px">${r.rssi}dBm${r.enc?' 🔒':''}</span></div>`
    ).join('');
  }).catch(()=>{
    document.getElementById('networks').innerHTML='<div style="color:#ff3b30;font-size:13px;text-align:center;padding:12px">Errore durante la scansione</div>';
  });
}
function salva(){
  const s=document.getElementById('ssid').value.trim(),p=document.getElementById('pass').value;
  if(!s){msg('Inserisci il nome della rete','err');return;}
  document.getElementById('btnSave').disabled=true;
  document.getElementById('btnSave').textContent='Connessione in corso...';
  fetch('/dosetup?ssid='+encodeURIComponent(s)+'&pass='+encodeURIComponent(p))
    .then(r=>r.json())
    .then(d=>msg(d.ok?'Configurazione completata! Riconnettiti alla tua rete WiFi.':'Errore: '+d.msg,d.ok?'ok':'err'))
    .catch(()=>msg('Connessione inviata — Riconnettiti alla tua rete WiFi.','ok'))
    .finally(()=>{document.getElementById('btnSave').disabled=false;document.getElementById('btnSave').textContent='Connetti a PLANT';});
}
function msg(t,cls){const m=document.getElementById('msg');m.textContent=t;m.className=cls;m.style.display='block';}
window.onload=()=>setTimeout(scan,500);
</script></body></html>
)====");
}

void handleCaptivePortal() {
  server.sendHeader("Location", String("http://") + AP_IP_STR + "/setup", true);
  server.send(302, "text/plain", "");
}

void handleDoSetup() {
  addCORSHeaders();
  if (!server.hasArg("ssid")) {
    server.send(400, "application/json",
                F("{\"ok\":false,\"msg\":\"ssid mancante\"}"));
    return;
  }

  String tentaSSID = server.arg("ssid");
  String tentaPASS = server.hasArg("pass") ? server.arg("pass") : "";

  LOG_I(String(F("Tentativo setup WiFi: ")) + tentaSSID);

  // Backup temporaneo per tentare la connessione
  String vecchioSSID = wifiSSID;
  String vecchioPASS = wifiPASS;
  wifiSSID = tentaSSID;
  wifiPASS = tentaPASS;

  if (connetti()) {
    // SUCCESSO: Salva in EEPROM e rispondi
    salvaCredenziali();
    server.send(200, "application/json",
                F("{\"ok\":true,\"msg\":\"Connesso! Riconnettiti alla tua rete "
                  "WiFi.\"}"));

    avviaMDNS();
    setupOTA();
    inviaUDPBroadcast();
    lastBcastMs = millis();
    inviaAlMega(
        String(F("{\"type\":\"STATUS\",\"msg\":\"CONNECTED\",\"ip\":\"")) +
        WiFi.localIP().toString() + String(F("\",\"ssid\":\"")) + wifiSSID +
        String(F("\"}")));
    modalitaAP = false;
  } else {
    // FALLIMENTO: Ripristina vecchie credenziali e segnala errore
    wifiSSID = vecchioSSID;
    wifiPASS = vecchioPASS;
    server.send(200, "application/json",
                F("{\"ok\":false,\"msg\":\"Connessione fallita. Controlla la "
                  "password.\"}"));
    LOG_W(F("Connessione fallita, resto in modalità AP"));
    avviaAP();
  }
}

void handleScan() {
  addCORSHeaders();

  // Scansione asincrona o gestione errori
  int n = WiFi.scanNetworks(
      false, false); // false = sincrona per semplicità qui, ma gestiamo errori

  if (n == WIFI_SCAN_FAILED) {
    LOG_E(F("Scansione WiFi fallita!"));
    server.send(500, "application/json",
                F("{\"ok\":false,\"msg\":\"Scansione fallita\"}"));
    return;
  }

  StaticJsonDocument<1536> doc; // Un po' più grande per sicurezza
  JsonArray arr = doc.to<JsonArray>();

  for (int i = 0; i < n && i < 20; i++) {
    JsonObject net = arr.createNestedObject();
    net[F("ssid")] = WiFi.SSID(i);
    net[F("rssi")] = WiFi.RSSI(i);
    net[F("enc")] = (WiFi.encryptionType(i) != ENC_TYPE_NONE);
  }

  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);

  // Pulisci i risultati della scansione dalla memoria
  WiFi.scanDelete();
}

void handleReboot() {
  addCORSHeaders();
  server.send(200, "application/json",
              F("{\"ok\":true,\"msg\":\"Riavvio...\"}"));
  delay(300);
  ESP.restart();
}

// =================================================================
//  API — METEO (OpenWeatherMap)
// =================================================================
void updateMeteo() {
  if (!wifiConnesso)
    return;
  LOG_I(F("Aggiornamento meteo..."));

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String url = "https://api.openweathermap.org/data/2.5/weather?q=" + city +
               "&units=metric&appid=" + meteoApiKey;

  if (http.begin(client, url)) {
    int httpCode = http.GET();
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      StaticJsonDocument<1024> doc;
      DeserializationError error = deserializeJson(doc, payload);

      if (!error) {
        weatherTemp = doc["main"]["temp"] | 0.0f;
        geoCity = doc["name"] | city;
        weatherDesc = doc["weather"][0]["description"] | "";
        LOG_I("Meteo aggiornato: " + String(weatherTemp) + "C a " + geoCity);
      }
    } else {
      LOG_E("Errore HTTP Meteo: " + String(httpCode));
    }
    http.end();
  }
}

// =================================================================
//  API — NEWS (NewsAPI)
// =================================================================
void updateNews() {
  if (!wifiConnesso)
    return;
  LOG_I(F("Aggiornamento news..."));

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  // Top headlines in Italia
  String url =
      "https://newsapi.org/v2/top-headlines?country=it&pageSize=1&apiKey=" +
      newsApiKey;

  if (http.begin(client, url)) {
    int httpCode = http.GET();
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      StaticJsonDocument<2048> doc; // News può essere grande
      DeserializationError error = deserializeJson(doc, payload);

      if (!error && doc["totalResults"] > 0) {
        lastNews = doc["articles"][0]["title"] | "";
        LOG_I("News: " + lastNews);
        // Inoltra notizia al Mega come log informativo
        inviaAlMega("{\"type\":\"STATUS\",\"msg\":\"NEWS: " +
                    lastNews.substring(0, 50) + "...\"}");
      }
    } else {
      LOG_E("Errore HTTP News: " + String(httpCode));
    }
    http.end();
  }
}

// =================================================================
//  API — SPOTIFY (Controllo e Refresh)
// =================================================================
bool refreshSpotifyToken() {
  if (!wifiConnesso || spotifyRefreshToken.length() == 0 ||
      spotifyCredentials.length() == 0)
    return false;
  LOG_I(F("Spotify: Refreshing token..."));

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  if (http.begin(client, "https://accounts.spotify.com/api/token")) {
    http.addHeader("Authorization", "Basic " + spotifyCredentials);
    http.addHeader("Content-Type", "application/x-www-form-urlencoded");

    String body =
        "grant_type=refresh_token&refresh_token=" + spotifyRefreshToken;
    int httpCode = http.POST(body);

    if (httpCode == 200) {
      String payload = http.getString();
      StaticJsonDocument<1024> doc;
      deserializeJson(doc, payload);
      spotifyToken = doc["access_token"] | "";
      LOG_I(F("Spotify: Token rinnovato con successo"));
      http.end();
      return true;
    } else {
      LOG_E("Spotify Refresh FAIL: " + String(httpCode));
      http.end();
      return false;
    }
  }
  return false;
}

void spotifyAction(String action) {
  if (!wifiConnesso)
    return;
  if (spotifyToken.length() == 0) {
    if (!refreshSpotifyToken())
      return;
  }

  LOG_I("Spotify Action: " + action);

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String url = "https://api.spotify.com/v1/me/player/" + action;
  String method = "POST";
  if (action == "play" || action == "pause")
    method = "PUT";

  if (http.begin(client, url)) {
    http.addHeader("Authorization", "Bearer " + spotifyToken);
    int httpCode = http.sendRequest(method.c_str());

    // Se il token è scaduto (401), riprova dopo un refresh
    if (httpCode == 401) {
      LOG_W(F("Spotify: Token scaduto, riprovo refresh..."));
      if (refreshSpotifyToken()) {
        http.end();
        if (http.begin(client, url)) {
          http.addHeader("Authorization", "Bearer " + spotifyToken);
          httpCode = http.sendRequest(method.c_str());
        }
      }
    }

    LOG_I("Spotify Response: " + String(httpCode));
    http.end();
  }
}

// =================================================================
//  API — SMART HOME (Webhook)
// =================================================================
void smartHomeAction(String action) {
  if (!wifiConnesso || smartHomeUrl.length() == 0)
    return;
  LOG_I("SmartHome Action: " + action);

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  if (http.begin(client, smartHomeUrl)) {
    http.addHeader("Content-Type", "application/json");
    if (smartHomeKey.length() > 0)
      http.addHeader("Authorization", "Bearer " + smartHomeKey);

    int httpCode = http.POST("{\"action\":\"" + action + "\"}");
    LOG_I("SmartHome Response: " + String(httpCode));
    http.end();
  }
}
