// ============================================================
// battle/ai.js — 全员 AI（Boss + 学科线学生）
// 支持平射/吊射、技能偏好（连发/高伤/恶心/散射/治疗）
// ============================================================

import { CONFIG } from '../config.js';

export class BossAI {
  constructor(bossId, bossData, battle) {
    this.bossId = bossId;
    this.boss = bossData;
    this.battle = battle;
    this.patrolDir = -1;
    this.patrolX = (bossData.homeX ?? bossData.patrolMin) ?? 1200;
    this.swayPhase = 0;
    this.turnCount = 0;
    // Boss 专用状态
    this.rollCallCd = bossData.rollCallInterval ?? 0;
    this.rollCallWarning = false;
    this.dragClassCd = bossData.dragClassInterval ?? 0;
    this.enraged = false;
    this.quizCd = bossData.quizInterval ?? 2;
    this.paperRaged = false;
    this.homeworkCd = bossData.homeworkInterval ?? 2;
    this.disciplineCd = bossData.disciplineInterval ?? 3;
    this.disciplineActive = false;
    this.disciplineTimer = 0;
  }

  get unit() {
    return this._unit || this.battle.boss;
  }

  _isWeakpointAlive(id) {
    const u = this.unit;
    if (!u || !u.weakpoints) return false;
    const wp = u.weakpoints.find(w => w.id === id);
    return wp && !wp.destroyed;
  }

  // ===== 位置更新 =====
  updatePosition(dt) {
    const u = this.unit;
    if (!u) return;
    if (this.bossId === 'jin' || this.bossId === 'ding') {
      const min = u.patrolMin, max = u.patrolMax, sp = u.patrolSpeed;
      this.patrolX += this.patrolDir * sp * dt;
      if (this.patrolX <= min) { this.patrolX = min; this.patrolDir = 1; }
      if (this.patrolX >= max) { this.patrolX = max; this.patrolDir = -1; }
      u.x = this.patrolX;
    } else if (this.bossId === 'han' || this.bossId === 'huang') {
      this.swayPhase += dt;
      const range = u.swayRange || 30;
      const speed = u.swaySpeed || 1;
      u.x = u.homeX + Math.sin(this.swayPhase * speed * 0.03) * range;
    } else if (this.bossId === 'wu') {
      u.x = u.homeX;
    } else {
      // 学生：小幅巡逻
      this.patrolX += this.patrolDir * (u.patrolSpeed || 24) * dt;
      const min = u.patrolMin ?? (u.homeX - 120);
      const max = u.patrolMax ?? (u.homeX + 120);
      if (this.patrolX <= min) { this.patrolX = min; this.patrolDir = 1; }
      if (this.patrolX >= max) { this.patrolX = max; this.patrolDir = -1; }
      u.x = this.patrolX;
    }
    if (this.battle.status && this.battle.status.isRooted(u)) return;
    u.y = CONFIG.GROUND_Y - u.radius;
  }

  // ===== 射击参数：平射 vs 吊射 =====
  getNormalShotParams() {
    const u = this.unit;
    const target = this.battle.player;
    const bx = u.x;
    const by = u.y - u.radius / 2;
    const accMul = this.battle.status ? this.battle.status.getAccuracyModifier(u) : 1;
    
    // 预测玩家移动
    let leadX = 0;
    if (this.battle._moveLeft || this.battle._moveBtnLeft) leadX = -CONFIG.PLAYER_MOVE_SPEED * 0.3;
    if (this.battle._moveRight || this.battle._moveBtnRight) leadX = CONFIG.PLAYER_MOVE_SPEED * 0.3;
    
    const aimErr = (u.aimError || 42) * 0.35;
    const tx = target.x + leadX + (Math.random() - 0.5) * (aimErr * 2 / Math.max(0.3, accMul));
    const ty = target.y - target.radius;
    const dx = tx - bx;
    const dy = ty - by;
    const speed = (u.shotSpeed ?? 600) * 1.3;
    
    if (u.shotType === 'lob') {
      // 吊射：高弧线 ∩ 型
      // 李为先吊射精度更高
      const lobErr = u.name === '李为先' ? aimErr * 0.4 : aimErr;
      const lobTx = target.x + leadX + (Math.random() - 0.5) * (lobErr * 2 / Math.max(0.3, accMul));
      const lobDx = lobTx - bx;
      const dir = lobDx >= 0 ? 1 : -1;
      const lobSpeed = speed * 0.75;
      const t = Math.max(0.3, Math.abs(lobDx) / lobSpeed);
      // 抛物线高度额外加成
      const arcHeight = Math.abs(lobDx) * 0.4 + 200;
      const vy = (ty - by - 0.5 * CONFIG.GRAVITY * t * t - arcHeight) / t;
      // 调整 vy 使弧线更高
      const adjustedVy = vy - Math.sqrt(2 * CONFIG.GRAVITY * arcHeight);
      return { x: bx, y: by, vx: dir * lobSpeed, vy: adjustedVy };
    } else {
      // 平射：低弧线直接瞄准
      const dir = dx >= 0 ? 1 : -1;
      const vx = dir * speed;
      const t = Math.max(0.1, Math.abs(dx) / speed);
      const vy = (ty - by - 0.5 * CONFIG.GRAVITY * t * t) / t;
      return { x: bx, y: by, vx, vy };
    }
  }

