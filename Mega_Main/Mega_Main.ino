// ================================================================
//  Arduino Mega 2560 — Sistema completo
//  Sensori: DHT11 (temp+umidita), pH analogico, pulsante
//  Attuatori: pompa PWM, buzzer passivo, monitor
//  Comunicazione: Serial1 (pin 18/19) <-> NodeMCU
//  Protocollo: JSON su Serial1
// ================================================================
//  LIBRERIE NECESSARIE (Library Manager):
//    DHT sensor library  by Adafruit
//    ArduinoJson         by Benoit Blanchon  (versione 6.x)
// ================================================================
//  PIN MAP:
//    Pin  2  -> DHT11 Signal
//    Pin  7  -> Pulsante verde (INPUT_PULLUP, GND sull'altro lato)
//    Pin  8  -> Buzzer passivo (un pin -> 8, altro pin -> GND)
//    Pin  9  -> Pompa (PWM -> MOSFET gate)
//    Pin 10  -> Monitor TFT on/off
//    Pin 18  -> TX1 -> NodeMCU RX  (via partitore 1kOhm+2kOhm)
//    Pin 19  -> RX1 <- NodeMCU TX  (diretto)
//    Pin A2  -> Sensore pH OUT  (modulo pH-4502C VCC->5V GND->GND)
// ================================================================

#include <DHT.h>
#include <ArduinoJson.h>

// ── Pin ──────────────────────────────────────────────────────────
#define DHT_PIN      2
#define DHT_TYPE     DHT11
#define BTN_PIN      7
#define BUZZER_PIN   8
#define PUMP_PIN     9
#define MONITOR_PIN  10
#define PH_PIN       A2

// ── Soglie ───────────────────────────────────────────────────────
#define TEMP_ALERT   30.0   // C  - sopra questa soglia allarme temp
#define HUM_ALERT    80.0   // %  - sopra questa soglia allarme umidita
#define PH_MIN        6.0   // sotto questa soglia allarme acido
#define PH_MAX        8.0   // sopra questa soglia allarme basico

// ── Calibrazione pH ──────────────────────────────────────────────
#define PH_OFFSET    0.0    // <-- modifica dopo calibrazione
#define PH_SAMPLES   10     // numero campioni per media

// ── Intervalli ───────────────────────────────────────────────────
#define INTERVAL_SENSOR   2000
#define INTERVAL_SEND     3000

// ── Oggetti ──────────────────────────────────────────────────────
DHT dht(DHT_PIN, DHT_TYPE);

// ── Stato sensori ────────────────────────────────────────────────
float  temperature   = 0.0;
float  humidity      = 0.0;
float  phValue       = 7.0;
bool   tempAlert     = false;
bool   humAlert      = false;
bool   phAlertLow    = false;
bool   phAlertHigh   = false;

// ── Stato attuatori ──────────────────────────────────────────────
bool   buzzerOn      = false;
int    buzzerFreq    = 0;        // frequenza corrente (0 = spento)
unsigned long buzzerEndMs = 0;   // auto-stop dopo durata
bool   pumpOn        = false;
int    pumpSpeed     = 0;
bool   monitorOn     = false;
bool   btnPressed    = false;
bool   btnPrevState  = false;
unsigned long pumpLastOn = 0;

// ── Data/ora ─────────────────────────────────────────────────────
int    dtYear    = 2025;
int    dtMonth   = 1;
int    dtDay     = 1;
int    dtHour    = 0;
int    dtMinute  = 0;
int    dtSecond  = 0;
String dtWeekday = "---";
float  geoLat    = 0.0;
float  geoLon    = 0.0;
String geoCity   = "";

// ── Timer ────────────────────────────────────────────────────────
unsigned long lastSensorMs = 0;
unsigned long lastSendMs   = 0;
unsigned long lastSecMs    = 0;

// ── Buffer Serial1 ───────────────────────────────────────────────
String serial1Buf = "";

