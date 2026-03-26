// ================================================================
//  Arduino Mega 2560 — Sistema PLANT v3.0.0
//  Sensori: DHT11 (temp+umidità), pH analogico, pulsante
//  Attuatori: pompa PWM, buzzer passivo, monitor TFT
//  Comunicazione: Serial1 (pin 18/19) <-> NodeMCU
//  Protocollo: JSON su Serial1  |  Comandi testo su Serial0
// ================================================================
//  LIBRERIE NECESSARIE (Library Manager):
//    DHT sensor library  by Adafruit
//    ArduinoJson         by Benoit Blanchon  (versione 6.x)
// ================================================================
//  PIN MAP:
//    Pin  2  -> DHT11 Signal
//    Pin 10  -> Monitor TFT on/off
//    Pin 18  -> TX1 -> NodeMCU RX  (via partitore 1kΩ+2kΩ)
//    Pin 19  -> RX1 <- NodeMCU TX  (diretto)
//    Pin A2  -> Sensore pH OUT  (modulo pH-4502C VCC->5V GND->GND)
// ================================================================

#include <DHT.h>
#include <ArduinoJson.h>
#include <Adafruit_GFX.h>
#include <ILI9488.h>
#include <SPI.h>
#ifdef __AVR__
  #include <avr/wdt.h>
#endif

// ── Pin ──────────────────────────────────────────────────────────
#define DHT_PIN         2
#define DHT_TYPE        DHT11
#define BTN_PIN         7
#define BUZZER_PIN      8
// #define PUMP_PIN     9   // DISATTIVATO - Pin usato da TFT_RST
// #define MONITOR_PIN  10  // DISATTIVATO - Pin usato da TFT_DC

// ── Pin Display TFT (ILI9341) ────────────────────────────────────
#define TFT_CS          53
#define TFT_DC          10
#define TFT_RST         9
// Nota: SDI(MOSI) su 51, SCK su 52 (Hardware SPI Mega)

#define PH_PIN          A2

// ── Soglie Allarmi (Dinamiche) ───────────────────────────────────
float threshTempHigh = 30.0f; bool enTempHigh = false;
float threshTempLow  = 15.0f; bool enTempLow  = false;
float threshHumHigh  = 80.0f; bool enHumHigh  = false;
float threshHumLow   = 30.0f; bool enHumLow   = false;
float threshPhHigh   =  8.0f; bool enPhHigh   = false;
float threshPhLow    =  6.0f; bool enPhLow    = false;

// ── Calibrazione pH ──────────────────────────────────────────────
#define PH_OFFSET        0.0f
#define PH_SAMPLES       10

// ── Intervalli (ms) ──────────────────────────────────────────────
#define INTERVAL_SENSOR   2000UL
#define INTERVAL_SEND     1000UL
#define INTERVAL_HEARTBEAT 5000UL

// ── Buffer / protezione ─────────────────────────────────────────
#define SERIAL1_BUF_MAX   512       // Aumentato per gestire JSON più lunghi
#define SERIAL0_BUF_MAX   128
#define SERIAL_MSG_TIMEOUT 2000UL   // Ridotto leggermente per reattività
#define DHT_MAX_ERRORS     5        // after N consecutive errors, mark sensor as offline

// ── Debug ────────────────────────────────────────────────────────
//  0=OFF  1=ERROR  2=WARN  3=INFO  4=VERBOSE
#define DBG_NONE    0
#define DBG_ERROR   1
#define DBG_WARN    2
#define DBG_INFO    3
#define DBG_VERBOSE 4

uint8_t debugLevel = DBG_WARN; // Default silenzioso per i test (livello 2)

