"""
DOM Manager - maintains order book state from Rithmic depth updates.
"""
import time
from dataclasses import dataclass
from typing import Dict


@dataclass
class DOMLevel:
    price: float
    bid_size: int = 0
    ask_size: int = 0


class DOMManager:
    def __init__(self, levels: int = 10):
        self.levels = levels
        self.book: Dict[float, DOMLevel] = {}
        self.best_bid: float = 0.0
        self.best_ask: float = 999999.0

    def update_bid(self, price: float, size: int):
        if price not in self.book:
            self.book[price] = DOMLevel(price=price)
        self.book[price].bid_size = size
        self._recalc_bba()

    def update_ask(self, price: float, size: int):
        if price not in self.book:
            self.book[price] = DOMLevel(price=price)
        self.book[price].ask_size = size
        self._recalc_bba()

    def clear(self):
        self.book.clear()
        self.best_bid = 0.0
        self.best_ask = 999999.0

    def _recalc_bba(self):
        bids = [p for p, l in self.book.items() if l.bid_size > 0]
        asks = [p for p, l in self.book.items() if l.ask_size > 0]
        self.best_bid = max(bids) if bids else 0.0
        self.best_ask = min(asks) if asks else 999999.0

    @property
    def mid_price(self) -> float:
        if self.best_bid > 0 and self.best_ask < 999999:
            return round((self.best_bid + self.best_ask) / 2, 2)
        return 0.0

    @property
    def spread(self) -> float:
        if self.best_bid > 0 and self.best_ask < 999999:
            return round(self.best_ask - self.best_bid, 2)
        return 0.0

    def snapshot(self) -> dict:
        bid_levels = sorted(
            [(p, l) for p, l in self.book.items() if l.bid_size > 0],
            key=lambda x: x[0], reverse=True,
        )[:self.levels]

        ask_levels = sorted(
            [(p, l) for p, l in self.book.items() if l.ask_size > 0],
            key=lambda x: x[0],
        )[:self.levels]

        bids = [{"price": p, "size": l.bid_size, "delta": l.bid_size} for p, l in bid_levels]
        asks = [{"price": p, "size": l.ask_size, "delta": -l.ask_size} for p, l in reversed(ask_levels)]

        return {
            "type": "dom",
            "timestamp": int(time.time() * 1000),
            "mid": self.mid_price,
            "spread": self.spread,
            "bids": bids,
            "asks": asks,
        }