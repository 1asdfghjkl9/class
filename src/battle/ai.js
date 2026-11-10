// ============================================================
// battle/ai.js — 三个 Boss 独立 AI
// ============================================================

import { CONFIG } from '../config.js';

export class BossAI {
  constructor(bossId, bossData, battle) {
    this.bossId = bossId;
    this.boss = bossData;
    this.battle = battle;
    // 通用状态
    this.patrolDir = -1;
    this.patrolX = (bossData.homeX ?? bossData.patrolMin) ?? 1200;
    this.swayPhase = 0;
    this.turnCount = 0;
    // 金老师专用
    this.rollCallCd = bossData.rollCallInterval ?? 0;
    this.rollCallWarning = false; // 已举书预警，下回合真正点名
    this.dragClassCd = bossData.dragClassInterval ?? 0;
    this.enraged = false;
    // 韩老师专用
    this.quizCd = bossData.quizInterval ?? 2;
    this.paperRaged = false;
    // 吴老师专用
    this.homeworkCd = bossData.homeworkInterval ?? 2;
    this.disciplineCd = bossData.disciplineInterval ?? 3;
    this.disciplineActive = false;
    this.disciplineTimer = 0;
  }

  get unit() {
    return this._unit || this.battle.boss;
  }

  // 获取弱点部件状态
  _isWeakpointAlive(id) {
    const u = this.unit;
    if (!u || !u.weakpoints) return false;
    const wp = u.weakpoints.find(w => w.id === id);
    return wp && !wp.destroyed;
  }

