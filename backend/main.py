"""
FastAPI backend - WebSocket server broadcasting DOM + Tape data.
"""
import asyncio
import json
import os
from contextlib import asynccontextmanager
from typing import Set

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from dom_manager import DOMManager
from tape_manager import TapeManager

load_dotenv()

SIM_MODE = os.getenv("SIM_MODE", "true").lower() == "true"
INSTRUMENT = os.getenv("INSTRUMENT", "NQM5")
BIG_THRESHOLD = int(os.getenv("BIG_TRADE_NQ", "10"))

dom = DOMManager(levels=10)
tape = TapeManager(max_trades=200, big_threshold=BIG_THRESHOLD)
clients: Set[WebSocket] = set()
engine = None


async def broadcast(data: dict):
    if not clients:
        return
    msg = json.dumps(data)
    dead = set()
    for ws in clients:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.add(ws)
    clients.difference_update(dead)


async def on_dom_update(snapshot: dict):
    await broadcast(snapshot)


async def on_tape_update(snapshot: dict):
    await broadcast(snapshot)


async def start_data_feed():
    global engine
    if SIM_MODE:
        from sim_engine import SimEngine
        engine = SimEngine(dom, tape)
        print(f"SIM MODE - generating fake {INSTRUMENT} data")
        await engine.start(on_dom_update, on_tape_update)
    else:
        from rithmic_client import RithmicDataClient
        engine = RithmicDataClient()
        await engine.connect()
        print(f"LIVE MODE - streaming {INSTRUMENT} from Rithmic")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(start_data_feed())
    yield
    if engine:
        if hasattr(engine, "stop"):
            await engine.stop()
        elif hasattr(engine, "disconnect"):
            await engine.disconnect()
    task.cancel()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/config")
async def get_config():
    return {
        "instrument": INSTRUMENT,
        "big_threshold": tape.big_threshold,
        "sim_mode": SIM_MODE,
        "connected_clients": len(clients),
    }


@app.post("/config")
async def update_config(data: dict):
    global INSTRUMENT
    if "instrument" in data:
        INSTRUMENT = data["instrument"]
    if "big_threshold" in data:
        tape.big_threshold = int(data["big_threshold"])
    return {"ok": True, "instrument": INSTRUMENT, "big_threshold": tape.big_threshold}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    print(f"+ Client connected ({len(clients)} total)")

    try:
        snap = dom.snapshot()
        if snap["bids"] or snap["asks"]:
            await ws.send_text(json.dumps(snap))
        recent = tape.recent_trades(50)
        if recent:
            await ws.send_text(json.dumps({
                "type": "tape", "trades": recent, "cvd": tape.cvd,
            }))
    except Exception:
        pass

    try:
        while True:
            msg = await ws.receive_text()
            try:
                cmd = json.loads(msg)
                if cmd.get("action") == "reset_cvd":
                    tape.reset_cvd()
                    await broadcast({"type": "tape", "trades": [], "cvd": 0})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        clients.discard(ws)
        print(f"- Client disconnected ({len(clients)} total)")