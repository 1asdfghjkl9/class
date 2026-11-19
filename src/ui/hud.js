// ============================================================
// ui/hud.js — HUD 辅助渲染（菜单和结算界面）
// ============================================================

import { CONFIG } from '../config.js';

export class HUD {
  constructor(ctx) {
    this.ctx = ctx;
  }

  drawButton(x, y, w, h, label, color = '#FF6B6B') {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 3, y + 3, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h / 2 + 7);
    ctx.textAlign = 'left';
  }

  buttonHit(x, y, bx, by, bw, bh) {
    return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
  }
}
