"""
Tape Manager - maintains rolling buffer of last trades + CVD.
"""
import time
from collections import deque
from dataclasses import dataclass
from typing import Optional


@dataclass
class Trade:
    timestamp: str
    price: float
    size: int
    side: str
    is_big: bool

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "price": self.price,
            "size": self.size,
            "side": self.side,
            "is_big": self.is_big,
        }


class TapeManager:
    def __init__(self, max_trades: int = 200, big_threshold: int = 10):
        self.max_trades = max_trades
        self.big_threshold = big_threshold
        self.trades: deque = deque(maxlen=max_trades)
        self.cvd: int = 0

    def add_trade(self, price: float, size: int, side: Optional[str] = None, mid_price: float = 0.0) -> Trade:
        if side is None:
            if mid_price > 0:
                side = "buy" if price >= mid_price else "sell"
            else:
                side = "buy"

        is_big = size >= self.big_threshold
        now = time.localtime()
        ms = int((time.time() % 1) * 1000)
        ts = f"{now.tm_hour:02d}:{now.tm_min:02d}:{now.tm_sec:02d}.{ms:03d}"

        trade = Trade(timestamp=ts, price=round(price, 2), size=size, side=side, is_big=is_big)
        self.trades.append(trade)
        self.cvd += size if side == "buy" else -size
        return trade

    def reset_cvd(self):
        self.cvd = 0

    def recent_trades(self, n: int = 50) -> list:
        return [t.to_dict() for t in list(self.trades)[-n:]]

    def snapshot(self, last_n: int = 1) -> dict:
        trades = list(self.trades)[-last_n:]
        return {
            "type": "tape",
            "trades": [t.to_dict() for t in trades],
            "cvd": self.cvd,
        }