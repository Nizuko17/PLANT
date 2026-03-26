'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Droplets, Star, Calendar, Info, Play, ShoppingCart, 
  Sprout, Ghost, Plus, AlertTriangle, CheckCircle2, Trees, Flower2, Bug, 
  Trash2, Search
} from 'lucide-react';
import FadeIn from '@/components/FadeIn';

// Costanti di gioco
const TICK_RATE_MS = 3000;
const WATER_PER_DAY = 100;
const WATER_MANUAL_COST = 20;
const MOISTURE_MANUAL_ADD = 20;

// Definizione Vasi con Fix Dark Mode
const POT_DEFS = {
  'normal': { name: 'Vaso Normale', cost: 30, sell: 15, consumption: 50, xpMult: 1, auto: false, color: 'var(--text-primary)', bg: 'var(--card-bg)', border: 'var(--border-color)', btnText: 'var(--bg-color)' },
  'plant': { name: 'Vaso PLANT', cost: 50, sell: 35, consumption: 20, xpMult: 1, auto: true, color: 'var(--accent-green)', bg: 'rgba(34, 197, 94, 0.05)', border: 'var(--accent-green)', btnText: '#fff' },
  'plant-pro': { name: 'Vaso PLANT Pro', cost: 100, sell: 60, consumption: 10, xpMult: 2, auto: true, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.05)', border: '#a855f7', btnText: '#fff' },
  'plant-pro-max': { name: 'Vaso Pro Max', cost: 200, sell: 120, consumption: 5, xpMult: 3, auto: true, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.05)', border: '#f59e0b', btnText: '#fff' },
};

// Suggerimenti Random
const HINTS = [
  "I vasi PLANT Smart consumano il 60% d'acqua in meno rispetto ai vasi normali.",
  "La Pianta Carnivora produce molti XP, ma è molto sensibile ai cambiamenti idrici.",
  "Se l'umidità scende sotto il minimo, la pianta avrà 'Sete!' per un giorno senza produrre XP.",
  "Ogni 3 secondi nel mondo reale corrispondono a un ciclo (Giorno) nel gioco.",
  "Attenzione ad annegare le piante! Un'umidità superiore al massimo sarà fatale istantaneamente.",
  "Puoi vendere i vasi vuoti cliccando sull'icona a cestino in alto a destra nel vaso.",
  "I vasi PLANT Pro Max triplicano gli XP e sono incredibilmente efficienti."
];

// Definizione Semi
const SEEDS = [
  { id: 'base', name: 'Seme Standard', desc: 'Resistente, ma produce poco.', cost: 20, minM: 0, maxM: 100, xp: 10, initM: 50, icon: Sprout, color: '#22c55e' },
  { id: 'cactus', name: 'Seme di Cactus', desc: 'Odia troppa acqua (< 60).', cost: 40, minM: 0, maxM: 60, xp: 15, initM: 30, icon: Trees, color: '#10b981' },
  { id: 'flower', name: 'Seme di Orchidea', desc: 'Molto delicato (> 30).', cost: 80, minM: 30, maxM: 100, xp: 25, initM: 50, icon: Flower2, color: '#ec4899' },
  { id: 'carnivorous', name: 'Pianta Carnivora', desc: 'Fragile e selettiva, XP alti.', cost: 150, minM: 20, maxM: 80, xp: 40, initM: 50, icon: Bug, color: '#a855f7' },
];

