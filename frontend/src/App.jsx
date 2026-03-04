import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── CONFIG ───────────────────────────────────────────────────
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";
const RECONNECT_DELAY = 2000;
const DOM_LEVELS = 10;
const TAPE_MAX = 200;
const BIG_TRADE_THRESHOLD = 10;
const TICK_SIZE = 0.25;

// ─── SIMULATED DATA ENGINE ───────────────────────────────────
function createSimEngine() {
  let midPrice = 21345.50;
  let cvd = 0;
  let tradeId = 0;

  function generateDOM() {
    const bids = [];
    const asks = [];
    const spread = TICK_SIZE * (Math.random() > 0.7 ? 2 : 1);
    
    for (let i = 0; i < DOM_LEVELS; i++) {
      const bidPrice = midPrice - spread/2 - (i * TICK_SIZE);
      const askPrice = midPrice + spread/2 + (i * TICK_SIZE);
      const bidSize = Math.floor(Math.random() * 150) + 10;
      const askSize = Math.floor(Math.random() * 150) + 10;
      
      bids.push({ price: bidPrice, size: bidSize, total: 0 });
      asks.push({ price: askPrice, size: askSize, total: 0 });
    }
    
    // Cumulative totals
    let bidTotal = 0, askTotal = 0;
    for (let i = 0; i < DOM_LEVELS; i++) {
      bidTotal += bids[i].size;
      askTotal += asks[i].size;
      bids[i].total = bidTotal;
      asks[i].total = askTotal;
    }
    
    return { bids, asks, midPrice, spread };
  }

  function generateTrade() {
    const isBuy = Math.random() > 0.48;
    const size = Math.random() > 0.92 
      ? Math.floor(Math.random() * 50) + 20 
      : Math.floor(Math.random() * 15) + 1;
    
    // Price movement
    const delta = (Math.random() - 0.48) * TICK_SIZE * 2;
    midPrice = Math.round((midPrice + delta) / TICK_SIZE) * TICK_SIZE;
    
    // CVD update
    cvd += isBuy ? size : -size;
    
    tradeId++;
    
    return {
      id: tradeId,
      time: new Date().toLocaleTimeString('fr-FR', { hour12: false }),
      price: midPrice + (isBuy ? TICK_SIZE/2 : -TICK_SIZE/2),
      size,
      side: isBuy ? 'buy' : 'sell',
      cvd
    };
  }

  function tick() {
    midPrice += (Math.random() - 0.5) * TICK_SIZE * 0.5;
    midPrice = Math.round(midPrice / TICK_SIZE) * TICK_SIZE;
  }

  return { generateDOM, generateTrade, tick, getCVD: () => cvd, resetCVD: () => { cvd = 0; } };
}

