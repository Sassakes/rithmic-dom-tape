"""
Simulation engine - generates realistic NQ DOM + Tape data.
"""
import asyncio
import random
from dom_manager import DOMManager
from tape_manager import TapeManager

TICK = 0.25


class SimEngine:
    def __init__(self, dom: DOMManager, tape: TapeManager):
        self.dom = dom
        self.tape = tape
        self.mid = 21345.50
        self.running = False

    async def start(self, dom_callback, tape_callback):
        self.running = True
        self._seed_dom()
        await dom_callback(self.dom.snapshot())
        await asyncio.gather(
            self._dom_loop(dom_callback),
            self._tape_loop(tape_callback),
        )

    async def stop(self):
        self.running = False

    def _seed_dom(self):
        self.dom.clear()
        for i in range(1, 15):
            bid_price = round(self.mid - i * TICK, 2)
            ask_price = round(self.mid + (i - 1) * TICK, 2)
            self.dom.update_bid(bid_price, random.randint(30, 500))
            self.dom.update_ask(ask_price, random.randint(30, 500))

    async def _dom_loop(self, callback):
        while self.running:
            for _ in range(random.randint(2, 5)):
                offset = random.randint(0, 12)
                new_size = random.randint(15, 500)
                if random.random() > 0.5:
                    price = round(self.mid - (offset + 1) * TICK, 2)
                    self.dom.update_bid(price, new_size)
                else:
                    price = round(self.mid + offset * TICK, 2)
                    self.dom.update_ask(price, new_size)
            await callback(self.dom.snapshot())
            await asyncio.sleep(0.2 + random.random() * 0.15)

    async def _tape_loop(self, callback):
        while self.running:
            n_trades = 1 if random.random() > 0.3 else random.randint(2, 3)
            for _ in range(n_trades):
                is_buy = random.random() > 0.48
                size = random.randint(10, 40) if random.random() > 0.85 else random.randint(1, 9)
                offset = random.choice([-1, 0, 0, 0, 1]) * TICK
                price = round(self.mid + offset, 2)
                self.mid += (random.random() - 0.498) * TICK
                self.mid = round(self.mid / TICK) * TICK
                side = "buy" if is_buy else "sell"
                self.tape.add_trade(price=price, size=size, side=side, mid_price=self.mid)
                await callback(self.tape.snapshot(last_n=1))
            await asyncio.sleep(0.08 + random.random() * 0.12)