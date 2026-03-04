# Rithmic DOM + Tape Viewer

Real-time DOM (order book) and Tape (Time & Sales) viewer for NQ/ES futures via Rithmic.

## Architecture
```
Rithmic (WebSocket) -> Backend Python (localhost:8000) -> Frontend React (Vercel or localhost:5173)
```

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Config
- SIM_MODE=true in .env -> simulated data (no Rithmic needed)
- SIM_MODE=false -> live Rithmic connection
- VITE_WS_URL in frontend .env -> WebSocket URL