// =================================================================
//  SETUP
// =================================================================
void setup() {
  Serial.begin(9600);
  Serial1.begin(9600);

  dht.begin();

  pinMode(BUZZER_PIN,  OUTPUT);
  pinMode(PUMP_PIN,    OUTPUT);
  pinMode(MONITOR_PIN, OUTPUT);
  pinMode(BTN_PIN,     INPUT_PULLUP);

  digitalWrite(BUZZER_PIN,  LOW);
  analogWrite(PUMP_PIN,     0);
  digitalWrite(MONITOR_PIN, LOW);

  Serial.println(F("================================="));
  Serial.println(F("  Arduino Mega — Sistema avviato"));
  Serial.println(F("  Pin pH:     A2"));
  Serial.println(F("  Pin Buzzer: 8"));
  Serial.println(F("  Pin Btn:    7"));
  Serial.println(F("  Pin Pompa:  9"));
  Serial.println(F("================================="));

  beepAvvio();

  Serial1.println(F("{\"type\":\"STATUS\",\"msg\":\"BOOT\"}"));
}

// =================================================================
//  LOOP
// =================================================================
void loop() {
  unsigned long ora = millis();

  leggiPulsante();

  // Auto-stop buzzer dopo durata
  if (buzzerEndMs > 0 && ora >= buzzerEndMs) {
    noTone(BUZZER_PIN);
    buzzerOn   = false;
    buzzerFreq = 0;
    buzzerEndMs = 0;
  }

  if (ora - lastSensorMs >= INTERVAL_SENSOR) {
    leggiSensori();
    lastSensorMs = ora;
  }

  if (ora - lastSendMs >= INTERVAL_SEND) {
    inviaDati();
    lastSendMs = ora;
  }

  if (ora - lastSecMs >= 1000) {
    incrementaOra();
    lastSecMs = ora;
  }

  leggiSerial1();
}

// =================================================================
//  LETTURA SENSORE pH
// =================================================================
float leggiPH() {
  long somma = 0;
  for (int i = 0; i < PH_SAMPLES; i++) {
    somma += analogRead(PH_PIN);
    delay(10);
  }
  float media    = somma / (float)PH_SAMPLES;
  float tensione = media * (5.0 / 1023.0);
  float ph = 7.0 + ((2.50 - tensione) / 0.18) + PH_OFFSET;
  return constrain(ph, 0.0, 14.0);
}

// =================================================================
//  LETTURA SENSORI (DHT11 + pH)
// =================================================================
void leggiSensori() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t)) { temperature = t; tempAlert = (temperature >= TEMP_ALERT); }
  if (!isnan(h)) { humidity    = h; humAlert  = (humidity    >= HUM_ALERT);  }

  phValue     = leggiPH();
  phAlertLow  = (phValue < PH_MIN);
  phAlertHigh = (phValue > PH_MAX);

  Serial.print(F("T:")); Serial.print(temperature,1);
  Serial.print(F("C  H:")); Serial.print(humidity,1);
  Serial.print(F("%  pH:")); Serial.print(phValue,2);
  if (phAlertLow)  Serial.print(F(" [ACIDO!]"));
  if (phAlertHigh) Serial.print(F(" [BASICO!]"));
  Serial.println();

  if (tempAlert)   gestisciBuzzerAllarme("TEMP");
  if (phAlertLow)  gestisciBuzzerAllarme("PH_LOW");
  if (phAlertHigh) gestisciBuzzerAllarme("PH_HIGH");
}

// =================================================================
//  GESTIONE BUZZER
// =================================================================
void gestisciBuzzerAllarme(String tipo) {
  if (tipo == "TEMP") {
    for (int i = 0; i < 3; i++) { tone(BUZZER_PIN, 1200, 100); delay(150); }
    noTone(BUZZER_PIN);
  }
  else if (tipo == "PH_LOW") {
    for (int f = 1000; f >= 400; f -= 100) { tone(BUZZER_PIN, f, 60); delay(80); }
    noTone(BUZZER_PIN);
  }
  else if (tipo == "PH_HIGH") {
    for (int f = 400; f <= 1000; f += 100) { tone(BUZZER_PIN, f, 60); delay(80); }
    noTone(BUZZER_PIN);
  }
}