  // 通用：Boss 巡逻/晃动位置更新
  updatePosition(dt) {
    const u = this.unit;
    if (!u) return;
    if (this.bossId === 'jin') {
      const min = u.patrolMin;
      const max = u.patrolMax;
      const sp = u.patrolSpeed;
      this.patrolX += this.patrolDir * sp * dt;
      if (this.patrolX <= min) { this.patrolX = min; this.patrolDir = 1; }
      if (this.patrolX >= max) { this.patrolX = max; this.patrolDir = -1; }
      u.x = this.patrolX;
    } else if (this.bossId === 'han') {
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
    // 被束缚 → 不能移动
    if (this.battle.status && this.battle.status.isRooted(u)) return;
    u.y = CONFIG.GROUND_Y - u.radius;
  }

  // 通用：获取普通射击参数
  getNormalShotParams() {
    const u = this.unit;
    const target = this.battle.player;
    const bx = u.x;
    const by = u.y - u.radius / 2;
    const accMul = this.battle.status ? this.battle.status.getAccuracyModifier(u) : 1;
    const tx = target.x + (Math.random() - 0.5) * ((u.aimError || 45) * 2 / Math.max(0.3, accMul));
    const ty = target.y - target.radius;
    const dx = tx - bx;
    const dy = ty - by;
    const speed = u.shotSpeed ?? 600;
    const dir = dx >= 0 ? 1 : -1;
    const vx = dir * speed;
    const t = Math.max(0.1, Math.abs(dx) / speed);
    // 解析解：保证抛物线在 t 时刻正好穿过目标点
    const vy = (ty - by - 0.5 * CONFIG.GRAVITY * t * t) / t;
    return { x: bx, y: by, vx, vy };
  }

  // ===== 主入口：Boss 回合决策 =====
  decideAction() {
    this.turnCount++;
    switch (this.bossId) {
      case 'jin': return this._jinDecide();
      case 'han': return this._hanDecide();
      case 'wu':  return this._wuDecide();
      default:    return this._studentDecide();
    }
  }

  // ===== 金老师 AI =====
  _jinDecide() {
    const boss = this.unit;
    const hpRatio = boss.hp / boss.maxHp;

    // 叫家长（HP <= 20%）
    if (hpRatio <= this.boss.enrageThreshold && !this.enraged) {
      this.enraged = true;
      return { type: 'enrage', quote: (this.boss.quotes && this.boss.quotes.enrage) || '叫家长！' };
    }

    // 上回合已举书预警 → 本回合必须点名（最高优先级，不能被拖堂插队）
    if (this.rollCallWarning) {
      this.rollCallWarning = false;
      this.rollCallCd = this.boss.rollCallInterval;
      return { type: 'roll_call', quote: (this.boss.quotes && this.boss.quotes.rollCall) || '点名！' };
    }

    // 拖堂（笔袋存活 + CD 就绪）
    if (this._isWeakpointAlive('penbag') && this.dragClassCd <= 0) {
      this.dragClassCd = this.boss.dragClassInterval;
      return { type: 'drag_class', quote: (this.boss.quotes && this.boss.quotes.dragClass) || '拖堂五分钟。' };
    }

    // 点名预警（英语书存活 + CD 就绪）：先举书，给玩家一回合反应时间
    if (this._isWeakpointAlive('book') && this.rollCallCd <= 0) {
      this.rollCallWarning = true;
      return { type: 'roll_call_warning', quote: '（举起了包着「大富贵」书皮的英语书…）' };
    }

    // 普通弹射
    return { type: 'normal_shot' };
  }

  tickCooldowns() {
    if (this.bossId === 'jin') {
      this.rollCallCd--;
      this.dragClassCd--;
    } else if (this.bossId === 'han') {
      this.quizCd--;
    } else if (this.bossId === 'wu') {
      this.homeworkCd--;
      this.disciplineCd--;
    }
  }

  // ===== 韩老师 AI =====
  _hanDecide() {
    const boss = this.unit;
    const hpRatio = boss.hp / boss.maxHp;

    // 半血题海（300道题的锤炼）
    if (hpRatio <= this.boss.rageThreshold && !this.paperRaged) {
      this.paperRaged = true;
      return { type: 'paper_rage', quote: (this.boss.quotes && this.boss.quotes.rage) || '做三百道题！' };
    }

    // 口答（CD 就绪）
    if (this.quizCd <= 0) {
      // 试卷被打掉 → 口答间隔变长
      const interval = this._isWeakpointAlive('papers') ? this.boss.quizInterval : this.boss.quizInterval * 2;
      this.quizCd = interval;
      return { type: 'quiz', quote: '口答！' };
    }

    // 普通弹射
    return { type: 'normal_shot' };
  }

  // 获取口答限时（秒）
  getQuizTimer() {
    return this._isWeakpointAlive('timer') ? this.boss.quizTimer : this.boss.quizTimerBroken;
  }

  // ===== 吴老师 AI =====
  _wuDecide() {
    const boss = this.unit;

    // 纪律检查（CD 就绪；教鞭被打掉后仍会检查，但间隔变长）
    if (this.disciplineCd <= 0) {
      const interval = this._isWeakpointAlive('pointer')
        ? this.boss.disciplineInterval
        : (this.boss.disciplineIntervalBroken || this.boss.disciplineInterval * 2);
      this.disciplineCd = interval;
      return { type: 'discipline', quote: (this.boss.quotes && this.boss.quotes.discipline) || '纪律检查！' };
    }

    // 禁写作业（作业本堆存活 + CD 就绪）
    if (this._isWeakpointAlive('homework_stack') && this.homeworkCd <= 0) {
      this.homeworkCd = this.boss.homeworkInterval;
      return { type: 'homework', quote: (this.boss.quotes && this.boss.quotes.confiscate) || '作业没收！' };
    }

    // 普通弹射
    return { type: 'normal_shot' };
  }

  // ===== 学生 AI（学科线）=====
  _studentDecide() {
    const u = this.unit;
    const mech = u.mechanics || [];
    const hpRatio = u.hp / u.maxHp;
    let damageMul = 1;

    // 低血狂暴
    if (mech.includes('buff_low_hp') && hpRatio <= 0.5) {
      damageMul = 1.5;
      u.buffMul = 1.5;
    } else {
      u.buffMul = 1;
    }

    // 自我护盾
    if (mech.includes('shield_self') && this.turnCount % 3 === 0) {
      return { type: 'shield_self', quote: u.quote || '' };
    }

    // 双发
    if (mech.includes('double_shot') && this.turnCount % 2 === 0) {
      return { type: 'double_shot', quote: u.quote || '', damageMul };
    }

    return { type: 'normal_shot', quote: this.turnCount === 1 ? (u.quote || '') : '', damageMul };
  }
}
