// ============================================================
// core/input.js — 指针拖拽输入（支持回调 + 指针捕获）
// ============================================================

export class Input {
  constructor(canvas, logicalW = 1600, logicalH = 900) {
    this.canvas = canvas;
    this.logicalW = logicalW;
    this.logicalH = logicalH;

    // 当前指针状态（逻辑坐标）
    this.x = 0;
    this.y = 0;
    this.isDown = false;
    this.downX = 0;
    this.downY = 0;
    this.dragging = false;

    // 点击事件队列（兼容旧逻辑）
    this.clicks = [];

    // 外部回调
    this.onPointerDown = null;
    this.onPointerUp = null;
    this.onPointerMove = null;

    this._activePointerId = null;
    this._bindEvents();
  }

  _bindEvents() {
    const downHandler = (e) => {
      e.preventDefault();
      const point = this._getPoint(e);
      this.x = point.x;
      this.y = point.y;
      this.isDown = true;
      this.downX = point.x;
      this.downY = point.y;
      this.dragging = false;
      this._activePointerId = e.pointerId;

      // 捕获指针：拖出画布也能收到 up，避免提前松手
      try {
        if (this._activePointerId != null) {
          this.canvas.setPointerCapture(this._activePointerId);
        }
      } catch (err) { /* 部分浏览器不支持，忽略 */ }

      if (this.onPointerDown) this.onPointerDown(this.x, this.y);
    };

    const moveHandler = (e) => {
      const point = this._getPoint(e);
      this.x = point.x;
      this.y = point.y;
      if (this.isDown) {
        const dist = Math.hypot(this.x - this.downX, this.y - this.downY);
        if (dist > 8) this.dragging = true;
      }
      if (this.onPointerMove) this.onPointerMove(this.x, this.y);
    };

    const upHandler = (e) => {
      if (!this.isDown) return;
      e.preventDefault();
      const point = this._getPoint(e);
      this.x = point.x;
      this.y = point.y;

      const dist = Math.hypot(this.x - this.downX, this.y - this.downY);
      if (dist < 12) {
        this.clicks.push({ x: this.downX, y: this.downY });
      }

      this.isDown = false;
      this.dragging = false;

      try {
        if (this._activePointerId != null) {
          this.canvas.releasePointerCapture(this._activePointerId);
        }
      } catch (err) { /* ignore */ }
      this._activePointerId = null;

      if (this.onPointerUp) this.onPointerUp(this.x, this.y);
    };

    this.canvas.addEventListener('pointerdown', downHandler);
    this.canvas.addEventListener('pointermove', moveHandler);
    this.canvas.addEventListener('pointerup', upHandler);
    this.canvas.addEventListener('pointercancel', upHandler);
    // 阻止触摸滚动
    this.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    this._downHandler = downHandler;
    this._moveHandler = moveHandler;
    this._upHandler = upHandler;
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this._downHandler);
    this.canvas.removeEventListener('pointermove', this._moveHandler);
    this.canvas.removeEventListener('pointerup', this._upHandler);
    this.canvas.removeEventListener('pointercancel', this._upHandler);
  }

  _getPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || this.canvas.clientWidth || this.logicalW;
    const h = rect.height || this.canvas.clientHeight || this.logicalH;
    return {
      x: (e.clientX - rect.left) * (this.logicalW / w),
      y: (e.clientY - rect.top) * (this.logicalH / h),
    };
  }

  consumeClicks() {
    const c = this.clicks;
    this.clicks = [];
    return c;
  }

  getDragVector() {
    if (!this.isDown) return null;
    const dx = this.x - this.downX;
    const dy = this.y - this.downY;
    const dist = Math.hypot(dx, dy);
    return { dx, dy, dist };
  }
}
