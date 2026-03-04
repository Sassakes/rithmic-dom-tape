"""
Rithmic client - connects via pyrithmic. Not used in SIM_MODE.
"""
import os
from typing import Callable
from dotenv import load_dotenv

load_dotenv()

try:
    from pyrithmic import RithmicClient
    PYRITHMIC_AVAILABLE = True
except ImportError:
    PYRITHMIC_AVAILABLE = False


class RithmicDataClient:
    def __init__(self):
        self.user = os.getenv("RITHMIC_USER", "")
        self.password = os.getenv("RITHMIC_PASSWORD", "")
        self.server = os.getenv("RITHMIC_SERVER", "Lucid Trading")
        self.instrument = os.getenv("INSTRUMENT", "NQM5")
        self.exchange = os.getenv("EXCHANGE", "CME")
        self.client = None
        self.running = False

    async def connect(self):
        if not PYRITHMIC_AVAILABLE:
            raise RuntimeError("pyrithmic not installed")
        # TODO: configure for Lucid Trading environment
        self.running = True

    async def subscribe_depth(self, on_bid: Callable, on_ask: Callable):
        # TODO: implement with pyrithmic
        pass

    async def subscribe_trades(self, on_trade: Callable):
        # TODO: implement with pyrithmic
        pass

    async def disconnect(self):
        self.running = False