#define DBG(lvl, msg) do { \
  if (debugLevel >= (lvl)) { \
    Serial.print(F("[" #lvl "] ")); \
    Serial.println(msg); \
  } \
} while(0)

// Macro con livello esplicito per leggibilità
#define LOG_E(msg) DBG(1, msg)
#define LOG_W(msg) DBG(2, msg)
#define LOG_I(msg) DBG(3, msg)
#define LOG_V(msg) DBG(4, msg)

// ── Oggetti ──────────────────────────────────────────────────────
DHT dht(DHT_PIN, DHT_TYPE);
ILI9488 tft(TFT_CS, TFT_DC, TFT_RST);

// Definizioni Colori Standard (per compatibilità librerie diverse)
#define COLOR_BLACK       0x0000
#define COLOR_NAVY        0x000F
#define COLOR_DARKGREEN   0x03E0
#define COLOR_DARKCYAN    0x03EF
#define COLOR_MAROON      0x7800
#define COLOR_PURPLE      0x780F
#define COLOR_OLIVE       0x7BE0
#define COLOR_LIGHTGREY   0xC618
#define COLOR_DARKGREY    0x7BEF
#define COLOR_BLUE        0x001F
#define COLOR_GREEN       0x07E0
#define COLOR_CYAN        0x07FF
#define COLOR_RED         0xF800
#define COLOR_MAGENTA     0xF81F
#define COLOR_YELLOW      0xFFE0
#define COLOR_WHITE       0xFFFF
#define COLOR_ORANGE      0xFD20
#define COLOR_GREENYELLOW 0xAFE5
#define COLOR_PINK        0xF81F
float  temperature    = 0.0f;
float  humidity       = 0.0f;
float  phValue        = 7.0f;
bool   tempAlertHigh  = false;
bool   tempAlertLow   = false;
bool   humAlertHigh   = false;
bool   humAlertLow    = false;
bool   phAlertLow     = false;
bool   phAlertHigh    = false;
bool   dhtOnline      = true;
uint8_t dhtErrorCount = 0;
bool    mcuSynched     = false; // Stato sincronizzazione con NodeMCU
unsigned long lastSyncMs = 0;

// ── Stato attuatori ──────────────────────────────────────────────
bool   buzzerOn       = false;
int    buzzerFreq     = 0;
unsigned long buzzerEndMs = 0;
bool   pumpOn         = false;
int    pumpSpeed      = 0;
bool   monitorOn      = true; // Monitor virtuale (display) sempre ON
bool   btnPressed     = false;
bool   btnPrevState   = false;
unsigned long pumpLastOn = 0;
unsigned long pumpEndMs  = 0;
bool   mcuPowerOn     = true; // Stato logico di connessione (non più fisico)

// ── Rete WiFi ────────────────────────────────────────────────────
String wifiIP         = "0.0.0.0";
String wifiSSID       = "---";

// ── Impostazioni ──────────────────────────────────────────────────
bool   buzzerAlarmsEnabled = false;

// ── Data/ora ─────────────────────────────────────────────────────
int    dtYear    = 2025;
int    dtMonth   = 1;
int    dtDay     = 1;
int    dtHour    = 0;
int    dtMinute  = 0;
int    dtSecond  = 0;
String dtWeekday = "---";
float  geoLat    = 0.0f;
float  geoLon    = 0.0f;
String geoCity   = "";

// ── Timer ────────────────────────────────────────────────────────
unsigned long lastSensorMs     = 0;
unsigned long lastSendMs       = 0;
unsigned long lastDisplayMs    = 0;
unsigned long lastSecMs        = 0;
unsigned long lastHeartbeatMs  = 0;
uint8_t dataCycle              = 0;

// ── Buffer seriali ───────────────────────────────────────────────
String serial1Buf = "";
String serial0Buf = "";
unsigned long serial1LastCharMs = 0;
unsigned long serial0LastCharMs = 0;

// ── Contatori errori (diagnostica) ──────────────────────────────
uint16_t errJsonParse   = 0;
uint16_t errDhtRead     = 0;
uint16_t errBufferOver  = 0;

// =================================================================
//  SETUP
// =================================================================
void setup() {
  // Disabilita watchdog durante l'init
#ifdef __AVR__
  wdt_disable();
#endif

  Serial.begin(115200);
  Serial1.begin(115200);

  dht.begin();

  // Pin modes
  pinMode(BUZZER_PIN,    OUTPUT);
  // pinMode(PUMP_PIN,   OUTPUT); // DISATTIVATO
  // pinMode(MONITOR_PIN, OUTPUT); // DISATTIVATO
  pinMode(BTN_PIN,       INPUT_PULLUP);

  // ── Inizializzazione Hardware Display ──
  pinMode(TFT_CS,  OUTPUT);
  pinMode(TFT_DC,  OUTPUT);
  pinMode(TFT_RST, OUTPUT);
  pinMode(53,      OUTPUT); // Pin SS hardware (Obbligatorio OUTPUT per SPI Master su Mega)
  
  // Reset hardware manuale
  digitalWrite(TFT_RST, HIGH); delay(10);
  digitalWrite(TFT_RST, LOW);  delay(20);
  digitalWrite(TFT_RST, HIGH); delay(150);

  digitalWrite(TFT_CS, HIGH); // Inizia con CS disattivato
  
  SPI.begin();
  delay(100);

  // Stato iniziale sicuro
  digitalWrite(BUZZER_PIN,    LOW);
  // analogWrite(PUMP_PIN,    0);   // DISATTIVATO
  // digitalWrite(MONITOR_PIN, LOW); // DISATTIVATO

  // ── Inizializzazione Logica Display TFT ──
  tft.begin();
  SPI.setClockDivider(SPI_CLOCK_DIV8); // Rallenta SPI (~2MHz) per stabilità su breadboard
  delay(200);
  tft.setRotation(1); // Orizzontale (480x320)
  tft.fillScreen(COLOR_BLACK);
  delay(100);
  disegnaInterfacciaStatica();

  // Riserva spazio buffer per evitare riallocazioni
  serial1Buf.reserve(SERIAL1_BUF_MAX);
  serial0Buf.reserve(SERIAL0_BUF_MAX);

  // Banner di avvio
  Serial.println();
  Serial.println(F("╔═══════════════════════════════════════╗"));
  Serial.println(F("║  PLANT v3.0.0 — Arduino Mega 2560     ║"));
  Serial.println(F("╠═══════════════════════════════════════╣"));
  Serial.println(F("║  DHT11:   pin 2   │ pH:     pin A2    ║"));
  Serial.println(F("║  Buzzer:  pin 8   │ TFT CS: pin 53    ║"));
  Serial.println(F("║  Btn:     pin 7   │ TFT DC: pin 10    ║"));
  Serial.println(F("║  TFT RST: pin 9   │ Serial1: 115200   ║"));
  Serial.println(F("╠═══════════════════════════════════════╣"));
  Serial.println(F("║  Comandi: status | pump on/off        ║"));
  Serial.println(F("║           buzzer <freq> <ms>          ║"));
  Serial.println(F("║           debug <0-4> | help          ║"));
  Serial.println(F("╚═══════════════════════════════════════╝"));

  beepAvvio();

  // Notifica NodeMCU
  Serial1.println(F("{\"type\":\"STATUS\",\"msg\":\"BOOT\"}"));
  LOG_I(F("Setup completato"));

  // Abilita watchdog (8 secondi)
#ifdef __AVR__
  wdt_enable(WDTO_8S);
#endif
}

// =================================================================
//  LOOP
// =================================================================
void loop() {
#ifdef __AVR__
  wdt_reset();  // resetta watchdog ad ogni ciclo
#endif

  unsigned long now = millis();

  // Pulsante (ogni ciclo, è veloce)
  leggiPulsante();

  // Auto-stop buzzer dopo durata
  if (buzzerEndMs > 0 && now >= buzzerEndMs) {
    noTone(BUZZER_PIN);
    buzzerOn    = false;
    buzzerFreq  = 0;
    buzzerEndMs = 0;
    LOG_V(F("Buzzer auto-stop"));
  }

  // Auto-stop pompa dopo durata
  if (pumpEndMs > 0 && now >= pumpEndMs) {
    pumpOn    = false;
    pumpEndMs = 0;
    applicaPompa();
    aggiornaDisplay();
    LOG_I(F("Pompa auto-stop"));
  }

  // Lettura sensori periodica
  if (now - lastSensorMs >= INTERVAL_SENSOR) {
    leggiSensori();
    lastSensorMs = now;
  }

  // Invio dati al NodeMCU
  if (now - lastSendMs >= INTERVAL_SEND) {
    inviaDati();
    lastSendMs = now;
  }

  // Heartbeat al NodeMCU
  if (now - lastHeartbeatMs >= INTERVAL_HEARTBEAT) {
    inviaHeartbeat();
    lastHeartbeatMs = now;
  }

  // Timeout Sincronizzazione MCU (se attivo, resettalo se non sentiamo nulla da 30s)
  if (mcuSynched && (now - lastSyncMs > 30000UL)) {
    mcuSynched = false;
    LOG_W(F("Connessione MCU persa (timeout). Richiesto nuovo SYNC."));
  }

  // Orologio interno (ogni secondo)
  if (now - lastSecMs >= 1000) {
    incrementaOra();
    lastSecMs = now;
  }

  // Lettura seriali
  leggiSerial1();   // da NodeMCU
  leggiSerial0();   // da terminale/monitor

  // Timeout buffer parziali
  controllaTimeoutBuffer(now);

  // (Display aggiornato in modo event-driven, nessun polling)
}

// =================================================================
//  TIMEOUT BUFFER PARZIALI
// =================================================================
void controllaTimeoutBuffer(unsigned long now) {
  if (serial1Buf.length() > 0 && (now - serial1LastCharMs > SERIAL_MSG_TIMEOUT)) {
    Serial.print(F("[ERR] Timeout buffer Serial1 (len:"));
    Serial.print(serial1Buf.length());
    Serial.print(F("). Contenuto: ["));
    Serial.print(serial1Buf.substring(0, 30)); 
    Serial.println(F("...]"));
    serial1Buf = "";
    errBufferOver++;
  }
  if (serial0Buf.length() > 0 && (now - serial0LastCharMs > SERIAL_MSG_TIMEOUT)) {
    serial0Buf = "";
  }
}

// =================================================================
//  HEARTBEAT
// =================================================================
void inviaHeartbeat() {
  StaticJsonDocument<128> doc;
  doc[F("type")]   = "HEARTBEAT";
  doc[F("uptime")] = millis() / 1000;
  doc[F("free_ram")] = freeRam();
  String out;
  serializeJson(doc, out);
  Serial1.println(out);
}

int freeRam() {
  extern int __heap_start, *__brkval;
  int v;
  return (int)&v - (__brkval == 0 ? (int)&__heap_start : (int)__brkval);
}

// =================================================================
//  LETTURA SENSORE pH
// =================================================================
float leggiPH() {
  // Versione ultra-rapida per non bloccare la seriale
  // La media viene fatta sui campioni letti istantaneamente
  long somma = 0;
  for (int i = 0; i < PH_SAMPLES; i++) {
    somma += analogRead(PH_PIN);
  }
  float media    = somma / (float)PH_SAMPLES;
  float tensione = media * (5.0f / 1023.0f);
  float ph = 7.0f + ((2.50f - tensione) / 0.18f) + PH_OFFSET;
  return constrain(ph, 0.0f, 14.0f);
}

// =================================================================
//  LETTURA SENSORI (DHT11 + pH)
// =================================================================
void leggiSensori() {
  // ── DHT11 ──
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  if (isnan(t) || isnan(h)) {
    dhtErrorCount++;
    errDhtRead++;
    if (dhtErrorCount >= DHT_MAX_ERRORS) {
      dhtOnline = false;
      LOG_E(F("DHT11 OFFLINE — troppe letture fallite"));
    } else {
      LOG_W(F("DHT11 lettura fallita"));
    }
  } else {
    dhtErrorCount = 0;
    dhtOnline     = true;
    temperature   = t;
    humidity      = h;
    tempAlertHigh = (enTempHigh && temperature >= threshTempHigh);
    tempAlertLow  = (enTempLow  && temperature <= threshTempLow);
    humAlertHigh  = (enHumHigh  && humidity    >= threshHumHigh);
    humAlertLow   = (enHumLow   && humidity    <= threshHumLow);
  }

  // ── pH ──
  phValue     = leggiPH();
  phAlertLow  = (enPhLow  && phValue < threshPhLow);
  phAlertHigh = (enPhHigh && phValue > threshPhHigh);

  // ── Log (Spostato a VERBOSE per non intasare il terminale) ──
  if (debugLevel >= DBG_VERBOSE) {
    Serial.print(F("[4] T:"));  Serial.print(temperature, 1);
    Serial.print(F("C  H:"));  Serial.print(humidity, 1);
    Serial.print(F("%  pH:")); Serial.print(phValue, 2);
    if (!dhtOnline)       Serial.print(F(" [DHT OFF]"));
    if (phAlertLow)       Serial.print(F(" [pH ACIDO]"));
    if (phAlertHigh)      Serial.print(F(" [pH BASICO]"));
    if (tempAlertHigh)    Serial.print(F(" [T ALTA]"));
    if (tempAlertLow)     Serial.print(F(" [T BASSA]"));
    if (humAlertHigh)     Serial.print(F(" [H ALTA]"));
    if (humAlertLow)      Serial.print(F(" [H BASSA]"));
    Serial.println();
  }

  // ── Allarmi buzzer ──
  if (tempAlertHigh) gestisciBuzzerAllarme('T'); // caldo
  if (tempAlertLow)  gestisciBuzzerAllarme('t'); // freddo
  if (humAlertHigh)  gestisciBuzzerAllarme('M'); // umido
  if (humAlertLow)   gestisciBuzzerAllarme('m'); // secco
  if (phAlertLow)    gestisciBuzzerAllarme('L'); // acido
  if (phAlertHigh)   gestisciBuzzerAllarme('H'); // basico
}

// =================================================================
//  GESTIONE BUZZER ALLARMI
// =================================================================
void gestisciBuzzerAllarme(char tipo) {
  if (!buzzerAlarmsEnabled) return; 
  if (buzzerOn) return; // Non sovrapporre allarmi

  switch (tipo) {
    case 'T': tone(BUZZER_PIN, 1200, 300); break; // caldo
    case 't': tone(BUZZER_PIN, 400, 300);  break; // freddo
    case 'M': tone(BUZZER_PIN, 800, 200);  break; // umido
    case 'm': tone(BUZZER_PIN, 600, 200);  break; // secco
    case 'L': tone(BUZZER_PIN, 1000, 500); break; // acido
    case 'H': tone(BUZZER_PIN, 2000, 500); break; // basico
  }
  buzzerOn = true;
  buzzerEndMs = millis() + 600; 
}

// ── Suoni di stato ──
void beepAvvio() {
  tone(BUZZER_PIN, 523, 100); delay(120);
  tone(BUZZER_PIN, 659, 100); delay(120);
  tone(BUZZER_PIN, 784, 150); delay(200);
  noTone(BUZZER_PIN);
}
void beepPompaOn()  { tone(BUZZER_PIN, 880, 100); }
void beepPompaOff() { tone(BUZZER_PIN, 440, 100); }
void beepBtn()      { tone(BUZZER_PIN, 660, 50);  }

// Suona una frequenza specifica per una durata (da WiFi)
void suonaFrequenza(int freq, int durataMs) {
  if (freq <= 0) {
    noTone(BUZZER_PIN);
    buzzerOn    = false;
    buzzerFreq  = 0;
    buzzerEndMs = 0;
    return;
  }
  freq     = constrain(freq, 31, 10000);
  durataMs = constrain(durataMs, 50, 30000);
  tone(BUZZER_PIN, freq);
  buzzerOn    = true;
  buzzerFreq  = freq;
  buzzerEndMs = millis() + (unsigned long)durataMs;
  LOG_I(String(F("Buzzer: ")) + freq + F("Hz per ") + durataMs + F("ms"));
}

// =================================================================
//  LETTURA PULSANTE (debounce)
// =================================================================
void leggiPulsante() {
  static unsigned long lastDebounce = 0;
  bool stato = !digitalRead(BTN_PIN);

  if (stato != btnPrevState) {
    if (millis() - lastDebounce > 50) {
      btnPressed   = stato;
      btnPrevState = stato;
      lastDebounce = millis();

      inviaEventoPulsante();
      beepBtn();

      if (stato) {
        pumpOn = !pumpOn;
        applicaPompa();
        aggiornaDisplay();
        LOG_I(pumpOn ? F("BTN -> Pompa ON") : F("BTN -> Pompa OFF"));
      }
    }
  }
}

// =================================================================
//  APPLICAZIONE STATO POMPA
// =================================================================
void applicaPompa() {
  if (pumpOn) {
    pumpLastOn = millis();
    // int pwm = map(max(pumpSpeed, 30), 0, 100, 0, 255);
    // analogWrite(PUMP_PIN, pwm); // DISATTIVATO
    beepPompaOn();
  } else {
    // analogWrite(PUMP_PIN, 0);   // DISATTIVATO
    beepPompaOff();
  }
}

// =================================================================
//  OROLOGIO INTERNO
// =================================================================
void incrementaOra() {
  dtSecond++;
  if (dtSecond >= 60) { dtSecond = 0; dtMinute++; }
  if (dtMinute >= 60) { dtMinute = 0; dtHour++;   }
  if (dtHour   >= 24) { dtHour   = 0; dtDay++;    }
  // Nota: non gestisce fine mese/anno — viene sincronizzato dal NodeMCU
}

// =================================================================
//  COSTRUISCE JSON DATI COMPLETO (diviso in cicli per alleggerire)
// =================================================================
String costruisciJSON() {
  StaticJsonDocument<1024> doc; // Aumentato a 1024 per sicurezza con campi geo/city

  doc[F("type")]     = "DATA";
  doc[F("uptime")]   = millis() / 1000;
  doc[F("free_ram")] = freeRam();

  if (dataCycle == 0) {
    JsonObject temp = doc.createNestedObject(F("temperature"));
    temp[F("value")]  = serialized(String(temperature, 1));
    temp[F("unit")]   = "C";
    temp[F("alert")]  = (tempAlertHigh || tempAlertLow);
    temp[F("status")] = tempAlertHigh ? "T_ALTA" : (tempAlertLow ? "T_BASSA" : "OK");
    temp[F("online")] = dhtOnline;

    JsonObject hum = doc.createNestedObject(F("humidity"));
    hum[F("value")]  = serialized(String(humidity, 1));
    hum[F("unit")]   = "%";
    hum[F("alert")]  = (humAlertHigh || humAlertLow);

    JsonObject ph = doc.createNestedObject(F("ph"));
    ph[F("value")]      = serialized(String(phValue, 2));
    ph[F("alert_low")]  = phAlertLow;
    ph[F("alert_high")] = phAlertHigh;
    ph[F("status")]     = phAlertLow  ? "ACIDO"  :
                           phAlertHigh ? "BASICO" : "OK";
    ph[F("min")]        = serialized(String(threshPhLow, 1));
    ph[F("max")]        = serialized(String(threshPhHigh, 1));
  } 
  else if (dataCycle == 1) {
    JsonObject buz = doc.createNestedObject(F("buzzer"));
    buz[F("on")]   = buzzerOn;
    buz[F("freq")] = buzzerFreq;

    JsonObject btn = doc.createNestedObject(F("button"));
    btn[F("pressed")] = btnPressed;

    JsonObject pump = doc.createNestedObject(F("pump"));
    pump[F("on")]      = pumpOn;
    pump[F("speed")]   = pumpSpeed;
    pump[F("last_on")] = pumpLastOn > 0
      ? String((millis() - pumpLastOn) / 1000) + "s fa"
      : "mai";
    
    JsonObject mon = doc.createNestedObject(F("monitor"));
    mon[F("on")] = monitorOn;
  } 
  else if (dataCycle == 2) {
    JsonObject setts = doc.createNestedObject(F("settings"));
    setts[F("buzzer_alarms")] = buzzerAlarmsEnabled;

    JsonObject dt = doc.createNestedObject(F("datetime"));
    dt[F("year")]    = dtYear;
    dt[F("month")]   = dtMonth;
    dt[F("day")]     = dtDay;
    dt[F("hour")]    = dtHour;
    dt[F("minute")]  = dtMinute;
    dt[F("second")]  = dtSecond;
    dt[F("weekday")] = dtWeekday;

    JsonObject geo = doc.createNestedObject(F("geo"));
    geo[F("lat")]  = serialized(String(geoLat, 6));
    geo[F("lon")]  = serialized(String(geoLon, 6));
    geo[F("city")] = geoCity;
  }

  String output;
  serializeJson(doc, output);
  return output;
}

// =================================================================
//  INVIA DATI AL NODEMCU
// =================================================================
void inviaDati() {
  if (!mcuSynched) return; // Invia dati solo se sincronizzato

  String json = costruisciJSON();
  Serial1.println(json); 
  
  if (debugLevel >= DBG_VERBOSE) {
    Serial.print(F("[MEGA->MCU] ")); Serial.println(json);
  }
  LOG_V(String(F("Dati inviati al NodeMCU (ciclo ")) + dataCycle + F(")"));
  dataCycle = (dataCycle + 1) % 3;
}

void inviaEventoPulsante() {
  StaticJsonDocument<128> doc;
  doc[F("type")]    = "EVENT";
  doc[F("event")]   = "BUTTON";
  doc[F("pressed")] = btnPressed;
  String out;
  serializeJson(doc, out);
  Serial1.println(out);
}

// =================================================================
//  LEGGI COMANDI DA NODEMCU (JSON su Serial1)
// =================================================================
void leggiSerial1() {
  while (Serial1.available()) {
    char c = (char)Serial1.read();
    serial1LastCharMs = millis();

    // Log super-dettagliato solo in VERBOSE per capire se arriva "qualcosa"
    if (debugLevel >= DBG_VERBOSE) {
      Serial.print(F(".")); // Stampa un punto per ogni byte ricevuto
    }

    if (c == '\n') {
      serial1Buf.trim();
      if (serial1Buf.length() > 0) {
        gestisciComandoJSON(serial1Buf);
      }
      serial1Buf = "";
    } else if (c != '\r') {
      if ((unsigned int)serial1Buf.length() < SERIAL1_BUF_MAX) {
        serial1Buf += c;
      } else {
        // Buffer overflow — scarta tutto e logga
        LOG_E(String(F("Serial1 OVERFLOW! Msg parziale: ")) + serial1Buf.substring(0, 32) + F("..."));
        serial1Buf = "";
        errBufferOver++;
      }
    }
  }
}

// =================================================================
//  LEGGI COMANDI DA TERMINALE (testo su Serial0)
// =================================================================
void leggiSerial0() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    serial0LastCharMs = millis();

    if (c == '\n') {
      serial0Buf.trim();
      if (serial0Buf.length() > 0) {
        gestisciComandoTerminale(serial0Buf);
      }
      serial0Buf = "";
    } else if (c != '\r') {
      if ((unsigned int)serial0Buf.length() < SERIAL0_BUF_MAX) {
        serial0Buf += c;
      } else {
        serial0Buf = "";
      }
    }
  }
}

