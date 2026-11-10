// ============================================================
// ui/panels.js — 主菜单 & 结算面板（三 Boss 入口）
// ============================================================

import { CONFIG } from '../config.js';
import { BOSSES } from '../data/bosses.js';

export class MenuPanel {
  constructor() {
    this.particles = [];
    for (let i = 0; i < 30; i++) {
      this.particles.push({
        x: Math.random() * CONFIG.WIDTH,
        y: Math.random() * CONFIG.HEIGHT,
        r: 2 + Math.random() * 4,
        vy: 10 + Math.random() * 30,
        alpha: 0.2 + Math.random() * 0.3,
      });
    }
  }

  getBossButton(index) {
    const w = 380;
    const h = 120;
    const gap = 20;
    const totalH = 3 * h + 2 * gap;
    const startY = (CONFIG.HEIGHT - totalH) / 2 + 40;
    const x = (CONFIG.WIDTH - w) / 2;
    const y = startY + index * (h + gap);
    return { x, y, w, h };
  }

  render(ctx, time, saveData) {
    // 背景渐变
    const grad = ctx.createLinearGradient(0, 0, 0, CONFIG.HEIGHT);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(0.5, '#16213e');
    grad.addColorStop(1, '#0f3460');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    // 飘浮粒子
    for (const p of this.particles) {
      p.y += p.vy * 0.016;
      if (p.y > CONFIG.HEIGHT) {
        p.y = -10;
        p.x = Math.random() * CONFIG.WIDTH;
      }
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = '#FFE66D';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 标题
    const titleY = 120 + Math.sin(time * 2) * 5;
    ctx.fillStyle = '#FF6B6B';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('班级弹射对战', CONFIG.WIDTH / 2, titleY);

    ctx.fillStyle = '#FFE66D';
    ctx.font = '20px sans-serif';
    ctx.fillText('—— 老师们的反击 ——', CONFIG.WIDTH / 2, titleY + 35);

    // Boss 按钮
    const bossIds = ['jin', 'han', 'wu'];
    const bossColors = ['#FF6B6B', '#E91E63', '#7B68EE'];
    for (let i = 0; i < bossIds.length; i++) {
      const boss = BOSSES[bossIds[i]];
      const btn = this.getBossButton(i);
      const cleared = saveData?.progress?.bosses?.[bossIds[i]] === 1;
      const isLocked = false; // 需求：三大 Boss 支线主菜单任选，不做顺序锁

      // 按钮背景
      if (isLocked) {
        ctx.fillStyle = 'rgba(60,60,80,0.5)';
      } else {
        ctx.fillStyle = `rgba(${this._hexToRgb(bossColors[i])},0.15)`;
      }
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      ctx.strokeStyle = isLocked ? '#555' : bossColors[i];
      ctx.lineWidth = 3;
      ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);

      // Boss 名字
      ctx.fillStyle = isLocked ? '#666' : bossColors[i];
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(boss.name, btn.x + 20, btn.y + 35);
      ctx.fillStyle = isLocked ? '#444' : '#FFF';
      ctx.font = '16px sans-serif';
      ctx.fillText(boss.title, btn.x + 20, btn.y + 60);

      // 状态
      if (isLocked) {
        ctx.fillStyle = '#666';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('🔒 通关前一关解锁', btn.x + btn.w - 20, btn.y + 35);
      } else if (cleared) {
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('✓ 已通关', btn.x + btn.w - 20, btn.y + 35);
      } else {
        ctx.fillStyle = '#FFE66D';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('点击挑战 →', btn.x + btn.w - 20, btn.y + 35);
      }

      // HP/简介
      ctx.fillStyle = isLocked ? '#444' : 'rgba(255,255,255,0.6)';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`HP ${boss.hp} · DR ${Math.round(boss.dr * 100)}%`, btn.x + 20, btn.y + 85);

      // 弱点提示
      const wpNames = boss.weakpoints.map(w => w.name).join(' / ');
      ctx.fillStyle = isLocked ? '#444' : 'rgba(255,200,100,0.7)';
      ctx.font = '12px sans-serif';
      ctx.fillText(`弱点: ${wpNames}`, btn.x + 20, btn.y + 105);
    }

    ctx.textAlign = 'left';

    // 底部信息
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`金币: ${saveData?.coins || 0}   总射击: ${saveData?.stats?.totalShots || 0}   超暴击: ${saveData?.stats?.superCrits || 0}`, CONFIG.WIDTH / 2, CONFIG.HEIGHT - 30);
    ctx.textAlign = 'left';
  }

  _hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }
}

export class ResultPanel {
  constructor() {
    this.animTime = 0;
  }

  isReturnButtonClicked(x, y) {
    if (this.animTime < 1.2) return false; // 动画未播完不响应，避免误触
    const btnX = CONFIG.WIDTH / 2 - 100;
    const btnY = CONFIG.HEIGHT / 2 + 120;
    return x >= btnX && x <= btnX + 200 && y >= btnY && y <= btnY + 50;
  }

  render(ctx, dt, victory, bossId, saveData) {
    this.animTime += dt;
    const boss = BOSSES[bossId] || BOSSES.jin;

    // 背景
    const grad = ctx.createLinearGradient(0, 0, 0, CONFIG.HEIGHT);
    if (victory) {
      grad.addColorStop(0, '#1a3a1a');
      grad.addColorStop(1, '#0a200a');
    } else {
      grad.addColorStop(0, '#3a1a1a');
      grad.addColorStop(1, '#200a0a');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    // 标题动画
    const titleAlpha = Math.min(1, this.animTime * 2);
    const titleScale = 1 + Math.max(0, 0.5 - this.animTime) * 2;
    ctx.save();
    ctx.globalAlpha = titleAlpha;
    ctx.translate(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 100);
    ctx.scale(titleScale, titleScale);
    ctx.fillStyle = victory ? '#4CAF50' : '#F44336';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(victory ? '胜 利！' : '失 败...', 0, 0);
    ctx.restore();

    // Boss 名
    if (this.animTime > 0.5) {
      ctx.globalAlpha = Math.min(1, (this.animTime - 0.5) * 2);
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${boss.name} · ${boss.title}`, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 40);
      ctx.globalAlpha = 1;
    }

    // 统计
    if (this.animTime > 1) {
      ctx.globalAlpha = Math.min(1, (this.animTime - 1) * 2);
      ctx.fillStyle = '#FFE66D';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      if (victory) {
        ctx.fillText(`奖励: +200 金币`, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 10);
        ctx.fillStyle = '#4CAF50';
        ctx.fillText(`${boss.name} 已通关！`, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 40);
      } else {
        ctx.fillStyle = '#FF6B6B';
        ctx.fillText('再接再厉，继续挑战！', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 10);
      }
      ctx.globalAlpha = 1;
    }

    // 返回按钮
    if (this.animTime > 1.5) {
      ctx.globalAlpha = Math.min(1, (this.animTime - 1.5) * 2);
      const btnX = CONFIG.WIDTH / 2 - 100;
      const btnY = CONFIG.HEIGHT / 2 + 120;
      ctx.fillStyle = 'rgba(255,107,107,0.3)';
      ctx.fillRect(btnX, btnY, 200, 50);
      ctx.strokeStyle = '#FF6B6B';
      ctx.lineWidth = 2;
      ctx.strokeRect(btnX, btnY, 200, 50);
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('返回菜单', CONFIG.WIDTH / 2, btnY + 32);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }
}