// ─── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  const [connected, setConnected] = useState(false);
  const [simMode, setSimMode] = useState(true);
  const [instrument, setInstrument] = useState("NQM5");
  const [bigThreshold, setBigThreshold] = useState(BIG_TRADE_THRESHOLD);
  
  const [dom, setDom] = useState({ bids: [], asks: [], midPrice: 0, spread: 0 });
  const [tape, setTape] = useState([]);
  const [cvd, setCvd] = useState(0);
  
  const wsRef = useRef(null);
  const simEngineRef = useRef(null);
  const simIntervalRef = useRef(null);

  // ─── WebSocket Connection ───────────────────────────────────
  const connectWS = useCallback(() => {
    if (simMode) return;
    
    try {
      wsRef.current = new WebSocket(WS_URL);
      
      wsRef.current.onopen = () => {
        setConnected(true);
        setSimMode(false);
        wsRef.current.send(JSON.stringify({ type: 'subscribe', instrument }));
      };
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'dom') {
          setDom(data.payload);
        } else if (data.type === 'tape') {
          setTape(prev => [data.payload, ...prev].slice(0, TAPE_MAX));
          setCvd(data.payload.cvd);
        }
      };
      
      wsRef.current.onclose = () => {
        setConnected(false);
        setTimeout(connectWS, RECONNECT_DELAY);
      };
      
      wsRef.current.onerror = () => {
        setConnected(false);
        setSimMode(true);
      };
    } catch (e) {
      setSimMode(true);
    }
  }, [instrument, simMode]);

  // ─── Simulation Mode ────────────────────────────────────────
  useEffect(() => {
    if (!simMode) return;
    
    simEngineRef.current = createSimEngine();
    
    // Initial DOM
    setDom(simEngineRef.current.generateDOM());
    
    // Simulation loop
    simIntervalRef.current = setInterval(() => {
      // Update DOM every 100ms
      simEngineRef.current.tick();
      setDom(simEngineRef.current.generateDOM());
      
      // Random trades
      if (Math.random() > 0.6) {
        const trade = simEngineRef.current.generateTrade();
        setTape(prev => [trade, ...prev].slice(0, TAPE_MAX));
        setCvd(trade.cvd);
      }
    }, 100);
    
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, [simMode]);

  // ─── Try WebSocket on mount ─────────────────────────────────
  useEffect(() => {
    connectWS();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // ─── Reset CVD ──────────────────────────────────────────────
  const resetCVD = () => {
    setCvd(0);
    if (simEngineRef.current) simEngineRef.current.resetCVD();
  };

  // ─── Max sizes for bar scaling ──────────────────────────────
  const maxBidSize = useMemo(() => Math.max(...dom.bids.map(b => b.size), 1), [dom.bids]);
  const maxAskSize = useMemo(() => Math.max(...dom.asks.map(a => a.size), 1), [dom.asks]);

  return (
    <div style={styles.container}>
      {/* ─── HEADER ─────────────────────────────────────────── */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <select 
            value={instrument} 
            onChange={(e) => setInstrument(e.target.value)}
            style={styles.select}
          >
            <option value="NQM5">NQM5</option>
            <option value="NQU5">NQU5</option>
            <option value="ESM5">ESM5</option>
            <option value="ESU5">ESU5</option>
          </select>
          
          <div style={styles.thresholdBox}>
            <span style={styles.thresholdLabel}>Big:</span>
            <input
              type="number"
              value={bigThreshold}
              onChange={(e) => setBigThreshold(Number(e.target.value))}
              style={styles.thresholdInput}
              min={1}
              max={100}
            />
          </div>
        </div>
        
        <div style={styles.headerRight}>
          <button onClick={resetCVD} style={styles.resetBtn}>Reset CVD</button>
          <div style={{
            ...styles.statusDot,
            background: connected ? '#00ff88' : (simMode ? '#ffaa00' : '#ff4444')
          }} />
          <span style={styles.statusText}>
            {connected ? 'LIVE' : (simMode ? 'SIM' : 'OFFLINE')}
          </span>
        </div>
      </header>

      {/* ─── MAIN CONTENT ───────────────────────────────────── */}
      <div style={styles.main}>
        {/* ─── DOM ──────────────────────────────────────────── */}
        <div style={styles.domPanel}>
          <div style={styles.panelHeader}>
            <span>DOM</span>
            <span style={styles.midPrice}>{dom.midPrice?.toFixed(2)}</span>
          </div>
          
          <div style={styles.domHeader}>
            <span>Bid Vol</span>
            <span>Bid</span>
            <span>Price</span>
            <span>Ask</span>
            <span>Ask Vol</span>
          </div>
          
          <div style={styles.domBody}>
            {/* Asks (reversed so highest at top) */}
            {[...dom.asks].reverse().map((ask, i) => (
              <div key={`ask-${i}`} style={styles.domRow}>
                <span style={styles.domCell}></span>
                <span style={styles.domCell}></span>
                <span style={{...styles.domCell, ...styles.priceCell, color: '#ff6b6b'}}>
                  {ask.price.toFixed(2)}
                </span>
                <span style={styles.domCell}>
                  <div style={styles.sizeBarContainer}>
                    <div style={{
                      ...styles.sizeBar,
                      ...styles.askBar,
                      width: `${(ask.size / maxAskSize) * 100}%`
                    }} />
                    <span style={styles.sizeText}>{ask.size}</span>
                  </div>
                </span>
                <span style={{...styles.domCell, color: '#888'}}>{ask.total}</span>
              </div>
            ))}
            
            {/* Spread line */}
            <div style={styles.spreadLine}>
              <span>Spread: {dom.spread?.toFixed(2)}</span>
            </div>
            
            {/* Bids */}
            {dom.bids.map((bid, i) => (
              <div key={`bid-${i}`} style={styles.domRow}>
                <span style={{...styles.domCell, color: '#888'}}>{bid.total}</span>
                <span style={styles.domCell}>
                  <div style={styles.sizeBarContainer}>
                    <div style={{
                      ...styles.sizeBar,
                      ...styles.bidBar,
                      width: `${(bid.size / maxBidSize) * 100}%`
                    }} />
                    <span style={styles.sizeText}>{bid.size}</span>
                  </div>
                </span>
                <span style={{...styles.domCell, ...styles.priceCell, color: '#4ecdc4'}}>
                  {bid.price.toFixed(2)}
                </span>
                <span style={styles.domCell}></span>
                <span style={styles.domCell}></span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── TAPE ─────────────────────────────────────────── */}
        <div style={styles.tapePanel}>
          <div style={styles.panelHeader}>
            <span>TAPE</span>
            <span style={{
              ...styles.cvdValue,
              color: cvd >= 0 ? '#4ecdc4' : '#ff6b6b'
            }}>
              CVD: {cvd >= 0 ? '+' : ''}{cvd}
            </span>
          </div>
          
          <div style={styles.tapeHeader}>
            <span>Time</span>
            <span>Price</span>
            <span>Size</span>
          </div>
          
          <div style={styles.tapeBody}>
            {tape.map((t) => {
              const isBig = t.size >= bigThreshold;
              const isBuy = t.side === 'buy';
              return (
                <div
                  key={t.id}
                  style={{
                    ...styles.tapeRow,
                    background: isBig 
                      ? (isBuy ? 'rgba(78, 205, 196, 0.15)' : 'rgba(255, 107, 107, 0.15)')
                      : 'transparent',
                    animation: isBig ? 'pulse 0.3s ease-out' : 'none'
                  }}
                >
                  <span style={styles.tapeTime}>{t.time}</span>
                  <span style={{
                    ...styles.tapePrice,
                    color: isBuy ? '#4ecdc4' : '#ff6b6b'
                  }}>
                    {t.price.toFixed(2)}
                  </span>
                  <span style={{
                    ...styles.tapeSize,
                    color: isBuy ? '#4ecdc4' : '#ff6b6b',
                    fontWeight: isBig ? '700' : '400'
                  }}>
                    {t.size}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#0a0a0a',
    color: '#e0e0e0',
    fontFamily: "'JetBrains Mono', monospace",
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    background: '#111',
    borderBottom: '1px solid #222',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  select: {
    background: '#1a1a1a',
    border: '1px solid #333',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  thresholdBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  thresholdLabel: {
    color: '#888',
    fontSize: '12px',
  },
  thresholdInput: {
    background: '#1a1a1a',
    border: '1px solid #333',
    color: '#fff',
    padding: '6px 10px',
    borderRadius: '4px',
    width: '50px',
    fontSize: '12px',
  },
  resetBtn: {
    background: '#222',
    border: '1px solid #333',
    color: '#888',
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.5px',
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  domPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #222',
  },
  tapePanel: {
    width: '320px',
    display: 'flex',
    flexDirection: 'column',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    background: '#111',
    borderBottom: '1px solid #222',
    fontSize: '12px',
    fontWeight: '600',
    color: '#888',
    letterSpacing: '1px',
  },
  midPrice: {
    color: '#fff',
    fontSize: '14px',
  },
  cvdValue: {
    fontSize: '13px',
    fontWeight: '700',
  },
  domHeader: {
    display: 'grid',
    gridTemplateColumns: '80px 100px 100px 100px 80px',
    padding: '8px 16px',
    background: '#0d0d0d',
    borderBottom: '1px solid #1a1a1a',
    fontSize: '10px',
    color: '#555',
    textAlign: 'center',
  },
  domBody: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 16px',
  },
  domRow: {
    display: 'grid',
    gridTemplateColumns: '80px 100px 100px 100px 80px',
    padding: '3px 0',
    fontSize: '12px',
    alignItems: 'center',
  },
  domCell: {
    textAlign: 'center',
  },
  priceCell: {
    fontWeight: '600',
  },
  sizeBarContainer: {
    position: 'relative',
    height: '18px',
    display: 'flex',
    alignItems: 'center',
  },
  sizeBar: {
    position: 'absolute',
    height: '100%',
    borderRadius: '2px',
    opacity: 0.4,
  },
  bidBar: {
    background: 'linear-gradient(90deg, transparent, #4ecdc4)',
    right: 0,
  },
  askBar: {
    background: 'linear-gradient(270deg, transparent, #ff6b6b)',
    left: 0,
  },
  sizeText: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    textAlign: 'center',
  },
  spreadLine: {
    padding: '6px 0',
    textAlign: 'center',
    fontSize: '10px',
    color: '#555',
    borderTop: '1px dashed #222',
    borderBottom: '1px dashed #222',
    margin: '4px 0',
  },
  tapeHeader: {
    display: 'grid',
    gridTemplateColumns: '80px 1fr 60px',
    padding: '8px 12px',
    background: '#0d0d0d',
    borderBottom: '1px solid #1a1a1a',
    fontSize: '10px',
    color: '#555',
  },
  tapeBody: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 0',
  },
  tapeRow: {
    display: 'grid',
    gridTemplateColumns: '80px 1fr 60px',
    padding: '4px 12px',
    fontSize: '12px',
    transition: 'background 0.1s',
  },
  tapeTime: {
    color: '#555',
  },
  tapePrice: {
    fontWeight: '500',
  },
  tapeSize: {
    textAlign: 'right',
  },
};