// =================================================================
//  GESTIONE COMANDI DA TERMINALE (PLANT OS)
// =================================================================
void gestisciComandoTerminale(String cmdOriginal) {
  cmdOriginal.trim();
  String cmd = cmdOriginal;
  cmd.toLowerCase();

  // ── help ──
  if (cmd == "help" || cmd == "?") {
    Serial.println(F("╔══════════════════════════════════╗"));
    Serial.println(F("║  PLANT OS - Comandi:             ║"));
    Serial.println(F("╠══════════════════════════════════╣"));
    Serial.println(F("║  status      → stato sistema     ║"));
    Serial.println(F("║  log <on/off>→ livello log debug ║"));
    Serial.println(F("║  reboot [all]→ riavvia scheda/e  ║"));
    Serial.println(F("║  set <var>=<v>→ imposta variabil ║"));
    Serial.println(F("║  get <var>   → ottieni variabile ║"));
    Serial.println(F("║  wifi <test|set|info>            ║"));
    Serial.println(F("║  send <dati> → invia a NodeMCU   ║"));
    Serial.println(F("║  errors [clear]→ registro errori ║"));
    Serial.println(F("║  api <arg>   → info meteo/news.. ║"));
    Serial.println(F("║  update all  → aggiorna display  ║"));
    Serial.println(F("║  sync        → sincronizza schede║"));
    Serial.println(F("║  meteo / news / musica / smart   ║"));
    Serial.println(F("║  pump, buzzer, monitor ...       ║"));
    Serial.println(F("╚══════════════════════════════════╝"));
    return;
  }
  
  // ── log ──
  if (cmd.startsWith("log ")) {
    if (cmd == "log on") { debugLevel = DBG_VERBOSE; Serial.println(F("Log abilitati")); }
    else if (cmd == "log off") { debugLevel = DBG_NONE; Serial.println(F("Log disabilitati")); }
    return;
  }

  // ── reboot ──
  if (cmd.startsWith("reboot")) {
    if (cmd == "reboot all") {
      Serial1.println(F("REBOOT"));
      Serial.println(F("Riavvio globale NodeMCU + Mega..."));
    } else {
      Serial.println(F("Riavvio Mega..."));
    }
    delay(500);
#ifdef __AVR__
    wdt_enable(WDTO_15MS);
#endif
    while (true) {} // aspetta watchdog
  }

  // ── set <var>=<val> ──
  if (cmd.startsWith("set ")) {
    String arg = cmdOriginal.substring(4);
    arg.trim();
    
    // Supporto sia "var=val" che "var val"
    int sepIdx = arg.indexOf('=');
    if (sepIdx < 0) sepIdx = arg.indexOf(' ');
    
    if (sepIdx > 0) {
      String prop = arg.substring(0, sepIdx);
      String val  = arg.substring(sepIdx + 1);
      prop.trim(); val.trim();
      String propL = prop; propL.toLowerCase();
      String valL  = val;  valL.toLowerCase();
      
      bool isOn  = (valL == "on"  || valL == "1" || valL == "true");
      bool isOff = (valL == "off" || valL == "0" || valL == "false");
      float vNum = val.toFloat();

      // Gestione ALLARMI (compatibilità e nuovo formato)
      if (propL.startsWith("alarm ")) {
         // gestito ricorsivamente o qui sotto? meglio qui sotto
         propL = propL.substring(6); propL.trim();
      }

      if (propL == "temp_high" || propL == "caldo") {
        if (isOn || isOff) enTempHigh = isOn; else threshTempHigh = vNum;
      } else if (propL == "temp_low" || propL == "freddo") {
        if (isOn || isOff) enTempLow = isOn; else threshTempLow = vNum;
      } else if (propL == "hum_high" || propL == "umido") {
        if (isOn || isOff) enHumHigh = isOn; else threshHumHigh = vNum;
      } else if (propL == "hum_low" || propL == "secco") {
        if (isOn || isOff) enHumLow = isOn; else threshHumLow = vNum;
      } else if (propL == "ph_high" || propL == "basico") {
        if (isOn || isOff) enPhHigh = isOn; else threshPhHigh = vNum;
      } else if (propL == "ph_low" || propL == "acido") {
        if (isOn || isOff) enPhLow = isOn; else threshPhLow = vNum;
      }
      // Gestione ATTUATORI
      else if (propL == "pump_speed" || propL == "pompa_vel") {
        pumpSpeed = (int)vNum;
        if (pumpOn) applicaPompa();
      } else if (propL == "pump" || propL == "pompa") {
        pumpOn = isOn; applicaPompa(); aggiornaDisplay();
      } else if (propL == "buzzer_freq") {
        buzzerFreq = (int)vNum;
        if (buzzerOn) tone(BUZZER_PIN, buzzerFreq);
      } else if (propL == "buzzer") {
        if (isOff) { noTone(BUZZER_PIN); buzzerOn = false; }
        else { buzzerOn = true; if (vNum > 0) buzzerFreq = (int)vNum; tone(BUZZER_PIN, buzzerFreq); }
      } else if (propL == "monitor") {
        monitorOn = isOn; 
        // digitalWrite(MONITOR_PIN, monitorOn ? HIGH : LOW); // DISATTIVATO
      } else if (propL == "debug" || propL == "log") {
        debugLevel = (uint8_t)vNum;
      } else {
        Serial.print(F("Variabile '")); Serial.print(prop); Serial.println(F("' non riconosciuta."));
        return;
      }
      
      Serial.print(F("OK: ")); Serial.print(prop); Serial.print(F(" = ")); Serial.println(val);
    } else {
      Serial.println(F("Uso: set <nometest>=<valore>  (es: set caldo=32.5)"));
    }
    return;
  }

  // ── get <var> ──
  if (cmd.startsWith("get")) {
    String arg = cmd.substring(3);
    arg.trim(); arg.toLowerCase();
    
    if (arg == "" || arg == "help" || arg == "list") {
      Serial.println(F("── VARIABILI PLANT ──"));
      Serial.println(F("  Sensori: temp, hum, ph, uptime, ram, debug"));
      Serial.println(F("  Soglie:  caldo, freddo, umido, secco, basico, acido"));
      Serial.println(F("  Stato:   pump, pump_speed, buzzer, buzzer_freq, monitor"));
      return;
    }

    Serial.print(F("VALORE ")); Serial.print(arg); Serial.print(F(": "));
    if (arg == "temp") Serial.println(temperature, 1);
    else if (arg == "hum" || arg == "umidita") Serial.println(humidity, 1);
    else if (arg == "ph") Serial.println(phValue, 2);
    else if (arg == "uptime") Serial.println(millis() / 1000);
    else if (arg == "ram") Serial.println(freeRam());
    else if (arg == "debug") Serial.println(debugLevel);
    
    else if (arg == "temp_high" || arg == "caldo") Serial.println(threshTempHigh, 1);
    else if (arg == "temp_low"  || arg == "freddo") Serial.println(threshTempLow, 1);
    else if (arg == "hum_high"  || arg == "umido") Serial.println(threshHumHigh, 1);
    else if (arg == "hum_low"   || arg == "secco") Serial.println(threshHumLow, 1);
    else if (arg == "ph_high"   || arg == "basico") Serial.println(threshPhHigh, 1);
    else if (arg == "ph_low"    || arg == "acido") Serial.println(threshPhLow, 1);
    
    else if (arg == "en_temp_high") Serial.println(enTempHigh ? 1 : 0);
    else if (arg == "en_temp_low" ) Serial.println(enTempLow ? 1 : 0);
    else if (arg == "en_hum_high" ) Serial.println(enHumHigh ? 1 : 0);
    else if (arg == "en_hum_low"  ) Serial.println(enHumLow ? 1 : 0);
    else if (arg == "en_ph_high"  ) Serial.println(enPhHigh ? 1 : 0);
    else if (arg == "en_ph_low"   ) Serial.println(enPhLow ? 1 : 0);
    
    else if (arg == "pump" || arg == "pompa") Serial.println(pumpOn ? 1 : 0);
    else if (arg == "pump_speed" || arg == "pompa_vel") Serial.println(pumpSpeed);
    else if (arg == "buzzer") Serial.println(buzzerOn ? 1 : 0);
    else if (arg == "buzzer_freq") Serial.println(buzzerFreq);
    else if (arg == "monitor") Serial.println(monitorOn ? 1 : 0);
    else Serial.println(F("Sconosciuta. Digita 'get help' per la lista."));
    
    return;
  }

  // ── send ──
  if (cmd.startsWith("send ")) {
    String p = cmdOriginal.substring(5);
    Serial1.println(p);
    Serial.print(F("Inviato a NodeMCU: "));
    Serial.println(p);
    return;
  }

  // ── API / Advanced PLANT OS ──
  if (cmd.startsWith("api ")) { Serial.print(F("API: ")); Serial.println(cmdOriginal.substring(4)); return; }
  if (cmd == "update all") { 
    uint8_t old = dataCycle;
    dataCycle = 0; inviaDati();
    dataCycle = 1; inviaDati();
    dataCycle = 2; inviaDati();
    dataCycle = old;
    Serial.println(F("Forzato aggiornamento completo.")); 
    return; 
  }
  if (cmd == "sync") {
    Serial1.println(F("{\"type\":\"COMMAND\",\"action\":\"sync\"}"));
    Serial.println(F("Sync con NodeMCU..."));
    return;
  }
  if (cmd.startsWith("meteo")) { 
    if (cmd == "meteo") {
      Serial.println(F("── STATO METEO ──"));
      Serial.print(F("  Città:      ")); Serial.println(geoCity);
      Serial.println(F("  Status:     [mock] Sereno"));
    } else {
      Serial1.println(F("{\"type\":\"COMMAND\",\"action\":\"meteo\"}")); 
      Serial.println(F("Richiesta meteo...")); 
    }
    return; 
  }
  if (cmd.startsWith("news")) { 
    if (cmd == "news") {
      Serial.println(F("── STATO NEWS ──"));
      Serial.println(F("  Sorgente:   Google News [mock]"));
      Serial.println(F("  Ultima:     Nessuna notizia rilevante."));
    } else {
      Serial1.println(F("{\"type\":\"COMMAND\",\"action\":\"news\"}")); 
      Serial.println(F("Richiesta news...")); 
    }
    return; 
  }
  if (cmd.startsWith("musica")) { 
    if (cmd == "musica") {
      Serial.println(F("── STATO MUSICA ──"));
      Serial.println(F("  Player:     [mock] STOP"));
    } else {
      Serial.print(F("Media player: ")); Serial.println(cmdOriginal); 
    }
    return; 
  }
  if (cmd.startsWith("smart")) { 
    if (cmd == "smart") {
      Serial.println(F("── STATO SMART HOME ──"));
      Serial.println(F("  Dispositivi: [mock] Tutti online"));
    } else {
      Serial.print(F("Smart Home plugin: ")); Serial.println(cmdOriginal); 
    }
    return; 
  }

  // ── status ──
  if (cmd == "status") {
    Serial.println(F("── STATO SISTEMA ──"));
    Serial.print(F("  Rete WiFi: ")); Serial.print(wifiSSID); Serial.print(F(" | IP: ")); Serial.println(wifiIP);
    Serial.print(F("  Temp:    ")); Serial.print(temperature, 1); Serial.print(F("°C"));
    if (tempAlertHigh) Serial.print(F(" [CALDO]"));
    if (tempAlertLow)  Serial.print(F(" [FREDDO]"));
    if (!dhtOnline) Serial.print(F(" [OFFLINE]"));
    Serial.println();
    Serial.print(F("  Umidità: ")); Serial.print(humidity, 1); Serial.print(F("%"));
    if (humAlertHigh) Serial.print(F(" [UMIDO]"));
    if (humAlertLow)  Serial.print(F(" [SECCO]"));
    Serial.println();
    Serial.print(F("  pH:      ")); Serial.print(phValue, 2);
    if (phAlertLow)  Serial.print(F(" [ACIDO]"));
    if (phAlertHigh) Serial.print(F(" [BASICO]"));
    Serial.println();
    Serial.print(F("  Pompa:   ")); Serial.print(pumpOn ? F("ON") : F("OFF"));
    Serial.print(F("  vel:")); Serial.println(pumpSpeed);
    Serial.print(F("  Buzzer:  ")); Serial.print(buzzerOn ? F("ON") : F("OFF"));
    Serial.print(F("  freq:")); Serial.println(buzzerFreq);
    Serial.print(F("  Monitor: ")); Serial.println(monitorOn ? F("ON") : F("OFF"));
    Serial.print(F("  Uptime:  ")); Serial.print(millis() / 1000); Serial.println(F("s"));
    Serial.print(F("  RAM lib: ")); Serial.print(freeRam()); Serial.println(F(" byte"));
    Serial.print(F("  Debug:   ")); Serial.println(debugLevel);
    return;
  }

  // ── ip ──
  if (cmd == "ip") {
    Serial.print(F("Rete WiFi (SSID): ")); Serial.println(wifiSSID);
    Serial.print(F("Indirizzo IP:     ")); Serial.println(wifiIP);
    return;
  }

  // ── errors ──
  if (cmd.startsWith("errors")) {
    if (cmd == "errors clear") {
      errJsonParse = 0; errDhtRead = 0; errBufferOver = 0;
      Serial.println(F("Registri errori cancellati."));
    } else {
      Serial.println(F("── CONTATORI ERRORI ──"));
      Serial.print(F("  JSON parse:  ")); Serial.println(errJsonParse);
      Serial.print(F("  DHT read:    ")); Serial.println(errDhtRead);
      Serial.print(F("  Buf overflow:")); Serial.println(errBufferOver);
    }
    return;
  }

  // ── pump ──
  if (cmd.startsWith("pump")) {
    String arg = cmd.substring(4);
    arg.trim();
    if (arg == "") {
      Serial.println(F("── STATO POMPA ──"));
      Serial.print(F("  Stato:      ")); Serial.println(pumpOn ? F("ON") : F("OFF"));
      Serial.print(F("  Velocità:   ")); Serial.print(pumpSpeed); Serial.println(F("%"));
      if (pumpEndMs > 0) {
        Serial.print(F("  Timer:      ")); Serial.print((pumpEndMs - millis()) / 1000); Serial.println(F("s rimanenti"));
      }
    } else if (arg == "on") {
      pumpOn = true;
      applicaPompa();
      aggiornaDisplay();
      Serial.println(F("Pompa ON"));
    } else if (arg == "off") {
      pumpOn = false;
      pumpEndMs = 0;
      applicaPompa();
      aggiornaDisplay();
      Serial.println(F("Pompa OFF"));
    } else if (arg.startsWith("duration")) {
      int dur = arg.substring(8).toInt();
      if (dur > 0) {
        pumpEndMs = millis() + (dur * 1000UL);
        pumpOn = true;
        applicaPompa();
        aggiornaDisplay();
        Serial.print(F("Pompa temporizzata: ")); Serial.print(dur); Serial.println(F("s"));
      } else {
        Serial.println(F("Uso: pump duration <secondi>"));
      }
    } else {
      int spd = arg.toInt();
      if (spd >= 0 && spd <= 100) {
        pumpSpeed = spd;
        // if (pumpOn) analogWrite(PUMP_PIN, map(pumpSpeed, 0, 100, 0, 255)); // DISATTIVATO
        Serial.print(F("Pompa velocità: ")); Serial.println(pumpSpeed);
      } else {
        Serial.println(F("Uso: pump on | pump off | pump <0-100> | pump duration <sec>"));
      }
    }
    return;
  }

  // ── alarms ──
  if (cmd.startsWith("alarms")) {
    String arg = cmd.substring(6);
    arg.trim();
    if (arg == "") {
      Serial.println(F("── RIEPILOGO ALLARMI ──"));
      Serial.print(F("  Buzzer Master: ")); Serial.println(buzzerAlarmsEnabled ? F("ON") : F("OFF"));
      Serial.println(F("  Soglie e Abilitazione:"));
      
      Serial.print(F("    Caldo:  ")); Serial.print(threshTempHigh, 1); Serial.print(F(" C [")); Serial.print(enTempHigh ? F("Abilitato") : F("OFF")); Serial.println(F("]"));
      Serial.print(F("    Freddo: ")); Serial.print(threshTempLow, 1);  Serial.print(F(" C [")); Serial.print(enTempLow  ? F("Abilitato") : F("OFF")); Serial.println(F("]"));
      Serial.print(F("    Umido:  ")); Serial.print(threshHumHigh, 1);  Serial.print(F(" % [")); Serial.print(enHumHigh ? F("Abilitato") : F("OFF")); Serial.println(F("]"));
      Serial.print(F("    Secco:  ")); Serial.print(threshHumLow, 1);   Serial.print(F(" % [")); Serial.print(enHumLow  ? F("Abilitato") : F("OFF")); Serial.println(F("]"));
      Serial.print(F("    Acido:  ")); Serial.print(threshPhLow, 2);    Serial.print(F("   [")); Serial.print(enPhLow   ? F("Abilitato") : F("OFF")); Serial.println(F("]"));
      Serial.print(F("    Basico: ")); Serial.print(threshPhHigh, 2);   Serial.print(F("   [")); Serial.print(enPhHigh  ? F("Abilitato") : F("OFF")); Serial.println(F("]"));
    } else if (arg == "on") { 
      buzzerAlarmsEnabled = true; Serial.println(F("Allarmi Master ON")); 
    } else if (arg == "off") { 
      buzzerAlarmsEnabled = false; Serial.println(F("Allarmi Master OFF")); noTone(BUZZER_PIN); buzzerOn=false; 
    } else {
      Serial.println(F("Uso: alarms [on | off]"));
    }
    return;
  }

  // ── buzzer ──
  if (cmd.startsWith("buzzer")) {
    String arg = cmd.substring(6);
    arg.trim();
    if (arg == "") {
      Serial.println(F("── STATO BUZZER ──"));
      Serial.print(F("  Stato:      ")); Serial.println(buzzerOn ? F("ON") : F("OFF"));
      Serial.print(F("  Frequenza:  ")); Serial.print(buzzerFreq); Serial.println(F(" Hz"));
      Serial.print(F("  Allarmi:    ")); Serial.println(buzzerAlarmsEnabled ? F("Abilitati") : F("Disabilitati"));
    } else if (arg == "off") {
      suonaFrequenza(0, 0);
      Serial.println(F("Buzzer OFF"));
    } else {
      int spaceIdx = arg.indexOf(' ');
      int freq = 0, dur = 1000;
      if (spaceIdx > 0) {
        freq = arg.substring(0, spaceIdx).toInt();
        dur  = arg.substring(spaceIdx + 1).toInt();
      } else {
        freq = arg.toInt();
      }
      if (freq > 0) {
        suonaFrequenza(freq, dur);
      } else {
        Serial.println(F("Uso: buzzer <freq> [durata_ms] | buzzer off"));
      }
    }
    return;
  }

  // ── monitor ──
  if (cmd.startsWith("monitor")) {
    String arg = cmd.substring(7);
    arg.trim();
    if (arg == "") {
      Serial.println(F("── STATO MONITOR ──"));
      Serial.print(F("  Stato:      ")); Serial.println(monitorOn ? F("ON") : F("OFF"));
    } else if (arg == "on")  { 
      monitorOn = true;  
      // digitalWrite(MONITOR_PIN, HIGH); // DISATTIVATO
      Serial.println(F("Monitor ON")); 
    } else if (arg == "off") { 
      monitorOn = false; 
      // digitalWrite(MONITOR_PIN, LOW);  // DISATTIVATO
      Serial.println(F("Monitor OFF")); 
    } else Serial.println(F("Uso: monitor on | monitor off"));
    return;
  }

  // ── wifi ──
  if (cmd.startsWith("wifi ")) {
    String arg = cmdOriginal.substring(5);
    arg.trim();
    
    if (arg.equalsIgnoreCase("test") || arg.equalsIgnoreCase("info")) {
      Serial1.println(F("GETIP"));
      Serial.println(F("Richiesta info WiFi al NodeMCU..."));
      return;
    }
    if (arg.startsWith("set ")) {
      arg = arg.substring(4);
      arg.trim();
    }

    String ssid = "";
    String pwd  = "";
    
    // Ricerca separatore | o ,
    int sepPipe = arg.indexOf('|');
    int sepComma = arg.indexOf(',');

    if (sepPipe > 0) {
      ssid = arg.substring(0, sepPipe);
      pwd  = arg.substring(sepPipe + 1);
    } else if (sepComma > 0) {
      ssid = arg.substring(0, sepComma);
      pwd  = arg.substring(sepComma + 1);
    } else if (arg.startsWith("\"")) {
      int endSsid = arg.indexOf('"', 1);
      if (endSsid > 0) {
        ssid = arg.substring(1, endSsid);
        pwd  = arg.substring(endSsid + 1);
      }
    } else {
      int spaceIdx = arg.indexOf(' ');
      if (spaceIdx > 0) {
        ssid = arg.substring(0, spaceIdx);
        pwd  = arg.substring(spaceIdx + 1);
      } else {
        ssid = arg;
      }
    }
    
    ssid.trim();
    pwd.trim();
    
    // Pulizia di eventuali virgolette
    if (pwd.startsWith("\"") && pwd.endsWith("\"") && pwd.length() >= 2) {
      pwd = pwd.substring(1, pwd.length() - 1);
    }
    
    if (ssid.length() > 0) {
      StaticJsonDocument<300> wdoc;
      wdoc[F("type")]   = "SET";
      wdoc[F("target")] = "wifi";
      wdoc[F("ssid")]   = ssid;
      wdoc[F("pwd")]    = pwd;
      
      String out;
      serializeJson(wdoc, out);
      Serial1.println(out);
      Serial.print(F("Inviata configurazione WiFi: ")); Serial.println(ssid);
    } else {
      Serial.println(F("Uso: wifi Nome Rete,Password123!   oppure   wifi Rete|Password"));
    }
    return;
  }

  // ── debug ──
  if (cmd.startsWith("debug")) {
    String arg = cmd.substring(5);
    arg.trim();
    int lvl = arg.toInt();
    if (lvl >= DBG_NONE && lvl <= DBG_VERBOSE) {
      debugLevel = lvl;
      Serial.print(F("Debug livello: ")); Serial.println(debugLevel);
    } else {
      Serial.println(F("Uso: debug <0-4> (0=OFF 1=ERR 2=WARN 3=INFO 4=VERBOSE)"));
    }
    return;
  }

  // ── broadcast ──
  if (cmd == "broadcast") {
    StaticJsonDocument<128> cdoc;
    cdoc[F("type")]   = "COMMAND";
    cdoc[F("action")] = "broadcast";
    String out;
    serializeJson(cdoc, out);
    Serial1.println(out);
    Serial.println(F("Comando BROADCAST (Welcome Card) inviato al WIFI"));
    return;
  }

  // ── node_set ──
  if (cmd.startsWith("node_set ")) {
    String arg = cmdOriginal.substring(9);
    arg.trim();
    int spaceIdx = arg.indexOf(' ');
    if (spaceIdx > 0) {
      String chiave = arg.substring(0, spaceIdx);
      String valore = arg.substring(spaceIdx + 1);
      
      StaticJsonDocument<256> sdoc;
      sdoc[F("type")]   = "SET";
      sdoc[F("target")] = chiave;
      if (valore == "true" || valore == "false") {
        sdoc[F("value")] = (valore == "true");
      } else if (valore.toFloat() != 0.0 || valore == "0" || valore == "0.0") {
        sdoc[F("value")] = valore.toFloat();
      } else {
        sdoc[F("value")] = valore;
      }
      String out;
      serializeJson(sdoc, out);
      Serial1.println(out);
      Serial.print(F("Impostazione generica inviata: ")); Serial.print(chiave); Serial.print(F("=")); Serial.println(valore);
    } else {
      Serial.println(F("Uso: node_set <chiave> <valore>"));
    }
    return;
  }

  // ── reboot ──
  if (cmd == "reboot") {
    Serial.println(F("Riavvio in corso..."));
    delay(200);
    // Forza reset via watchdog
#ifdef __AVR__
    wdt_enable(WDTO_15MS);
#endif
    while (true) {}
  }

  // ── Inoltro JSON al NodeMCU ──
  if (cmd.startsWith("{")) {
    Serial1.println(cmd);
    Serial.println(F("JSON inoltrato al NodeMCU"));
    return;
  }

  Serial.println(F("Comando sconosciuto. Digita 'help' per la lista."));
}

