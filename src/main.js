// ============================================================
// main.js — 游戏总控（菜单 / 战斗 / 结算 三态 + 横屏适配）
// ============================================================

import { CONFIG } from './config.js';
import { loadSave, saveData, addCoins, addExp } from './save.js';
import { Account } from './account.js';
import { BattleScene } from './battle/battle.js';
import { MenuScene, ResultScene } from './ui/menu.js';
import { SUBJECTS, getStage } from './data/subjects.js';
import { BOSSES } from './data/bosses.js';

const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;

const STATE = {
  MENU: 'menu',
  BATTLE: 'battle',
  RESULT: 'result',
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('当前浏览器不支持 Canvas 2D');
    // 账号系统初始化
    Account.init();
    this.saveData = loadSave();
    this.state = STATE.MENU;
    this.menu = new MenuScene(this.saveData);
    this.result = new ResultScene(this.saveData);
    this.battleScene = null;
    this.pendingBattle = null;
    this.resultTarget = null;
    this.rafId = null;
    this.lastTime = 0;
    this.scale = 1;
    this.menu.page = 'home';

    this._setupCanvas();
    this._bindInput();
    this._bindResize();

    this.menu.onStartBattle = (target, opts) => this._startBattle(target, opts);
    this.menu.onResetSave = (fresh) => {
      this.saveData = fresh;
      this.menu.save = fresh;
      this.result.save = fresh;
    };
  }

  // ---------- 画布 / 横屏 ----------
  _setupCanvas() {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    this.scale = scale;
    this.canvas.style.width = Math.round(W * scale) + 'px';
    this.canvas.style.height = Math.round(H * scale) + 'px';
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
  }

  _checkOrientation() {
    const tip = document.getElementById('rotate-tip');
    if (!tip) return;
    const portrait = window.innerHeight > window.innerWidth;
    // 竖屏且偏窄时提示横屏（含 iPad 竖屏 768 宽）
    const narrow = Math.min(window.innerWidth, window.innerHeight) < 820;
    tip.style.display = (portrait && narrow) ? 'flex' : 'none';
  }

  _bindResize() {
    const onResize = () => {
      this._setupCanvas();
      this._checkOrientation();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 120));
    this._checkOrientation();
  }

  // ---------- 输入 ----------
  _toLocal(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) / (r.width / W),
      y: (clientY - r.top) / (r.height / H),
    };
  }

  _bindInput() {
    let downX = 0, downY = 0, dragging = false;

    const onDown = (e) => {
      if (this.state === STATE.BATTLE) return;
      const p = this._toLocal(e.clientX, e.clientY);
      downX = p.x; downY = p.y; dragging = false;
    };
    const onMove = (e) => {
      if (this.state === STATE.BATTLE) return;
      const p = this._toLocal(e.clientX, e.clientY);
      if (Math.hypot(p.x - downX, p.y - downY) > 18) dragging = true;
      if (this.state === STATE.MENU) this.menu.move(p.x, p.y);
      else if (this.state === STATE.RESULT) this.result.move(p.x, p.y);
    };
    const onUp = (e) => {
      if (this.state === STATE.BATTLE) return;
      if (dragging) return;
      const p = this._toLocal(e.clientX, e.clientY);
      this._handleClick(p.x, p.y);
    };

    this.canvas.addEventListener('pointerdown', onDown);
    this.canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    // 账号弹窗键盘输入
    const onKeyDown = (e) => {
      if (this.state === STATE.MENU && this.menu && this.menu.accountModal) {
        if (e.key === 'Backspace') {
          this.menu.handleAccountKey(null, true);
          e.preventDefault();
        } else if (e.key === 'Enter') {
          this.menu._submitAccount();
          e.preventDefault();
        } else if (e.key === 'Escape') {
          this.menu._closeAccountModal();
          e.preventDefault();
        } else if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          this.menu.handleAccountKey(e.key, false);
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
  }

  _handleClick(x, y) {
    if (this.state === STATE.MENU) {
      this.menu.click(x, y);
      return;
    }
    if (this.state === STATE.RESULT) {
      const act = this.result.click(x, y);
      if (!act) return;
      if (act === 'menu') {
        this.state = STATE.MENU;
        this.menu.page = 'home';
        this.menu.hits = [];
      } else if (act === 'retry') {
        const t = this.resultTarget;
        if (t) this._startBattle(t.target, t.opts);
      } else if (act === 'next') {
        const info = this.result.info;
        if (info && info.nextTarget) this._startBattle(info.nextTarget, {});
      }
    }
  }

  // ---------- 战斗 ----------
  _startBattle(target, opts) {
    if (this.battleScene) {
      try { this.battleScene.stop(); } catch (e) { /* ignore */ }
      this.battleScene = null;
    }
    this.pendingBattle = { target, opts: opts || {} };
    this.state = STATE.BATTLE;
    this.battleScene = new BattleScene(this.canvas, target, this.saveData, {
      onEnd: (victory, info) => this._onEnd(victory, info),
    }, opts || {});
    this.battleScene.start();
  }

  _onEnd(victory, info) {
    const scene = this.battleScene;
    this.battleScene = null;
    if (scene) {
      try { scene.stop(); } catch (e) { /* ignore */ }
    }

    const d = info || {};
    let title = '';
    let nextTarget = null;

    if (d.stageId) {
      const st = getStage(d.stageId);
      const sub = st ? SUBJECTS[st.subject] : null;
      title = `${sub ? sub.name : ''} · ${st ? st.name : ''} — ${victory ? '通关' : '失败'}`;
      if (victory && st && sub && st.index + 1 < sub.stages.length) {
        nextTarget = sub.stages[st.index + 1].id;
      }
    } else if (d.bossId) {
      const b = BOSSES[d.bossId];
      title = `${b ? b.name : ''} · ${b ? b.title : ''} — ${victory ? '通关' : '失败'}`;
    }

    // 每日 / 每周挑战：记录进度并发放额外奖励
    if (victory && d.challengeId) {
      if (!this.saveData.challenges) this.saveData.challenges = { cleared: {} };
      if (!this.saveData.challenges.cleared) this.saveData.challenges.cleared = {};
      const c = this.saveData.challenges.cleared;
      c[d.challengeId] = (c[d.challengeId] || 0) + 1;
      if (d.challengeReward) {
        addCoins(this.saveData, d.challengeReward.coins || 0);
        addExp(this.saveData, d.challengeReward.exp || 0);
        d.reward = {
          ...(d.reward || {}),
          coins: ((d.reward && d.reward.coins) || 0) + (d.challengeReward.coins || 0),
          exp: ((d.reward && d.reward.exp) || 0) + (d.challengeReward.exp || 0),
          challengeBonus: d.challengeReward,
        };
      }
      if (d.challengeLabel) title = d.challengeLabel + ' — ' + (d.challengeLabel.includes('每周') ? '完成' : '完成');
    }

    const diffName = (CONFIG.DIFFICULTIES[d.difficulty] || {}).name || '';
    const mods = (d.modifierIds || []).length;
    if (diffName || mods) {
      title += `（${diffName}${mods ? ' · ' + mods + ' 个挑战条件' : ''}）`;
    }

    this.result.show({
      ...d,
      victory,
      title,
      nextTarget,
      canRetry: true,
    });
    this.resultTarget = this.pendingBattle ? { ...this.pendingBattle } : null;
    this.state = STATE.RESULT;
    saveData(this.saveData);
  }

  // ---------- 主循环 ----------
  _tick(now) {
    if (!this.lastTime) this.lastTime = now;
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if (this.state === STATE.MENU) {
      this.menu.update(dt);
      this.ctx.clearRect(0, 0, W, H);
      this.menu.render(this.ctx);
    } else if (this.state === STATE.RESULT) {
      this.result.update(dt);
      this.ctx.clearRect(0, 0, W, H);
      this.result.render(this.ctx);
    }

    this.rafId = requestAnimationFrame((t) => this._tick(t));
  }

  start() {
    this.rafId = requestAnimationFrame((t) => this._tick(t));
  }
}

// ===== 启动 =====
function boot() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.error('Canvas not found');
    return;
  }
  const game = new Game(canvas);
  window.__game = game;
  game.start();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