  // ===== 主入口 =====
  decideAction() {
    this.turnCount++;
    switch (this.bossId) {
      case 'jin': return this._jinDecide();
      case 'han': return this._hanDecide();
      case 'wu':  return this._wuDecide();
      case 'ding':  return this._lvDecide();
      case 'huang':  return this._maDecide();
      default:    return this._studentDecide();
    }
  }

  // ===== 金老师 AI =====
  _jinDecide() {
    const boss = this.unit;
    const hpRatio = boss.hp / boss.maxHp;
    if (hpRatio <= (this.boss.enrageThreshold * 1.25) && !this.enraged) {
      this.enraged = true;
      return { type: 'enrage', quote: (this.boss.quotes && this.boss.quotes.enrage) || '叫家长！' };
    }
    if (this.rollCallWarning) {
      this.rollCallWarning = false;
      this.rollCallCd = this.boss.rollCallInterval;
      return { type: 'roll_call', quote: (this.boss.quotes && this.boss.quotes.rollCall) || '点名！' };
    }
    if (this._isWeakpointAlive('penbag') && this.dragClassCd <= 0) {
      this.dragClassCd = Math.max(1, (this.boss.dragClassInterval || 3) - 1);
      return { type: 'drag_class', quote: (this.boss.quotes && this.boss.quotes.dragClass) || '拖堂五分钟。' };
    }
    if (this._isWeakpointAlive('book') && this.rollCallCd <= 0) {
      this.rollCallWarning = true;
      return { type: 'roll_call_warning', quote: '（举起了包着「大富贵」书皮的英语书…）' };
    }
    return { type: 'normal_shot' };
  }

  tickCooldowns() {
    if (this.bossId === 'jin') {
      this.rollCallCd--; this.dragClassCd--;
    } else if (this.bossId === 'han') {
      this.quizCd--;
    } else if (this.bossId === 'wu') {
      this.homeworkCd--; this.disciplineCd--;
    }
  }

  _hanDecide() {
    const boss = this.unit;
    const hpRatio = boss.hp / boss.maxHp;
    if (hpRatio <= (this.boss.rageThreshold * 1.2) && !this.paperRaged) {
      this.paperRaged = true;
      return { type: 'paper_rage', quote: (this.boss.quotes && this.boss.quotes.rage) || '做四百道题！' };
    }
    if (this.quizCd <= 0) {
      const interval = this._isWeakpointAlive('papers') ? Math.max(1, this.boss.quizInterval - 1) : this.boss.quizInterval;
      this.quizCd = interval;
      return { type: 'quiz', quote: '口答！' };
    }
    return { type: 'normal_shot' };
  }

  getQuizTimer() {
    return this._isWeakpointAlive('timer') ? this.boss.quizTimer : this.boss.quizTimerBroken;
  }

  _wuDecide() {
    const boss = this.unit;
    if (this.disciplineCd <= 0) {
      const interval = this._isWeakpointAlive('pointer')
        ? Math.max(1, this.boss.disciplineInterval - 1)
        : Math.max(1, (this.boss.disciplineIntervalBroken || this.boss.disciplineInterval * 2) - 1);
      this.disciplineCd = interval;
      return { type: 'discipline', quote: (this.boss.quotes && this.boss.quotes.discipline) || '纪律检查！' };
    }
    if (this._isWeakpointAlive('homework_stack') && this.homeworkCd <= 0) {
      this.homeworkCd = Math.max(1, this.boss.homeworkInterval - 1);
      return { type: 'homework', quote: (this.boss.quotes && this.boss.quotes.confiscate) || '作业没收！' };
    }
    return { type: 'normal_shot' };
  }