// =================================================================
//  GESTIONE COMANDI JSON (da NodeMCU)
// =================================================================
void gestisciComandoJSON(String raw) {
  raw.trim();
  if (raw.length() == 0) return;

  // ── Gestione Messaggi Testuali (Non-JSON) ──
  if (!raw.startsWith("{")) {
    if (raw.startsWith("CARD:")) { 
      // Opzionale: gestire il biglietto da visita se necessario
      return; 
    }
    if (raw.startsWith("STATUS:")) {
      String msg = raw.substring(7);
      LOG_I(String(F("NodeMCU status: ")) + msg);
      if (msg == "BOOT") LOG_I(F("Reset connessione..."));
      return;
    }
    // Ignora altri messaggi di testo (help, status manuale, ecc) senza loggare errore
    if (debugLevel >= DBG_VERBOSE) {
      LOG_V(String(F("Msg testo da MCU: ")) + raw);
    }
    return;
  }

  if (debugLevel >= DBG_VERBOSE) {
    Serial.print(F("[MCU->MEGA] ")); Serial.println(raw);
  }
  
  StaticJsonDocument<1024> doc;
  DeserializationError err = deserializeJson(doc, raw);

  // Se è JSON valido, aggiorniamo il timestamp di vita dell'MCU
  if (!err) {
    lastSyncMs = millis();
  } else {
    errJsonParse++;
    LOG_W(String(F("JSON parse error: ")) + err.c_str() + F(" | ") + raw.substring(0, 40));
    return;
  }

  const char* type = doc[F("type")] | "";

  // ── HANDSHAKE SYNC ──

  if (strcmp(type, "SYNC") == 0) {
    int step = doc[F("step")] | 0;
    if (step == 1) {
      Serial1.println(F("{\"type\":\"SYNC\",\"step\":2}"));
      LOG_V(F("SYNC: Step 1 ricevuto -> Inviato Step 2"));
    } else if (step == 3) {
      mcuSynched = true;
      lastSyncMs = millis();
      LOG_V(F("SYNC: Step 3 ricevuto -> BOARD SINCRONIZZATE!"));
      dataCycle = 0; inviaDati();
    }
    return;
  }


  // ── SET ──
  if (strcmp(type, "SET") == 0) {
    const char* target = doc[F("target")] | "";

    if (strcmp(target, "buzzer") == 0) {
      if (doc.containsKey(F("freq"))) {
        int freq   = doc[F("freq")]     | 0;
        int durata = doc[F("duration")] | 1000;
        suonaFrequenza(freq, durata);
      } else {
        buzzerOn = doc[F("value")] | false;
        if (buzzerOn) {
          tone(BUZZER_PIN, 1000);
          buzzerFreq = 1000;
        } else {
          noTone(BUZZER_PIN);
          buzzerFreq = 0;
        }
      }
      LOG_I(String(F("Buzzer: ")) + (buzzerOn ? "ON" : "OFF") + " freq:" + buzzerFreq);
    }
    else if (strcmp(target, "pump") == 0) {
      if (doc.containsKey(F("on"))) {
        pumpOn = doc[F("on")];
      }
      if (doc.containsKey(F("speed"))) {
        pumpSpeed = constrain((int)doc[F("speed")], 0, 100);
      }
      if (doc.containsKey(F("duration")) && pumpOn) {
        int duration = doc[F("duration")];
        if (duration > 0) pumpEndMs = millis() + ((unsigned long)duration * 1000UL);
        else pumpEndMs = 0;
      } else {
        pumpEndMs = 0;
      }
      applicaPompa();
      aggiornaDisplay();
      LOG_I(String(F("Pompa: ")) + (pumpOn ? "ON" : "OFF") + " vel:" + pumpSpeed);
    }
    else if (strcmp(target, "monitor") == 0) {
      monitorOn = doc[F("value")] | false;
      // digitalWrite(MONITOR_PIN, monitorOn ? HIGH : LOW); // DISATTIVATO
      LOG_I(String(F("Monitor: ")) + (monitorOn ? "ON" : "OFF"));
    }
    else if (strcmp(target, "datetime") == 0) {
      if (doc.containsKey(F("year")))    dtYear    = doc[F("year")];
      if (doc.containsKey(F("month")))   dtMonth   = doc[F("month")];
      if (doc.containsKey(F("day")))     dtDay     = doc[F("day")];
      if (doc.containsKey(F("hour")))    dtHour    = doc[F("hour")];
      if (doc.containsKey(F("minute")))  dtMinute  = doc[F("minute")];
      if (doc.containsKey(F("second")))  dtSecond  = doc[F("second")];
      if (doc.containsKey(F("weekday"))) dtWeekday = doc[F("weekday")].as<String>();
      LOG_I(F("Data/ora aggiornata"));
    }
    else if (strcmp(target, "geo") == 0) {
      if (doc.containsKey(F("lat")))  geoLat  = doc[F("lat")];
      if (doc.containsKey(F("lon")))  geoLon  = doc[F("lon")];
      if (doc.containsKey(F("city"))) geoCity = doc[F("city")].as<String>();
      LOG_I(F("Geoloc aggiornata"));
    }
    else if (strcmp(target, "settings") == 0) {
      if (doc.containsKey(F("buzzer_alarms"))) buzzerAlarmsEnabled = doc[F("buzzer_alarms")];
      LOG_I(String(F("Settings: Allarmi buzzer ")) + (buzzerAlarmsEnabled ? "ON" : "OFF"));
    }
    else {
      LOG_W(String(F("Target sconosciuto: ")) + target);
    }

    // ACK
    inviaACK(target, true);
  }

  // ── GET ──
  else if (strcmp(type, "GET") == 0) {
    inviaDati();
  }

  // ── STATUS ──
  else if (strcmp(type, "STATUS") == 0) {
    const char* msg = doc[F("msg")] | "";
    if (strcmp(msg, "CONNECTED") == 0) {
      if (doc.containsKey(F("ip"))) wifiIP = doc[F("ip")].as<String>();
      if (doc.containsKey(F("ssid"))) wifiSSID = doc[F("ssid")].as<String>();
      aggiornaDisplay();
    }
    LOG_I(String(F("NodeMCU status: ")) + msg);
  }

  else {
    LOG_W(String(F("Tipo msg sconosciuto: ")) + type);
  }
}

