// ============================================================
// core/loop.js — 主循环，固定步长物理 + 可变步长渲染
// ============================================================

export class GameLoop {
  constructor(updateFn, renderFn) {
    this.updateFn = updateFn;   // (dt) => void  物理更新
    this.renderFn = renderFn;   // (alpha) => void  渲染插值
    this.fixedDt = 1 / 120;
    this.accumulator = 0;
    this.lastTime = 0;
    this.timeScale = 1.0;       // 用于慢动作
    this.running = false;
    this._rafId = null;
    this._boundTick = this._tick.bind(this);
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this._rafId = requestAnimationFrame(this._boundTick);
  }

  stop() {
    this.running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  setTimeScale(ts) {
    this.timeScale = ts;
  }

  _tick(now) {
    if (!this.running) return;
    const realDt = Math.min((now - this.lastTime) / 1000, 0.25);
    this.lastTime = now;

    const scaledDt = realDt * this.timeScale;
    this.accumulator += scaledDt;

    // 固定步长物理更新
    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < 240) {
      this.updateFn(this.fixedDt);
      this.accumulator -= this.fixedDt;
      steps++;
    }

    // 渲染
    const alpha = this.accumulator / this.fixedDt;
    this.renderFn(alpha);

    this._rafId = requestAnimationFrame(this._boundTick);
  }
}