  _lvDecide() {
    const u = this.unit;
    const hpRatio = u.hp / u.maxHp;
    let damageMul = 1;
    if (hpRatio <= 0.25) damageMul = 1.6;
    if (this.turnCount % 3 === 0 && this.turnCount > 0) {
      return { type: 'paint_splash', quote: u.quotes?.dragClass || '', damageMul };
    }
    if (this.turnCount % 2 === 0) {
      return { type: 'sketch_burst', quote: '', damageMul };
    }
    return { type: 'normal_shot', quote: this.turnCount === 1 ? (u.quotes?.intro || '') : '', damageMul };
  }

  _maDecide() {
    const u = this.unit;
    const hpRatio = u.hp / u.maxHp;
    let damageMul = 1;
    if (hpRatio <= 0.30) { damageMul = 1.8; u.buffMul = 1.8; }
    if (this.turnCount % 3 === 0 && this.turnCount > 0) {
      return { type: 'ball_throw', quote: u.quotes?.quizWrong || '', damageMul };
    }
    if (this.turnCount % 2 === 0) {
      return { type: 'sprint_charge', quote: '', damageMul };
    }
    return { type: 'normal_shot', quote: this.turnCount === 1 ? (u.quotes?.intro || '') : '', damageMul };
  }

  // ===== 学生 AI（学科线）— 基于射击偏好和技能偏好 =====
  _studentDecide() {
    const u = this.unit;
    const mech = u.mechanics || [];
    const hpRatio = u.hp / u.maxHp;
    let damageMul = 1;

    // 低血狂暴
    if (mech.includes('buff_low_hp') && hpRatio <= 0.65) {
      damageMul = 2.0;
      u.buffMul = 2.0;
    } else {
      u.buffMul = 1.4;
    }

    const pref = u.skillPref || 'normal';
    const tc = this.turnCount;

    // ===== 技能偏好决策 =====
    switch (pref) {
      case 'rapid':
        // 连发：优先多发射击
        if (mech.includes('double_shot') && tc % 2 === 0) {
          return { type: 'triple_shot', quote: u.quote || '', damageMul };
        }
        if (tc % 2 === 0) {
          return { type: 'double_shot', quote: u.quote || '', damageMul };
        }
        break;

      case 'heavy':
        // 高伤：优先高伤射击
        if (tc % 3 === 0 && tc > 0) {
          return { type: 'heavy_shot', quote: u.quote || '', damageMul };
        }
        if (mech.includes('double_shot') && tc % 2 === 0) {
          return { type: 'double_shot', quote: u.quote || '', damageMul };
        }
        break;

      case 'annoy':
        // 恶心：击退/换位/番茄炒蛋
        if (tc % 3 === 0 && tc > 0) {
          return { type: 'knockback_shot', quote: u.quote || '', damageMul };
        }
        if (tc % 2 === 0) {
          return { type: 'swap_shot', quote: u.quote || '', damageMul };
        }
        if (mech.includes('silence_shot') && tc % 4 === 0) {
          return { type: 'silence_shot', quote: u.quote || '', damageMul };
        }
        break;

      case 'scatter':
        // 散射：扇形多发
        if (tc % 2 === 0) {
          return { type: 'scatter_shot', quote: u.quote || '', damageMul };
        }
        if (mech.includes('silence_shot') && tc % 3 === 0) {
          return { type: 'silence_shot', quote: u.quote || '', damageMul };
        }
        break;

      case 'heal':
        // 治疗/净化：低血时治疗，否则辅助射击
        if (hpRatio <= 0.5 && tc % 3 === 0) {
          return { type: 'heal_self', quote: u.quote || '' };
        }
        if (mech.includes('shield_self') && tc % 2 === 0) {
          return { type: 'shield_self', quote: u.quote || '' };
        }
        if (tc % 2 === 0) {
          return { type: 'double_shot', quote: u.quote || '', damageMul };
        }
        break;

      default:
        // normal
        if (mech.includes('shield_self') && tc % 2 === 0) {
          return { type: 'shield_self', quote: u.quote || '' };
        }
        if (mech.includes('double_shot') && tc % 2 === 0) {
          return { type: 'double_shot', quote: u.quote || '', damageMul };
        }
        if (mech.includes('silence_shot') && tc % 3 === 0) {
          return { type: 'silence_shot', quote: u.quote || '', damageMul };
        }
        break;
    }

    // 所有人每3回合有概率三连射
    if (tc % 3 === 0 && tc > 1 && Math.random() < 0.5) {
      return { type: 'triple_shot', quote: u.quote || '', damageMul };
    }

    return { type: 'normal_shot', quote: tc === 1 ? (u.quote || '') : '', damageMul };
  }
}