// =================================================================
//  INVIO ACK
// =================================================================
void inviaACK(const char* target, bool ok) {
  StaticJsonDocument<128> ack;
  ack[F("type")]   = "ACK";
  ack[F("target")] = target;
  ack[F("ok")]     = ok;
  String ackStr;
  serializeJson(ack, ackStr);
  Serial1.println(ackStr);
}

// =================================================================
//  DISPLAY UI (ILI9488 - KMRTM35018-SPI 480x320)
// =================================================================

// Cache per evitare ridisegni inutili
static String prevIP      = "";
static bool   prevPumpOn  = false;
static int    prevPumpSpd = -1;

void disegnaInterfacciaStatica() {
  tft.fillScreen(COLOR_BLACK);
  
  // Header
  tft.fillRect(0, 0, 480, 40, COLOR_NAVY);
  tft.setCursor(20, 12);
  tft.setTextColor(COLOR_WHITE, COLOR_NAVY);
  tft.setTextSize(2);
  tft.print(F("PLANT SYSTEM"));

  // Etichetta Network
  tft.drawFastHLine(0, 55, 480, COLOR_DARKGREY);
  tft.setCursor(15, 65);
  tft.setTextColor(COLOR_LIGHTGREY, COLOR_BLACK);
  tft.setTextSize(1);
  tft.print(F("NETWORK:"));
  
  // Etichetta Pump
  tft.drawFastHLine(0, 155, 480, COLOR_DARKGREY);
  tft.setCursor(15, 165);
  tft.setTextColor(COLOR_LIGHTGREY, COLOR_BLACK);
  tft.setTextSize(1);
  tft.print(F("PUMP STATUS:"));

  // Reset cache per forzare primo disegno
  prevIP   = "__init__";
  prevPumpSpd = -1;
}