void beepAvvio() {
  tone(BUZZER_PIN, 523, 100); delay(120);
  tone(BUZZER_PIN, 659, 100); delay(120);
  tone(BUZZER_PIN, 784, 150); delay(200);
  noTone(BUZZER_PIN);
}
void beepPompaOn()  { tone(BUZZER_PIN, 784, 80); delay(100); tone(BUZZER_PIN, 880, 80); delay(100); noTone(BUZZER_PIN); }
void beepPompaOff() { tone(BUZZER_PIN, 880, 80); delay(100); tone(BUZZER_PIN, 784, 80); delay(100); noTone(BUZZER_PIN); }
void beepBtn()      { tone(BUZZER_PIN, 660, 60); delay(80);  noTone(BUZZER_PIN); }

// Suona una frequenza specifica per una durata (da WiFi)
void suonaFrequenza(int freq, int durataMs) {
  if (freq <= 0) {
    noTone(BUZZER_PIN);
    buzzerOn   = false;
    buzzerFreq = 0;
    buzzerEndMs = 0;
    return;
  }
  freq = constrain(freq, 31, 10000);  // range sicuro
  durataMs = constrain(durataMs, 50, 30000);
  tone(BUZZER_PIN, freq);
  buzzerOn    = true;
  buzzerFreq  = freq;
  buzzerEndMs = millis() + durataMs;
  Serial.print(F("Buzzer: ")); Serial.print(freq); Serial.print(F("Hz per ")); Serial.print(durataMs); Serial.println(F("ms"));
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

      if (stato) {
        pumpOn = !pumpOn;
        if (pumpOn) {
          pumpLastOn = millis();
          analogWrite(PUMP_PIN, map(max(pumpSpeed, 50), 0, 100, 0, 255));
          beepPompaOn();
          Serial.println(F("BTN -> Pompa ON"));
        } else {
          analogWrite(PUMP_PIN, 0);
          beepPompaOff();
          Serial.println(F("BTN -> Pompa OFF"));
        }
      }
    }
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
}

// =================================================================
//  COSTRUISCE JSON DATI COMPLETO
// =================================================================
String costruisciJSON() {
  StaticJsonDocument<700> doc;

  doc["type"] = "DATA";

  JsonObject temp = doc.createNestedObject("temperature");
  temp["value"]  = serialized(String(temperature, 1));
  temp["unit"]   = "C";
  temp["alert"]  = tempAlert;
  temp["status"] = tempAlert ? "ALLERTA" : "OK";

  JsonObject hum = doc.createNestedObject("humidity");
  hum["value"]  = serialized(String(humidity, 1));
  hum["unit"]   = "%";
  hum["alert"]  = humAlert;

  JsonObject ph = doc.createNestedObject("ph");
  ph["value"]      = serialized(String(phValue, 2));
  ph["alert_low"]  = phAlertLow;
  ph["alert_high"] = phAlertHigh;
  ph["status"]     = phAlertLow  ? "ACIDO"  :
                     phAlertHigh ? "BASICO" : "OK";
  ph["min"]        = serialized(String(PH_MIN, 1));
  ph["max"]        = serialized(String(PH_MAX, 1));

  JsonObject buz = doc.createNestedObject("buzzer");
  buz["on"]   = buzzerOn;
  buz["freq"] = buzzerFreq;

  JsonObject btn = doc.createNestedObject("button");
  btn["pressed"] = btnPressed;

  JsonObject pump = doc.createNestedObject("pump");
  pump["on"]      = pumpOn;
  pump["speed"]   = pumpSpeed;
  pump["last_on"] = pumpLastOn > 0 ? String((millis() - pumpLastOn) / 1000) + "s fa" : "mai";

  JsonObject mon = doc.createNestedObject("monitor");
  mon["on"] = monitorOn;

  JsonObject dt = doc.createNestedObject("datetime");
  dt["year"]=dtYear; dt["month"]=dtMonth; dt["day"]=dtDay;
  dt["hour"]=dtHour; dt["minute"]=dtMinute; dt["second"]=dtSecond;
  dt["weekday"]=dtWeekday;

  JsonObject geo = doc.createNestedObject("geo");
  geo["lat"]  = serialized(String(geoLat, 6));
  geo["lon"]  = serialized(String(geoLon, 6));
  geo["city"] = geoCity;

  String output;
  serializeJson(doc, output);
  return output;
}