export default function PlantGame() {
  const router = useRouter();
  
  // Stato UI
  const [screen, setScreen] = useState('menu'); // 'menu', 'tutorial', 'play', 'gameover', 'shop'
  const [plantingPotId, setPlantingPotId] = useState(null); // per modal semi
  const [hintIdx, setHintIdx] = useState(0);

  // Animazioni effimere
  const [animDay, setAnimDay] = useState(false);
  const [animWaterPots, setAnimWaterPots] = useState({});
  const [animPlantPots, setAnimPlantPots] = useState({});

  // Stato Gioco
  const [day, setDay] = useState(1);
  const [water, setWater] = useState(100);
  const [xp, setXp] = useState(0);
  const [pots, setPots] = useState([
    { id: 1, type: 'normal', plant: null, moisture: 0, isDead: false, causeOfDeath: null, daysDehydrated: 0 }
  ]);
  
  // Powerups
  const [powerups, setPowerups] = useState({
    fertilizzante: false,
    tank: false
  });

  const timerRef = useRef(null);

  // LOOP DEI CONSIGLI RANDOM
  useEffect(() => {
    const int = setInterval(() => {
      setHintIdx(prev => (prev + 1) % HINTS.length);
    }, 8000);
    return () => clearInterval(int);
  }, []);

  // LOOP DI GIOCO
  useEffect(() => {
    if (screen === 'play' && !plantingPotId) {
      timerRef.current = setInterval(() => {
        tickDay();
      }, TICK_RATE_MS);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [screen, plantingPotId, pots, water, powerups]);

  const tickDay = () => {
    setDay(d => d + 1);
    
    // Trigger Animazione Giorno
    setAnimDay(true);
    setTimeout(() => setAnimDay(false), 500);
    
    let newPots = [...pots];
    let xpGained = 0;
    let waterConsumedAuto = 0;
    let anyDied = false;

    newPots = newPots.map(pot => {
      if (!pot.plant || pot.isDead) return pot; // ignora vasi vuoti o morti
      
      let newMoisture = pot.moisture;
      let newIsDead = false;
      let cause = null;

      // Consumo Vaso
      const potDef = POT_DEFS[pot.type] || POT_DEFS['normal'];
      if (!potDef.auto) {
        newMoisture -= potDef.consumption;
      } else {
        let waterNeeded = potDef.consumption;
        if (water - waterConsumedAuto >= waterNeeded) {
          waterConsumedAuto += waterNeeded;
        } else {
          newMoisture -= potDef.consumption;
        }
      }

      // Evita umidità negativa
      if (newMoisture < 0) newMoisture = 0;

      let newDaysDehydrated = pot.daysDehydrated || 0;
      let gaveXp = false;

      // Check Morte in base alla pianta
      if (newMoisture > pot.plant.maxM) {
        newIsDead = true;
        cause = `Annegata (Umidità oltre ${pot.plant.maxM}%)`;
      } else if (newMoisture < pot.plant.minM) {
        if (newDaysDehydrated === 0) {
          // Sopravvive 1 giorno senza dare XP
          newDaysDehydrated = 1;
        } else {
          newIsDead = true;
          cause = `Seccata (Umidità sotto la soglia per più di 1 giorno)`;
        }
      } else {
        newDaysDehydrated = 0;
        gaveXp = true;
      }

      if (newIsDead) {
        anyDied = true;
      } else if (gaveXp) {
        let baseXP = pot.plant.xp * potDef.xpMult;
        xpGained += (powerups.fertilizzante ? baseXP * 2 : baseXP);
      }

      return { ...pot, moisture: newMoisture, isDead: newIsDead, causeOfDeath: cause, daysDehydrated: newDaysDehydrated };
    });

    setPots(newPots);

    if (anyDied) {
      setScreen('gameover');
    } else {
      setWater(w => w + WATER_PER_DAY - waterConsumedAuto);
      setXp(x => x + xpGained);
    }
  };

  const selectSeed = (seed) => {
    if (water < seed.cost) return alert("Non hai abbastanza acqua per questo seme!");
    setWater(w => w - seed.cost);
    
    // Trigger Animazione Semina
    setAnimPlantPots(prev => ({...prev, [plantingPotId]: true}));
    setTimeout(() => {
      setAnimPlantPots(prev => ({...prev, [plantingPotId]: false}));
    }, 600);

    setPots(pots.map(p => p.id === plantingPotId ? { ...p, plant: seed, moisture: seed.initM, isDead: false } : p));
    setPlantingPotId(null);
  };

  const clickWater = (potId) => {
    if (water < WATER_MANUAL_COST) return; 
    const pot = pots.find(p => p.id === potId);
    if (!pot || !pot.plant || pot.isDead) return;

    setWater(w => w - WATER_MANUAL_COST);
    let updatedMoisture = pot.moisture + MOISTURE_MANUAL_ADD;
    
    // Animazione Goccia
    setAnimWaterPots(prev => ({...prev, [potId]: true}));
    setTimeout(() => {
      setAnimWaterPots(prev => ({...prev, [potId]: false}));
    }, 500);

    // Controlliamo istantaneamente annegamento
    let newIsDead = false;
    let cause = null;
    if (updatedMoisture > pot.plant.maxM) {
      newIsDead = true;
      cause = `Annegata (Umidità oltre ${pot.plant.maxM}%)`;
    }

    setPots(pots.map(p => p.id === potId ? { ...p, moisture: updatedMoisture, isDead: newIsDead, causeOfDeath: cause } : p));
    
    if (newIsDead) {
      setTimeout(() => setScreen('gameover'), 600);
    }
  };

  const buyPot = (type) => {
    const cost = POT_DEFS[type].cost;
    if (xp >= cost) {
      setXp(x => x - cost);
      setPots([...pots, { id: Date.now(), type, plant: null, moisture: 0, isDead: false, causeOfDeath: null, daysDehydrated: 0 }]);
    }
  };

  const sellPot = (potId) => {
    const pot = pots.find(p => p.id === potId);
    if (!pot) return;
    const value = POT_DEFS[pot.type].sell;
    setXp(x => x + value);
    setPots(pots.filter(p => p.id !== potId));
  };

  const buyPowerup = (powerup, cost) => {
    if (xp >= cost && !powerups[powerup]) {
      setXp(x => x - cost);
      setPowerups({ ...powerups, [powerup]: true });
      if (powerup === 'tank') {
        setWater(w => w + 500);
      }
    }
  };

  const resetGame = () => {
    setDay(1);
    setWater(100);
    setXp(0);
    setPots([{ id: 1, type: 'normal', plant: null, moisture: 0, isDead: false, causeOfDeath: null, daysDehydrated: 0 }]);
    setPowerups({ fertilizzante: false, tank: false });
    setScreen('play');
    setPlantingPotId(null);
  };

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-primary)', paddingTop: '100px' }}>
      {/* GLOBAL GAME ANIMATIONS */}
      <style>{`
        @keyframes bump {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); color: var(--accent-green); }
          100% { transform: scale(1); }
        }
        @keyframes dropPop {
          0% { transform: scale(1) translateY(0); opacity: 1; }
          50% { transform: scale(1.3) translateY(-10px); opacity: 0.8; color: #3b82f6; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes plantPop {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); }
        }
        .anim-bump { animation: bump 0.4s ease-out; }
        .anim-drop { animation: dropPop 0.4s ease-out; }
        .anim-plant { animation: plantPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .hint-fade { transition: opacity 0.5s ease-in-out; }
      `}</style>

      <div className="container" style={{ maxWidth: '900px', padding: '40px 20px', margin: '0 auto' }}>
        
        {/* TUTORIAL MODAL OVERLAY */}
        {plantingPotId && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--card-bg)', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '600px', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><Sprout color="var(--accent-green)" /> Negozio dei Semi</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Il tempo è in pausa. Scegli saggiamente cosa piantare!</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', maxHeight: '50vh', overflowY: 'auto', paddingRight: '5px' }}>
                {SEEDS.map(seed => {
                  const Icon = seed.icon;
                  return (
                    <div key={seed.id} style={{ background: 'var(--bg-alt)', padding: '15px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <Icon size={24} color={seed.color} />
                        <h4 style={{ margin: 0 }}>{seed.name}</h4>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>{seed.desc}</p>
                      
                      <div style={{ fontSize: '0.8rem', background: 'var(--card-bg)', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Target Idrico:</span> <strong>{seed.minM}% - {seed.maxM}%</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ricavo per Giorno:</span> <strong>{seed.xp} XP</strong></div>
                      </div>

                      <button 
                        onClick={() => selectSeed(seed)}
                        disabled={water < seed.cost}
                        style={{ width: '100%', padding: '10px', background: water >= seed.cost ? 'var(--accent-green)' : 'var(--bg-alt)', color: water >= seed.cost ? '#fff' : 'var(--text-secondary)', border: water >= seed.cost ? 'none' : '1px solid var(--border-color)', borderRadius: '10px', cursor: water >= seed.cost ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}
                      >
                        Pianta ({seed.cost} 💧)
                      </button>
                    </div>
                  );
                })}
              </div>
              
              <button onClick={() => setPlantingPotId(null)} style={{ marginTop: '20px', width: '100%', padding: '12px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>
                Annulla
              </button>
            </div>
          </div>
        )}

        {/* MENU SCREEN */}
        {screen === 'menu' && (
          <FadeIn>
            <div style={{ textAlign: 'center', marginTop: '5vh' }}>
              <div style={{ background: 'var(--accent-green-light)', width: '120px', height: '120px', borderRadius: '30px', margin: '0 auto 30px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.05)' }}>
                <Sprout size={70} color="var(--accent-green)" />
              </div>
              <h1 style={{ fontSize: '4rem', marginBottom: '10px', color: 'var(--text-primary)' }}>Plant.GAME</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '60px' }}>Sopravvivenza botanica. Gestisci l'acqua, scegli i vasi.</p>
              
              <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                <button onClick={() => setScreen('play')} className="btn btn-primary" style={{ fontSize: '1.1rem', padding: '18px 40px' }}>
                  <Play size={24} /> Gioca
                </button>
                <button onClick={() => setScreen('tutorial')} className="btn btn-secondary" style={{ fontSize: '1.1rem', padding: '18px 40px' }}>
                  <Info size={24} /> Tutorial
                </button>
              </div>
            </div>
          </FadeIn>
        )}

        {/* TUTORIAL SCREEN */}
        {screen === 'tutorial' && (
          <FadeIn>
            <div style={{ background: 'var(--card-bg)', padding: '50px', borderRadius: '30px', border: '1px solid var(--border-color)', boxShadow: '0 20px 60px rgba(0,0,0,0.03)' }}>
              <h2 style={{ fontSize: '2.5rem', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '15px', color: 'var(--text-primary)' }}>
                <Search size={36} color="var(--accent-green)" /> Come Giocare
              </h2>
              <div style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: '1.8', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <p>Plant.GAME è un simulatore di sopravvivenza. Hai a disposizione vasi, acqua e un negozio di semi.</p>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '20px', background: 'var(--bg-alt)', borderRadius: '16px' }}>
                  <Droplets color="#3b82f6" size={30} />
                  <div><strong>Ciclo del Giorno (3 sec):</strong> Ricevi +100 Acqua. Le piante la consumano e ti donano XP.</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '20px', background: 'var(--bg-alt)', borderRadius: '16px' }}>
                  <AlertTriangle color="#ef4444" size={30} />
                  <div><strong>Morte:</strong> Se una pianta scende sotto la sua Umidità Minima o supera la Massima, muore, ed è GAME OVER!</div>
                </div>

                <h3 style={{ margin: '20px 0 10px 0', color: 'var(--text-primary)' }}>I Vasi</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div style={{ padding: '20px', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
                    <h4 style={{ color: 'var(--text-primary)', marginBottom: '10px' }}>Vaso Normale</h4>
                    <p style={{ fontSize: '0.9rem', margin: 0 }}>Consuma 50 umidità al giorno. Va innaffiato a mano con il pulsante Irriga (costa 20 acqua).</p>
                  </div>
                  <div style={{ padding: '20px', border: '1px solid var(--border-color)', borderRadius: '16px', background: 'var(--accent-green-light)' }}>
                    <h4 style={{ color: 'var(--accent-green)', marginBottom: '10px' }}>Vaso PLANT Smart</h4>
                    <p style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-primary)' }}>Consuma 20 umidità al giorno, si innaffia in automatico attingendo alle tue scorte idriche globali in modo efficiente.</p>
                  </div>
                </div>
              </div>
              <button onClick={() => setScreen('menu')} className="btn btn-primary" style={{ marginTop: '40px', width: '100%', padding: '18px', fontSize: '1.2rem' }}>
                Tutto chiaro, Iniziamo!
              </button>
            </div>
          </FadeIn>
        )}

        {/* GAME OVER SCREEN */}
        {screen === 'gameover' && (
          <FadeIn>
            <div style={{ textAlign: 'center', marginTop: '5vh' }}>
              <div style={{ background: '#fee2e2', width: '120px', height: '120px', borderRadius: '50%', margin: '0 auto 30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ghost size={60} color="#ef4444" />
              </div>
              <h1 style={{ fontSize: '3.5rem', marginBottom: '10px', color: '#ef4444' }}>La natura fa il suo corso</h1>
              <p style={{ color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '10px', fontWeight: 'bold' }}>
                Sei sopravvissuto per {day} giorni.
              </p>
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '16px', display: 'inline-block', marginBottom: '40px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', margin: 0 }}>
                  <AlertTriangle size={18} color="#ef4444" style={{ verticalAlign: 'middle', marginRight: '8px' }}/>
                  {pots.find(p => p.isDead)?.causeOfDeath || "Le piante non ce l'hanno fatta."}
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                <button onClick={resetGame} className="btn btn-primary" style={{ padding: '18px 40px', fontSize: '1.2rem' }}>
                  Gioca ancora
                </button>
                <button onClick={() => router.push('/prodotti')} className="btn btn-secondary" style={{ padding: '18px 40px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShoppingCart size={24} /> Visualizza prodotti
                </button>
              </div>
            </div>
          </FadeIn>
        )}

        {/* SHOP SCREEN */}
        {screen === 'shop' && (
          <FadeIn>
             <div style={{ background: 'var(--card-bg)', padding: '50px', borderRadius: '30px', border: '1px solid var(--border-color)', boxShadow: '0 20px 60px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <h2 style={{ fontSize: '2.5rem', display: 'flex', alignItems: 'center', gap: '15px', margin: 0, color: 'var(--text-primary)' }}>
                  <ShoppingCart size={36} color="var(--accent-green)" /> Negozio
                </h2>
                <div style={{ background: 'var(--bg-alt)', padding: '12px 24px', borderRadius: '50px', display: 'flex', gap: '10px', alignItems: 'center', border: '1px solid var(--border-color)' }}>
                  <Star size={24} color="#f59e0b" /> <span style={{ fontWeight: 'bold', fontSize: '1.3rem', color: 'var(--text-primary)' }}>{xp} XP</span>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '25px' }}>
                {Object.keys(POT_DEFS).map(potType => {
                  const def = POT_DEFS[potType];
                  return (
                    <div key={potType} style={{ background: def.bg, padding: '25px', borderRadius: '20px', border: `1px solid ${def.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <h3 style={{ margin: '0 0 10px 0', color: def.color, fontSize: '1.3rem' }}>{def.name}</h3>
                        <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '10px' }}>
                          {def.auto ? `Irrigazione automatica (-${def.consumption}💧).` : `Irrigazione manuale (-${def.consumption}💧).`}
                        </p>
                        <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '20px', fontWeight: 'bold' }}>
                          XP Moltiplicatore: {def.xpMult}x
                        </p>
                      </div>
                      <button 
                        onClick={() => buyPot(potType)}
                        disabled={xp < def.cost}
                        style={{ width: '100%', padding: '14px', background: xp >= def.cost ? def.color : 'var(--border-color)', color: xp >= def.cost ? def.btnText : 'var(--text-secondary)', border: 'none', borderRadius: '12px', cursor: xp >= def.cost ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
                        Acquista: {def.cost} XP
                      </button>
                    </div>
                  );
                })}

                {/* Powerup 1 */}
                <div style={{ background: 'var(--bg-alt)', padding: '25px', borderRadius: '20px', border: '1px solid #f59e0b', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#f59e0b', fontSize: '1.3rem' }}>Concime Premium</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '20px' }}>Ottieni XP raddoppiati per le piante vive ogni giorno.</p>
                  </div>
                  <button 
                    onClick={() => buyPowerup('fertilizzante', 150)}
                    disabled={xp < 150 || powerups.fertilizzante}
                    style={{ width: '100%', padding: '14px', background: powerups.fertilizzante ? '#fde68a' : (xp >= 150 ? '#f59e0b' : 'var(--border-color)'), color: powerups.fertilizzante ? '#b45309' : (xp >= 150 ? '#fff' : 'var(--text-secondary)'), border: 'none', borderRadius: '12px', cursor: (xp >= 150 && !powerups.fertilizzante) ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
                    {powerups.fertilizzante ? 'Gia Acquistato' : 'Compra (150 XP)'}
                  </button>
                </div>

                {/* Powerup 2 */}
                <div style={{ background: 'var(--bg-alt)', padding: '25px', borderRadius: '20px', border: '1px solid #3b82f6', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#3b82f6', fontSize: '1.3rem' }}>Tanica X-Large</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '20px' }}>Aggiunge immediatamente 500 Acqua al tuo serbatoio globale.</p>
                  </div>
                  <button 
                    onClick={() => buyPowerup('tank', 100)}
                    disabled={xp < 100 || powerups.tank}
                    style={{ width: '100%', padding: '14px', background: powerups.tank ? '#bfdbfe' : (xp >= 100 ? '#3b82f6' : 'var(--border-color)'), color: powerups.tank ? '#1d4ed8' : (xp >= 100 ? '#fff' : 'var(--text-secondary)'), border: 'none', borderRadius: '12px', cursor: (xp >= 100 && !powerups.tank) ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
                    {powerups.tank ? 'Gia Acquistato' : 'Compra (100 XP)'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px', marginTop: '40px' }}>
                {pots.find(p=>p.isDead) ? (
                  <button onClick={resetGame} className="btn btn-primary" style={{ padding: '18px 40px', fontSize: '1.1rem' }}>
                    Nuova Partita
                  </button>
                ) : (
                  <button onClick={() => setScreen('play')} className="btn btn-secondary" style={{ padding: '18px 40px', fontSize: '1.1rem' }}>
                    Ritorna al Gioco
                  </button>
                )}
              </div>
            </div>
          </FadeIn>
        )}

        {/* PLAY SCREEN */}
        {screen === 'play' && (
          <FadeIn>
            {/* HUD */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '40px', flexWrap: 'wrap' }}>
              <div style={{ background: 'var(--card-bg)', flex: 1, padding: '24px', borderRadius: '24px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                <div style={{ background: 'var(--bg-alt)', padding: '15px', borderRadius: '16px' }} className={animDay ? "anim-bump" : ""}><Calendar size={32} color="var(--text-secondary)" /></div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500, marginBottom: '4px' }}>Giorno</div>
                  <div className={animDay ? "anim-bump" : ""} style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1, display: 'inline-block' }}>{day}</div>
                </div>
              </div>

              <div style={{ background: 'var(--card-bg)', flex: 1, padding: '24px', borderRadius: '24px', border: '1px solid rgba(59, 130, 246, 0.3)', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '15px', borderRadius: '16px' }}><Droplets size={32} color="#3b82f6" /></div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500, marginBottom: '4px' }}>Acqua Globale</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#3b82f6', lineHeight: 1 }}>{water}</div>
                </div>
              </div>

              <div style={{ background: 'var(--card-bg)', flex: 1, padding: '24px', borderRadius: '24px', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '15px', borderRadius: '16px' }}><Star size={32} color="#f59e0b" /></div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500, marginBottom: '4px' }}>Esperienza</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#f59e0b', lineHeight: 1 }}>{xp}</div>
                </div>
              </div>

              <button 
                onClick={() => setScreen('shop')}
                className="hover-lift"
                style={{ background: 'var(--accent-green)', flex: 0.5, padding: '24px', borderRadius: '24px', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
                <ShoppingCart size={32} />
                <span style={{ fontWeight: 'bold', marginTop: '10px', fontSize: '1.1rem' }}>Negozio</span>
              </button>
            </div>

            {/* ERROR MESSAGES / INFO */}
            <div key={hintIdx} className="hint-fade" style={{ marginBottom: '40px', padding: '20px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid var(--accent-green)', borderRadius: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '15px', fontWeight: 500, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
              <div className="anim-bump"><Info size={24} color="var(--accent-green)" /></div> 
              {HINTS[hintIdx]}
            </div>

            {/* POTS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '30px' }}>
              {pots.map((pot) => {
                const def = POT_DEFS[pot.type] || POT_DEFS['normal'];
                return (
                <div key={pot.id} style={{ 
                  background: def.bg, 
                  border: `2px solid ${def.border}`, 
                  borderRadius: '30px', 
                  padding: '30px 20px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.03)'
                }}>
                  {/* Badge Tipo e Vendita */}
                  <div style={{ position: 'absolute', top: '15px', left: '15px', fontSize: '0.75rem', background: def.border, color: def.btnText, padding: '5px 12px', borderRadius: '20px', fontWeight: 'bold' }}>
                    {def.name}
                  </div>

                  <button 
                    onClick={() => sellPot(pot.id)}
                    style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', zIndex: 10 }}
                    title={`Vendi/Elimina Vaso (+${def.sell} XP)`}
                  >
                    <Trash2 size={20} />
                  </button>

                  {/* Icona Pianta o Vuoto */}
                  <div style={{ height: '140px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '20px', marginTop: '10px' }}>
                    {!pot.plant ? (
                      <div style={{ border: '3px dashed var(--border-color)', borderRadius: '50%', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-alt)' }}>
                        <Plus size={30} color="var(--text-secondary)" />
                      </div>
                    ) : pot.isDead ? (
                       <Ghost size={80} color="#ef4444" style={{ marginBottom: '10px' }} />
                    ) : (
                      <div className={animPlantPots[pot.id] ? "anim-plant" : ""} style={{ position: 'relative' }}>
                        {(() => {
                          const Icon = pot.plant.icon;
                          const danger = pot.moisture < pot.plant.minM + 15 || pot.moisture > pot.plant.maxM - 15;
                          return (
                            <Icon size={90} color={danger ? '#ef4444' : pot.plant.color} style={{ transform: `scale(${0.8 + (Math.min(xp, 1000)/2000)})`, transition: 'color 1s, transform 1s' }} />
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Actions / Info */}
                  {!pot.plant ? (
                    <button 
                      onClick={() => setPlantingPotId(pot.id)}
                      style={{ width: '100%', padding: '14px', background: 'var(--text-primary)', color: 'var(--bg-color)', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.05rem' }}>
                      <Sprout size={18} style={{ verticalAlign: 'middle', marginRight: '5px' }} /> Pianta Seme
                    </button>
                  ) : pot.isDead ? (
                    <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.95rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '10px', borderRadius: '12px', width: '100%' }}>
                      MORTA<br/><span style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>{pot.causeOfDeath}</span>
                    </div>
                  ) : (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: pot.plant.color }}>{pot.plant.name}</div>
                      
                      {/* Range Visualizer (Umida min, attuale, max) */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: 500 }}>
                          <span>Min {pot.plant.minM}%</span>
                          <span>Max {pot.plant.maxM}%</span>
                        </div>
                        <div style={{ background: 'var(--border-color)', height: '14px', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                          <div style={{ 
                            height: '100%', 
                            width: `${Math.min(100, Math.max(0, pot.moisture))}%`, 
                            background: (pot.moisture < pot.plant.minM + 15 || pot.moisture > pot.plant.maxM - 15) ? '#ef4444' : '#3b82f6',
                            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s'
                          }}/>
                        </div>
                        <div style={{ textAlign: 'center', fontSize: '1rem', fontWeight: 'bold', marginTop: '5px', color: 'var(--text-primary)' }}>
                          {pot.moisture}% {pot.daysDehydrated > 0 && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>(Sete!)</span>}
                        </div>
                      </div>
                      
                      {!def.auto ? (
                        <button 
                          onClick={() => clickWater(pot.id)}
                          style={{ width: '100%', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600 }}>
                          <Droplets size={18} className={animWaterPots[pot.id] ? "anim-drop" : ""} /> Irriga (-{WATER_MANUAL_COST}💧)
                        </button>
                      ) : (
                        <div style={{ width: '100%', padding: '12px', background: 'var(--bg-alt)', color: def.color, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 600, border: `1px solid ${def.border}` }}>
                          <CheckCircle2 size={18} className={animWaterPots[pot.id] ? "anim-drop" : ""} /> Auto-Irrigato
                        </div>
                      )}
                    </div>
                  )}

                </div>
                );
              })}

              <div 
                onClick={() => setScreen('shop')}
                className="hover-lift"
                style={{
                  border: '3px dashed var(--border-color)',
                  borderRadius: '30px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  minHeight: '350px',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-alt)',
                }}
              >
                <Plus size={60} style={{ marginBottom: '10px' }} />
                <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>Nuovo Vaso</span>
              </div>
            </div>
            
          </FadeIn>
        )}

      </div>
    </main>
  );
}