void aggiornaDisplay() {
  // 1. WiFi / IP (solo se cambiato)
  String curIP = (wifiIP != "0.0.0.0" && wifiIP != "") ? wifiIP : "";
  if (curIP != prevIP) {
    prevIP = curIP;
    tft.fillRect(15, 80, 450, 65, COLOR_BLACK);
    tft.setCursor(15, 85);
    if (curIP.length() > 0) {
      tft.setTextColor(COLOR_GREEN, COLOR_BLACK);
      tft.setTextSize(2);
      tft.print(F("ONLINE"));
      tft.setCursor(15, 115);
      tft.setTextColor(COLOR_WHITE, COLOR_BLACK);
      tft.print(curIP);
    } else {
      tft.setTextColor(COLOR_RED, COLOR_BLACK);
      tft.setTextSize(2);
      tft.print(F("OFFLINE"));
      tft.setCursor(15, 115);
      tft.setTextColor(COLOR_LIGHTGREY, COLOR_BLACK);
      tft.setTextSize(1);
      tft.print(F("In attesa del NodeMCU..."));
    }
  }

  // 2. Pompa (solo se cambiato)
  if (pumpOn != prevPumpOn || pumpSpeed != prevPumpSpd) {
    prevPumpOn  = pumpOn;
    prevPumpSpd = pumpSpeed;
    tft.fillRect(15, 180, 450, 30, COLOR_BLACK);
    tft.setCursor(15, 185);
    tft.setTextSize(2);
    if (pumpOn) {
      tft.setTextColor(COLOR_YELLOW, COLOR_BLACK);
      tft.print(F("RUNNING ("));
      tft.print(pumpSpeed);
      tft.print(F("%)"));
    } else {
      tft.setTextColor(COLOR_CYAN, COLOR_BLACK);
      tft.print(F("OFF / IDLE"));
    }
  }
}