// =================================================================
//  INVIA DATI AL NODEMCU
// =================================================================
void inviaDati() {
  Serial1.println(costruisciJSON());
}

void inviaEventoPulsante() {
  StaticJsonDocument<128> doc;
  doc["type"]    = "EVENT";
  doc["event"]   = "BUTTON";
  doc["pressed"] = btnPressed;
  String out;
  serializeJson(doc, out);
  Serial1.println(out);
}

// =================================================================
//  LEGGI COMANDI DA NODEMCU (JSON)
// =================================================================
void leggiSerial1() {
  while (Serial1.available()) {
    char c = (char)Serial1.read();
    if (c == '\n') {
      serial1Buf.trim();
      if (serial1Buf.length() > 0) gestisciComando(serial1Buf);
      serial1Buf = "";
    } else if (c != '\r') {
      serial1Buf += c;
    }
  }
}

void gestisciComando(String raw) {
  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, raw);

  if (err) {
    if (raw == "GET:DATA")    { inviaDati(); return; }
    if (raw == "STATUS:BOOT") { Serial.println(F("NodeMCU avviato")); return; }
    Serial.println("CMD non riconosciuto: " + raw);
    return;
  }

  String type = doc["type"] | "";

  if (type == "SET") {
    String target = doc["target"] | "";

    if (target == "buzzer") {
      // Supporta: on/off semplice OPPURE frequenza+durata
      if (doc.containsKey("freq")) {
        int freq    = doc["freq"]     | 0;
        int durata  = doc["duration"] | 1000;
        suonaFrequenza(freq, durata);
      } else {
        buzzerOn = doc["value"] | false;
        if (buzzerOn) {
          tone(BUZZER_PIN, 1000);  // freq default se non specificata
          buzzerFreq = 1000;
        } else {
          noTone(BUZZER_PIN);
          buzzerFreq = 0;
        }
      }
      Serial.println("Buzzer: " + String(buzzerOn ? "ON" : "OFF") + " freq:" + String(buzzerFreq));
    }

    else if (target == "pump") {
      if (doc.containsKey("on")) {
        pumpOn = doc["on"];
        if (pumpOn) {
          pumpLastOn = millis();
          analogWrite(PUMP_PIN, map(max(pumpSpeed, 30), 0, 100, 0, 255));
          beepPompaOn();
        } else {
          analogWrite(PUMP_PIN, 0);
          beepPompaOff();
        }
      }
      if (doc.containsKey("speed")) {
        pumpSpeed = constrain((int)doc["speed"], 0, 100);
        if (pumpOn) analogWrite(PUMP_PIN, map(pumpSpeed, 0, 100, 0, 255));
      }
      Serial.println("Pompa: " + String(pumpOn?"ON":"OFF") + " vel:" + String(pumpSpeed));
    }

    else if (target == "monitor") {
      monitorOn = doc["value"] | false;
      digitalWrite(MONITOR_PIN, monitorOn ? HIGH : LOW);
    }

    else if (target == "datetime") {
      if (doc.containsKey("year"))    dtYear    = doc["year"];
      if (doc.containsKey("month"))   dtMonth   = doc["month"];
      if (doc.containsKey("day"))     dtDay     = doc["day"];
      if (doc.containsKey("hour"))    dtHour    = doc["hour"];
      if (doc.containsKey("minute"))  dtMinute  = doc["minute"];
      if (doc.containsKey("second"))  dtSecond  = doc["second"];
      if (doc.containsKey("weekday")) dtWeekday = doc["weekday"].as<String>();
    }

    else if (target == "geo") {
      if (doc.containsKey("lat"))  geoLat  = doc["lat"];
      if (doc.containsKey("lon"))  geoLon  = doc["lon"];
      if (doc.containsKey("city")) geoCity = doc["city"].as<String>();
    }

    // ACK
    StaticJsonDocument<128> ack;
    ack["type"]   = "ACK";
    ack["target"] = target;
    ack["ok"]     = true;
    String ackStr;
    serializeJson(ack, ackStr);
    Serial1.println(ackStr);
  }

  else if (type == "GET") {
    inviaDati();
  }
}
