// ============================================================
// battle/battle.js — 战斗场景（三 Boss 关卡 + 视觉优化）
// ============================================================

import { CONFIG } from '../config.js';
import { GameLoop } from '../core/loop.js';
import { Input } from '../core/input.js';
import { AudioSystem } from '../core/audio.js';
import { SKILLS, skillDamage, skillEffect } from '../data/skills.js';
import { ITEMS, itemEffectMul, rollEnemyItem } from '../data/items.js';
import { WEAPONS, weaponDamage, sumAffixes } from '../data/weapons.js';
import { BOSSES, MINION, STUDENT_ENEMIES } from '../data/bosses.js';
import { getStage } from '../data/subjects.js';
import { MODIFIERS } from '../data/challenges.js';
import { getRandomQuestion } from '../data/questions.js';
import { aggregateTalents } from '../data/talents.js';
import { getStory, getStageQuote } from '../data/stories.js';
import { TerrainObject, TERRAIN_FACTORIES, MATERIALS, PLATFORM_FACTORIES, createPlatform, checkPlatformHit } from '../battle/terrain.js';
import { Projectile, predictTrajectory } from '../battle/projectile.js';
import { checkCollision, createDecal, createHitParticles } from '../battle/collision.js';
import { calculateDamage, createDamageText } from '../battle/damage.js';
import { StatusSystem } from '../battle/status.js';
import { ATBSystem } from '../battle/atb.js';
import { BossAI } from '../battle/ai.js';
import { ULTIMATES, getUlt, canUseUlt, resetRage, RAGE_MAX, RAGE_GAIN, ULT_ORDER } from '../battle/ult.js';
import { createInteractables, checkInteractableHit } from '../battle/interactables.js';
import { createModifierState, applyDifficultyToBoss, getDifficulty } from '../battle/modifiers.js';
import { prepareBattleItems, weaponSummary } from '../meta/economy.js';
import { onBattleWin } from '../meta/progression.js';
import { checkAchievements } from '../data/achievements.js';
import { HUD } from '../ui/hud.js';
import { saveBattleState, clearBattleState, addExp, addCoins, saveData as persistSave } from '../save.js';

// 战斗状态
const BS = {
  WAITING:        'waiting',
  PLAYER_TURN:    'player_turn',
  PLAYER_AIMING:  'player_aiming',
  FIRING:         'firing',
  BOSS_TURN:      'boss_turn',
  BOSS_ACTING:    'boss_acting',
  QUIZ:           'quiz',
  DISCIPLINE:     'discipline',
  ENDED:          'ended',
};

export class BattleScene {
  constructor(canvas, bossId, saveData, callbacks, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bossId = bossId || 'jin';
    this.saveData = saveData;
    this.callbacks = callbacks || {};
    this.opts = opts || {};
    this.time = 0;
    this.state = BS.WAITING;
    this.loop = null;
    this.input = null;
    this.audio = new AudioSystem();
    this.hud = new HUD(this.ctx);
    this.difficultyId = this.opts.difficulty || (saveData.settings && saveData.settings.difficulty) || 'normal';
    this.modifierIds = this.opts.modifierIds || [];
    this.ultId = this.opts.ultId || (saveData.settings && saveData.settings.ultId) || 'bomb';
    this.stageCfg = null;
    this.isStage = false;
  }

  // ===== 初始化 =====
  _init() {
    const bossCfg = BOSSES[this.bossId];
    const stageCfg = bossCfg ? null : getStage(this.bossId);
    if (!bossCfg && !stageCfg) throw new Error('Unknown boss/stage: ' + this.bossId);
    this.isStage = !!stageCfg;
    this.stageCfg = stageCfg;
    // 对于学科线关卡，合并学生敌人战斗数据
    let cfg = bossCfg || stageCfg;
    if (stageCfg && stageCfg.enemyId) {
      const enemy = STUDENT_ENEMIES[stageCfg.enemyId];
      if (enemy) {
        cfg = { ...enemy, ...stageCfg, ...enemy }; // enemy 战斗属性优先，但保留 stage 的 weakpoints 等
        cfg.id = this.bossId; // 保持原始 stageId
        // ★ 小怪物（学生）去掉语音和称号
        cfg.title = '';
        cfg.nickname = '';
        cfg.quote = '';
      }
    }

    // --- 天赋 / 修饰符 / 难度 ---
    this.talent = aggregateTalents(this.saveData);
    this.modState = createModifierState(this.modifierIds);
    this.diff = getDifficulty(this.difficultyId);

    // --- 武器 ---
    const weaponId = (this.saveData.weapons && this.saveData.weapons.equipped) || 'pen_gun';
    const ownedW = (this.saveData.weapons && this.saveData.weapons.owned) || {};
    const wInst = ownedW[weaponId] || { level: 1, affixes: [] };
    const wDef = WEAPONS[weaponId] || WEAPONS.pen_gun;
    const wAffix = sumAffixes(wInst.affixes || []);
    this.weaponInfo = {
      def: wDef,
      level: wInst.level || 1,
      affixes: wInst.affixes || [],
      stats: wAffix,
      damage: Math.round(weaponDamage(wDef, wInst.level || 1, wInst.affixes || []) * (1 + (this.talent.dmgPct || 0) / 100)),
    };

    // --- 技能 / 道具 ---
    let skills = (this.saveData.equipped.skills || []).filter(s => SKILLS[s]).slice(0, 6);
    if (skills.length === 0) skills = ['wall'];
    const items = prepareBattleItems(this.saveData);

    // --- 玩家 ---
    let maxHp = CONFIG.PLAYER_MAX_HP + (this.talent.maxHp || 0);
    maxHp = Math.round(maxHp * (this.modState.playerHpMul || 1));
    this.player = {
      team: 'player',
      name: '你',
      x: CONFIG.PLAYER_X,
      y: CONFIG.GROUND_Y - CONFIG.PLAYER_RADIUS,
      radius: CONFIG.PLAYER_RADIUS,
      hp: maxHp,
      maxHp,
      facing: 1,
      dr: Math.min(CONFIG.DR_CAP, (this.talent.drPct || 0) / 100),
      speed: CONFIG.PLAYER_SPEED,
      dead: false,
      rage: 0,
      skills,
      items,
      weapon: wDef,
      skillLevels: {},
      ap: 0,
      apMax: CONFIG.AP_MAX + (this.talent.apMax || 0),
      apPerTurn: CONFIG.AP_PER_TURN + (this.talent.apPerTurn || 0),
      atb: 0,
      cooldowns: {},
      shotsThisTurn: 0,
      revived: false,
    };
    for (const sid of skills) {
      this.player.skillLevels[sid] = (this.saveData.skillLevels && this.saveData.skillLevels[sid]) || 1;
    }

    // --- Boss / 学生 ---
    this.boss = this._buildUnit(cfg, false);
    if (cfg.isTwin && (cfg.twin || cfg.twinId)) {
      const t = cfg.twin || (cfg.twinId ? STUDENT_ENEMIES[cfg.twinId] : null);
      if (t) {
        const baseX = cfg.homeX || 1050;
        this.bossTwin = this._buildUnit({
          ...t,
          id: (cfg.id || 'twin') + '_twin',
          title: '双胞胎之二',
          homeX: baseX + (t.offsetX || 110),
          patrolMin: (cfg.patrolMin || 900) + (t.offsetX || 110),
          patrolMax: (cfg.patrolMax || 1150) + (t.offsetX || 110),
          weakpoints: t.weakpoints || [],
          mechanics: t.mechanics || [],
        }, true);
      } else {
        this.bossTwin = null;
      }
    } else {
      this.bossTwin = null;
    }
    this.bossList = this.bossTwin ? [this.boss, this.bossTwin] : [this.boss];

    // --- 地形（按学科选择地图）---
    const terrainKey = this.isStage ? (this.stageCfg.subject || 'pe') : this.bossId;
    const factory = TERRAIN_FACTORIES[terrainKey] || TERRAIN_FACTORIES.pe || (() => []);
    this.terrain = factory();

    // --- 可破坏地面分段（半球形坑）---
    const segW = 40;
    const segCount = Math.ceil(CONFIG.WIDTH / segW);
    this.groundSegments = [];
    for (let i = 0; i < segCount; i++) {
      this.groundSegments.push({
        x: i * segW, w: segW,
        destroyed: false,
        craterDepth: 0, // 0=完好，>0=半球形坑深
      });
    }

    // --- 可破坏悬空平台（分段制，和地面一样打坑）---
    const terrainKey2 = this.isStage ? (this.stageCfg.subject || 'pe') : this.bossId;
    const platFactory = PLATFORM_FACTORIES[terrainKey2] || PLATFORM_FACTORIES.pe;
    const platDefs = platFactory();
    this.platforms = platDefs.map(d => createPlatform(d.x, d.y, d.w, d.h));

    // --- 系统 ---
    this.atb = new ATBSystem();
    this.atb.register(this.player);
    for (const b of this.bossList) this.atb.register(b);
    this.ai = new BossAI(this.bossId, cfg, this);
    this.ai._unit = this.boss;
    if (this.bossTwin) {
      this.aiTwin = new BossAI(this.bossId, cfg, this);
      this.aiTwin.isTwinAI = true;
      this.aiTwin._unit = this.bossTwin;
      this.aiTwin.boss = this.bossTwin;
    }
    this.status = new StatusSystem();

    // 开战天赋护盾
    if (this.talent.shieldPct) {
      this.status.add(this.player, 'shield', 3, Math.min(0.5, this.talent.shieldPct / 100));
    }

    // --- 弹丸 / 特效 ---
    this.projectiles = [];
    this.pendingShots = [];
    this.particles = [];
    this.damageTexts = [];
    this.decals = [];
    this.floatDecals = [];
    this.minions = [];

    // --- 场景互动物 ---
    this.interactables = createInteractables(this.bossId);

    // --- 大招 ---
    this.ult = getUlt(this.ultId);

    // --- 风向 ---
    this.wind = this._rollWind();
    this.turbulenceTimer = 0;
    this.blurTimer = 0;

    // --- UI 状态 ---
    this.aimMode = 'normal';
    this._aimDragging = false;
    this.shake = { x: 0, y: 0, intensity: 0, duration: 0 };
    this.timeScale = 1;
    this.bossQuote = null;
    this.bossQuoteTimer = 0;
    this.bossIntroTimer = 0;
    this.bossTurnDelay = 0;
    this.bossAction = null;
    this.bossActionPhase = 0;
    this.bossActionTimer = 0;

    // --- 移动键状态 ---
    this._moveLeft = false;
    this._moveRight = false;
    this._moveBtnLeft = false;
    this._moveBtnRight = false;
    this._pendingAimMode = null; // 用于大招/风筝瞄准
    this.moveUsed = 0; // 本回合已移动距离

    // 韩老师口答 / 吴老师纪律
    this.quiz = null;
    this.discipline = null;
    this.homeworkBooks = [];

    // 战斗统计（用于成就）
    this.battleStats = {
      weakpointsThisBattle: 0,
      playerDamaged: false,
      maxSingleHit: 0,
    };

    this._saveBattleState();

    // --- 输入 ---
    this.input = new Input(this.canvas, CONFIG.WIDTH, CONFIG.HEIGHT);
    this.input.onPointerDown = (x, y) => this._onPointerDown(x, y);
    this.input.onPointerUp = (x, y) => this._onPointerUp(x, y);

    // --- 键盘移动支持 ---
    this._keyHandler = (e) => {
      if (e.type === 'keydown') {
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') this._moveLeft = true;
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') this._moveRight = true;
      } else {
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') this._moveLeft = false;
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') this._moveRight = false;
      }
    };
    window.addEventListener('keydown', this._keyHandler);
    window.addEventListener('keyup', this._keyHandler);

    // --- 循环 ---
    this.loop = new GameLoop(
      (dt) => this._update(dt),
      () => this._render()
    );
  }

  // 构建敌方单位（Boss 或学生）
  _buildUnit(cfg, isTwin) {
    const radius = cfg.radius || CONFIG.BOSS_RADIUS;
    const homeX = cfg.homeX ?? cfg.patrolMin ?? 1200;
    const unit = {
      team: 'enemy',
      isBoss: true,
      isTwin: !!isTwin,
      kind: cfg.kind || 'boss',
      id: cfg.id,
      name: cfg.name,
      title: cfg.title,
      nickname: cfg.nickname || '',
      quote: cfg.quote || '',
      x: homeX,
      y: CONFIG.GROUND_Y - radius,
      radius,
      hp: cfg.hp,
      maxHp: cfg.hp,
      facing: -1,
      dr: cfg.dr ?? 0.05,
      speed: cfg.speed ?? 18,
      dead: false,
      color: cfg.color || '#FF6B6B',
      shotBaseDamage: cfg.shotBaseDamage || 15,
      shotSpeed: cfg.shotSpeed ?? 600,
      aimError: cfg.aimError ?? 45,
      patrolMin: cfg.patrolMin ?? homeX - 150,
      patrolMax: cfg.patrolMax ?? homeX + 150,
      patrolSpeed: cfg.patrolSpeed ?? 30,
      homeX,
      swayRange: cfg.swayRange || 0,
      swaySpeed: cfg.swaySpeed || 0,
      enrageThreshold: cfg.enrageThreshold ?? CONFIG.BOSS_ENRAGE_THRESHOLD,
      rollCallInterval: cfg.rollCallInterval ?? 3,
      dragClassInterval: cfg.dragClassInterval ?? 4,
      rageThreshold: cfg.rageThreshold ?? CONFIG.BOSS_HAN_RAGE_THRESHOLD,
      quizInterval: cfg.quizInterval ?? 3,
      quizTimer: cfg.quizTimer ?? 8,
      quizTimerBroken: cfg.quizTimerBroken ?? 5,
      paperCount: cfg.paperCount ?? 6,
      homeworkInterval: cfg.homeworkInterval ?? 3,
      disciplineInterval: cfg.disciplineInterval ?? 4,
      disciplineIntervalBroken: cfg.disciplineIntervalBroken ?? 6,
      disciplineDuration: cfg.disciplineDuration ?? 3,
      disciplineDamage: cfg.disciplineDamage ?? 30,
      mechanics: [...(cfg.mechanics || [])],
      weakpoints: (cfg.weakpoints || []).map(wp => ({ ...wp, currentHp: wp.hp, destroyed: false })),
      isPhantom: !!cfg.isPhantom,
      isTrueForm: !!cfg.isTrueForm,
      isTwinEnemy: !!cfg.isTwin,
      shotType: cfg.shotType || 'flat',
      skillPref: cfg.skillPref || 'normal',
      rage: 0,
      dmgMul: 1,
      atb: 0,
    };
    applyDifficultyToBoss(unit, this.difficultyId);
    unit.dmgMul = (unit.dmgMul || 1) * (this.modState.dmgMulBoss || 1);
    unit.hp = unit.maxHp;
    return unit;
  }

  // ===== 风向 =====
  _rollWind() {
    const dirs = ['cold', 'hot'];
    const dir = dirs[Math.floor(Math.random() * 2)];
    const level = 1 + Math.floor(Math.random() * 5);
    const mul = (this.modState && this.modState.windMul) || 1;
    return {
      dir, level,
      accel: (dir === 'cold' ? -1 : 1) * level * CONFIG.WIND_ACCEL_PER_LEVEL * mul,
    };
  }

  _windLabel() {
    const arrow = this.wind.dir === 'cold' ? '←' : '→';
    const intensity = ['微风', '轻风', '凉风', '大风', '狂风'][this.wind.level - 1];
    const tag = this.turbulenceTimer > 0 ? ' 紊乱' : '';
    return `${arrow} ${intensity} Lv${this.wind.level}${tag}`;
  }

  // ===== 存档 =====
  _saveBattleState() {
    saveBattleState({
      bossId: this.bossId,
      bossHp: this.boss.hp,
      playerHp: this.player.hp,
      wind: this.wind,
    });
  }

  _clearBattleState() {
    clearBattleState();
  }

  // ===== 主更新 =====
  _update(dt) {
    this.time += dt;

    // 画面震动衰减
    if (this.shake.duration > 0) {
      this.shake.duration -= dt;
      const decay = Math.max(0, this.shake.duration);
      this.shake.x = (Math.random() - 0.5) * this.shake.intensity * decay;
      this.shake.y = (Math.random() - 0.5) * this.shake.intensity * decay;
      if (this.shake.duration <= 0) {
        this.shake.x = 0; this.shake.y = 0; this.shake.intensity = 0;
      }
    }

    // 慢动作恢复
    if (this.timeScale < 1) {
      this.timeScale = Math.min(1, this.timeScale + dt * 3);
    }

    // Boss 台词计时
    if (this.bossQuoteTimer > 0) {
      this.bossQuoteTimer -= dt;
      if (this.bossQuoteTimer <= 0) this.bossQuote = null;
    }

    // 粒子更新
    this.particles = this.particles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt;
      return p.life > 0;
    });

    // 飘字更新
    this.damageTexts = this.damageTexts.filter(t => {
      t.y += t.vy * dt;
      t.x += (t.vx || 0) * dt;
      t.life -= dt;
      return t.life > 0;
    });

    // 作业本更新（吴老师）
    this._updateHomeworkBooks(dt);

    // 场景互动物动画
    for (const it of this.interactables) {
      if (it.hitAnim > 0) it.hitAnim = Math.max(0, it.hitAnim - dt * 0.8);
    }

    // 弹丸更新（所有状态下都更新，修复 Boss 射击不飞的 bug）
    const projDt = dt * this.timeScale;
    if (this.state !== BS.FIRING) {
      this._updateProjectiles(projDt);
    }

    // 掉落更新（所有状态下检查，修复玩家/Boss 掉落不生效）
    this._checkGroundFall(this.player);
    for (const b of this.bossList) this._checkGroundFall(b);
    for (const m of this.minions) this._checkGroundFall(m);
    this._updateFalling(this.player, projDt);
    for (const b of this.bossList) this._updateFalling(b, projDt);
    for (const m of this.minions) this._updateFalling(m, dt);

    // 气流紊乱计时
    if (this.blurTimer > 0) this.blurTimer -= dt;
    if (this.turbulenceTimer > 0) {
      this.turbulenceTimer -= dt;
      if (this.turbulenceTimer <= 0) {
        this.wind = this._rollWind();
      }
    }

    // 状态机
    const scaledDt = dt * this.timeScale;

    switch (this.state) {
      case BS.WAITING:
        this._updateWaiting(scaledDt);
        break;
      case BS.PLAYER_TURN:
        this._updatePlayerMovement(scaledDt);
        break; // 等待输入
      case BS.PLAYER_AIMING:
        this._updatePlayerAimingState(scaledDt);
        break;
      case BS.FIRING:
        this._updateFiring(scaledDt);
        if (this.kiteAnim) this._updateKiteAnim(scaledDt);
        break;
      case BS.BOSS_TURN:
        this._updateBossTurn(scaledDt);
        break;
      case BS.BOSS_ACTING:
        this._updateBossActing(scaledDt);
        break;
      case BS.QUIZ:
        this._updateQuiz(scaledDt);
        break;
      case BS.DISCIPLINE:
        this._updateDiscipline(scaledDt);
        break;
      case BS.ENDED:
        break;
    }
  }

  _updateWaiting(dt) {
    // 更新 Boss 位置（含双胞胎）
    this.ai.updatePosition(dt);
    if (this.aiTwin) this.aiTwin.updatePosition(dt);

    // 无开场动画，直接进入玩家回合
    this._switchToPlayer();
  }

  // 回合制：切换到玩家回合
  _switchToPlayer() {
    this.atb.tickCooldowns(this.player);
    this.atb.startTurn(this.player);
    this.player.isPlayer = true;
    this.player.shotsThisTurn = 0;
    this.moveUsed = 0; // 重置移动步数
    this.state = BS.PLAYER_TURN;
    this.wind = this._rollWind();
  }

  // 回合制：切换到 Boss 回合
  _switchToBoss() {
    // 推进所有 Boss 冷却
    for (const b of this.bossList) {
      if (!b.dead) this.atb.tickCooldowns(b);
    }
    this.activeBoss = this.bossList.find(b => !b.dead) || this.bossList[0];
    this.activeAI = (this.activeBoss === this.bossTwin && this.aiTwin) ? this.aiTwin : this.ai;
    this.atb.startTurn(this.activeBoss);
    this.state = BS.BOSS_TURN;
    this.bossTurnDelay = 0.5;
  }

  // ===== 玩家输入 =====
  _onPointerDown(x, y) {
    if (this.state === BS.QUIZ) {
      this._handleQuizClick(x, y);
      return;
    }
    if (this.state === BS.DISCIPLINE) {
      // 纪律检查期间任何输入都算违规
      this.discipline.violated = true;
      return;
    }

    // 退出按钮（任何状态都可点击）
    const exitX = CONFIG.WIDTH - 60;
    const exitY = 10;
    if (x >= exitX && x <= exitX + 50 && y >= exitY && y <= exitY + 36) {
      this._exitBattle();
      return;
    }

    if (this.state !== BS.PLAYER_TURN && this.state !== BS.PLAYER_AIMING) return;

    // 检查 UI 点击（技能 / 道具 / 待机）
    if (this._handleUIClick(x, y)) return;

    // 场地任意位置按住即可开始瞄准（Q版弹射手感，不必精确点中角色）
    if (y > CONFIG.HEIGHT - 100) return; // 底部 UI 区不响应
    this.state = BS.PLAYER_AIMING;
    this._aimDragging = true;
  }

  _onPointerUp(x, y) {
    // 释放移动按钮
    this._moveBtnLeft = false;
    this._moveBtnRight = false;
    if (!this._aimDragging) return;
    this._aimDragging = false;
    if (this.state !== BS.PLAYER_AIMING) return;

    const dx = x - this.input.downX;
    const dy = y - this.input.downY;
    const dist = Math.hypot(dx, dy);

    if (dist < CONFIG.DRAG_DEADZONE) {
      // 只是点了一下，没拖：保留技能选择，回到待命
      if (this.aimMode === 'normal') this.state = BS.PLAYER_TURN;
      return;
    }
    this._firePlayerShot(dx, dy, dist);
  }

  _handleUIClick(x, y) {
    const ay = CONFIG.HEIGHT - 90;
    const skillSize = 56;
    const skillGap = 10;
    const startX = 300;

    // 技能按钮
    for (let i = 0; i < this.player.skills.length; i++) {
      const sid = this.player.skills[i];
      const skill = SKILLS[sid];
      if (!skill) continue;
      const sx = startX + i * (skillSize + skillGap);
      if (x >= sx && x <= sx + skillSize && y >= ay && y <= ay + skillSize) {
        if (!this.modState.skillAllowed) { this._floatText('本关禁用技能', '#FF6B6B'); return true; }
        if (this.status.isSilenced(this.player)) { this._floatText('被沉默', '#7B68EE'); return true; }
        if (this.player.ap < skill.ap) { this._floatText('行动力不足', '#FF6B6B'); return true; }
        this.aimMode = sid;
        this.state = BS.PLAYER_AIMING;
        return true;
      }
    }

    // 道具按钮
    const itemStartX = startX + this.player.skills.length * (skillSize + skillGap) + 30;
    const itemSize = 48;
    for (let i = 0; i < this.player.items.length; i++) {
      const iid = this.player.items[i];
      const item = ITEMS[iid];
      if (!item) continue;
      const ix = itemStartX + i * (itemSize + 10);
      const iy = ay + 4;
      if (x >= ix && x <= ix + itemSize && y >= iy && y <= iy + itemSize) {
        if (this.player.ap < item.ap) { this._floatText('行动力不足', '#FF6B6B'); return true; }
        // 风筝道具进入手动瞄准模式
        if (iid === 'kite') {
          this._pendingAimMode = 'kite';
          this.aimMode = 'kite';
          this.state = BS.PLAYER_AIMING;
          return true;
        }
        this._useItem(iid);
        return true;
      }
    }

    // 移动按钮（左下角）
    const moveBtnR = 30;
    const moveBtnLY = ay + 45;
    const moveBtnLX = 20;
    const moveBtnRX = 90;
    if (Math.hypot(x - moveBtnLX, y - moveBtnLY) <= moveBtnR) {
      this._moveBtnLeft = true;
      return true;
    }
    if (Math.hypot(x - moveBtnRX, y - moveBtnLY) <= moveBtnR) {
      this._moveBtnRight = true;
      return true;
    }

    // 大招按钮
    const ultX = 1000, ultY = ay + 2, ultW = 180, ultH = 76;
    if (x >= ultX && x <= ultX + ultW && y >= ultY && y <= ultY + ultH) {
      this._tryUseUlt();
      return true;
    }

    // 待机按钮
    const sbX = CONFIG.WIDTH - 120;
    const sbY = ay + 10;
    if (x >= sbX && x <= sbX + 100 && y >= sbY && y <= sbY + 40) {
      this._resolveDots(this.player);
      this.status.tickTurn();
      this.atb.standby(this.player);
      // 回合制：待机后切换到 Boss 回合
      this._switchToBoss();
      return true;
    }

    return false;
  }

  // 小飘字
  _floatText(text, color, x, y, size) {
    this.damageTexts.push({
      x: x ?? this.player.x,
      y: y ?? (this.player.y - 70),
      text, color: color || '#FFFFFF',
      size: size || 20,
      life: 1.0, maxLife: 1.0, vy: -50, vx: 0,
    });
  }

  // 持续伤害结算
  _resolveDots(unit) {
    let total = 0;
    for (const s of this.status.statuses.slice()) {
      if (s.target === unit && s.type === 'dot' && s.duration > 0) {
        this._applyRawDamage(unit, s.value, '#8BC34A', '番茄汁');
        total += s.value;
      }
    }
    return total;
  }

  // 直接扣血（不经过弹道）
  _applyRawDamage(target, dmg, color, label) {
    if (target.dead) return;
    let d = Math.round(dmg * this.status.getDamageTakenMultiplier(target));
    const dr = this.status.getDamageReduction(target);
    d = Math.round(d * (1 - dr));
    target.hp -= d;
    if (target === this.player) this.battleStats.playerDamaged = true;
    this.damageTexts.push({
      x: target.x, y: target.y - target.radius - 20,
      text: (label ? label + ' ' : '') + d,
      color: color || '#FFFFFF', size: 22,
      life: 1.0, maxLife: 1.0, vy: -50, vx: (Math.random() - 0.5) * 20,
    });
    this.particles.push(...createHitParticles(target.x, target.y, color || '#FFF', 6));
    if (target.hp <= 0) {
      target.hp = 0;
      this._onUnitDeath(target);
    }
  }

  // 风筝手动瞄准发射
  _fireKite(angle, speed) {
    const item = ITEMS['kite'];
    if (!item) return;
    const idx = this.player.items.indexOf('kite');
    if (idx < 0) return;
    this.player.items.splice(idx, 1);
    this.atb.consumeAP(this.player, item.ap);

    // 计算落点：用弹道预测找到着陆位置
    const sx = this.player.x;
    const sy = this.player.y - this.player.radius;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const windAccelX = this.currentWind || 0;

    // 模拟完整弹道直到落地
    let landX = sx, landY = CONFIG.GROUND_Y - this.player.radius;
    let px = sx, py = sy, pvx = vx, pvy = vy;
    const simDt = 1 / 120;
    for (let i = 0; i < 600; i++) {
      pvy += CONFIG.GRAVITY * simDt;
      pvx += windAccelX * simDt;
      px += pvx * simDt;
      py += pvy * simDt;
      if (py >= CONFIG.GROUND_Y || px < 0 || px > CONFIG.WIDTH) {
        landX = Math.max(60, Math.min(CONFIG.WIDTH - 60, px));
        landY = CONFIG.GROUND_Y - this.player.radius;
        break;
      }
      landX = Math.max(60, Math.min(CONFIG.WIDTH - 60, px));
      landY = py;
    }

    // 启动风筝飞行动画
    this.kiteAnim = {
      startX: sx,
      startY: sy,
      endX: landX,
      endY: landY,
      t: 0,
      duration: 0.8,
    };
    this.player.x = landX; // 逻辑位置立即更新（用于碰撞）
    this.player.y = landY;
    this.state = BS.FIRING;
    this.atb.freeze();
    this.audio.play('hit');
    this._floatText('风筝!', '#29B6F6', sx, sy - 40, 24);
    this.particles.push(...createHitParticles(sx, sy, '#29B6F6', 12, 1.5));
  }

  _useItem(iid) {
    const item = ITEMS[iid];
    if (!item) return;
    const idx = this.player.items.indexOf(iid);
    if (idx >= 0) this.player.items.splice(idx, 1);
    this.atb.consumeAP(this.player, item.ap);

    const lv = (this.saveData.itemLevels && this.saveData.itemLevels[iid]) || 1;
    const itemMul = itemEffectMul(item, lv) * (1 + (this.talent.itemPct || 0) / 100);

    switch (item.type) {
      case 'displace': {
        const dist = item.distance || 180;
        this.player.x = Math.max(80, Math.min(CONFIG.WIDTH - 80, this.player.x + dist));
        this._floatText('位移 ' + dist, '#29B6F6');
        break;
      }
      case 'stealth':
        this.status.add(this.player, 'stealth', item.duration || 1, Math.min(0.7, (item.value || 0.5) * itemMul));
        this._floatText('隐身', '#4ECDC4');
        break;
      case 'lock_single': {
        const target = this._nearestEnemy();
        if (target) {
          this.status.add(target, 'lock', item.duration || 1, 0);
          this._floatText('锁定 ' + target.name, '#7E57C2');
        }
        break;
      }
      case 'lock_all':
        for (const b of this.bossList) {
          if (!b.dead) this.status.add(b, 'lock', item.duration || 1, 0);
        }
        for (const m of this.minions) {
          if (!m.dead) this.status.add(m, 'lock', item.duration || 1, 0);
        }
        this._floatText('全部锁定', '#5E35B1');
        break;
      case 'shield':
        this.status.add(this.player, 'shield', item.duration || 2, Math.min(0.7, (item.value || 0.4) * itemMul));
        this._floatText('守护盾', '#4169E1');
        break;
      case 'gamble': {
        if (Math.random() < (item.chance || 0.5)) {
          const heal = Math.round(this.player.maxHp * (item.healRatio || 0.3) * itemMul);
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
          this._floatText('+' + heal, '#8BC34A');
        } else {
          this.status.add(this.player, 'vulnerable', 2, 0);
          this._floatText('受伤翻倍!', '#FF3333', this.player.x, this.player.y - 70, 24);
        }
        break;
      }
      case 'reflect':
        this.status.add(this.player, 'reflect', item.duration || 2, Math.min(0.8, (item.value || 0.45) * itemMul));
        this._floatText('反射盾', '#FF7043');
        break;
      case 'rage': {
        const gain = Math.round((item.value || 35) * itemMul);
        this.player.rage = Math.min(RAGE_MAX, (this.player.rage || 0) + gain);
        this._floatText('怒气 +' + gain, '#FF4500');
        break;
      }
      case 'heal_single':
      case 'heal_group': {
        if (!this.modState.healAllowed) {
          this._floatText('本关禁止治疗', '#9E9E9E');
          break;
        }
        const heal = Math.round(this.player.maxHp * (item.healRatio || 0.3) * itemMul);
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
        this._floatText('+' + heal, '#66BB6A', this.player.x, this.player.y - 70, 26);
        if (item.cleanse) {
          this.status.cleanse(this.player);
          this._floatText('净化', '#66BB6A', this.player.x, this.player.y - 100, 20);
        }
        break;
      }
      default:
        break;
    }

    this.audio.play('button');
    // 用道具不结束回合，还能继续弹射
    this.state = BS.PLAYER_TURN;
  }

  _nearestEnemy() {
    let best = null, bd = Infinity;
    for (const b of this.bossList) {
      if (b.dead) continue;
      const d = Math.abs(b.x - this.player.x);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // ===== 玩家瞄准 & 发射 =====
  _updatePlayerAimingState(dt) {
    // 松手发射由 _onPointerUp 处理，这里只做空转
  }

  // ===== 玩家移动 =====
  _updatePlayerMovement(dt) {
    const p = this.player;
    if (p.dead) return;
    let dx = 0;
    if (this._moveLeft || this._moveBtnLeft) dx -= 1;
    if (this._moveRight || this._moveBtnRight) dx += 1;
    if (dx !== 0) {
      const maxMove = CONFIG.PLAYER_MOVE_MAX || 200;
      const remaining = Math.max(0, maxMove - this.moveUsed);
      if (remaining > 0) {
        const moveDist = Math.min(remaining, Math.abs(dx) * CONFIG.PLAYER_MOVE_SPEED * dt);
        p.x += Math.sign(dx) * moveDist;
        this.moveUsed += moveDist;
        p.x = Math.max(60, Math.min(CONFIG.WIDTH - 60, p.x));
        p.facing = dx > 0 ? 1 : -1;
      }
    }
    // 检查是否站在可破坏地面空洞上方 → 掉落
    this._checkGroundFall(p);
  }

  // 获取某 x 位置的有效地面 Y（用于阴影绘制和碰撞）
  _groundYAt(x) {
    const segIdx = Math.floor(x / 40);
    if (this.groundSegments && this.groundSegments[segIdx] && this.groundSegments[segIdx].destroyed) {
      return CONFIG.GROUND_Y + (this.groundSegments[segIdx].craterDepth || 0); // 坑底
    }
    return CONFIG.GROUND_Y;
  }

  // 风筝飞行动画更新
  _updateKiteAnim(dt) {
    const ka = this.kiteAnim;
    if (!ka) return;
    ka.t += dt;
    const progress = Math.min(1, ka.t / ka.duration);
    // 抛物线插值
    const easeT = progress * (2 - progress); // easeOut
    const arcX = ka.startX + (ka.endX - ka.startX) * easeT;
    // 弧线高度：最高点在中点
    const arcH = Math.abs(ka.endX - ka.startX) * 0.25 + 100;
    const arcY = ka.startY + (ka.endY - ka.startY) * easeT - arcH * Math.sin(progress * Math.PI);
    ka.renderX = arcX;
    ka.renderY = arcY;

    // 尾迹粒子
    if (Math.random() < 0.6) {
      this.particles.push(...createHitParticles(arcX, arcY, '#81D4FA', 2, 0.5));
    }

    if (progress >= 1) {
      this.kiteAnim = null;
      // 落地特效
      this.particles.push(...createHitParticles(ka.endX, ka.endY, '#29B6F6', 16, 1.5));
      this.audio.play('hit');
      this._addShake(3, 0.1);
      // 检查落地后是否站在洞上
      this._checkGroundFall(this.player);
      // 风筝使用后回到玩家回合（可继续射击或待机）
      this.state = BS.PLAYER_TURN;
      this.aimMode = 'normal';
      this.atb.unfreeze();
      // 如果没有弹丸在飞，不需要保持 FIRING 状态
      if (this.projectiles.length === 0 && this.pendingShots.length === 0) {
        // 回到玩家回合，等玩家继续操作
      }
    }
  }

  // 检查单位是否站在被破坏的地面段上方（掉入坑底，不直通地心）
  _checkGroundFall(unit) {
    if (unit.dead || unit.falling) return;
    const segIdx = Math.floor(unit.x / 40);
    const seg = this.groundSegments[segIdx];
    if (seg && seg.destroyed && seg.craterDepth > 0) {
      // 单位比坑深宽 → 掉入坑底
      if (seg.craterDepth > 20 && unit.radius > seg.w / 2) {
        unit.falling = true;
        unit.fallVy = 0;
        unit.fallTargetY = CONFIG.GROUND_Y + seg.craterDepth - unit.radius; // 坑底
      }
    }
  }

  // 更新掉落中的单位（掉到坑底，不直通地心）
  _updateFalling(unit, dt) {
    if (!unit.falling) return;
    unit.fallVy = (unit.fallVy || 0) + CONFIG.GRAVITY * dt;
    unit.y += unit.fallVy * dt;
    const targetY = unit.fallTargetY != null ? unit.fallTargetY : (CONFIG.GROUND_Y + 60 - unit.radius);
    if (unit.y >= targetY) {
      unit.y = targetY;
      const fallDmg = Math.round((unit.fallVy || 0) * 0.5);
      unit.falling = false;
      unit.fallVy = 0;
      // 掉入坑底扣血
      if (fallDmg > 0) {
        unit.hp = Math.max(0, unit.hp - fallDmg);
        this._floatText('-' + fallDmg, '#FF1744', unit.x, unit.y - 30, 20);
        if (unit.hp <= 0) this._onUnitDeath(unit);
      }
    }
  }

  _firePlayerShot(dragDx, dragDy, dist) {
    const pendingSkill = this.aimMode !== 'normal' ? SKILLS[this.aimMode] : null;
    const needAP = pendingSkill ? pendingSkill.ap : CONFIG.NORMAL_SHOT_AP;
    if (this.player.ap < needAP) {
      this._floatText('行动力不足', '#FF6B6B');
      this.aimMode = 'normal';
      this.state = BS.PLAYER_TURN;
      return;
    }
    // 每回合发射次数限制（one_shot 修饰符）
    if (this.player.shotsThisTurn >= (this.modState.maxShotsPerTurn || 99)) {
      this._floatText('本关每回合只能发射 1 次', '#FF6B6B');
      this.aimMode = 'normal';
      this.state = BS.PLAYER_TURN;
      return;
    }

    const clamped = Math.min(dist, CONFIG.DRAG_MAX);
    const ratio = (clamped - CONFIG.DRAG_DEADZONE) / (CONFIG.DRAG_MAX - CONFIG.DRAG_DEADZONE);
    const speed = CONFIG.VELOCITY_MIN + ratio * (CONFIG.VELOCITY_MAX - CONFIG.VELOCITY_MIN);
    const angle = Math.atan2(-dragDy, -dragDx);

    const aimMode = this.aimMode;
    this.aimMode = 'normal';

    // 大招手动瞄准
    if (aimMode === 'ult') {
      this._fireUlt(angle, speed);
      this.audio.play('shoot');
      this._saveBattleState();
      return;
    }

    // 风筝手动瞄准
    if (aimMode === 'kite') {
      this._fireKite(angle, speed);
      this._saveBattleState();
      return;
    }

    this.state = BS.FIRING;
    this.atb.freeze();
    this.player.shotsThisTurn++;

    if (aimMode === 'normal' || !SKILLS[aimMode]) {
      this._fireWeapon(angle, speed);
      // 普攻不消耗AP（NORMAL_SHOT_AP=0）
    } else {
      const skill = SKILLS[aimMode];
      this._fireSkill(skill, angle, speed);
      this.atb.consumeAP(this.player, skill.ap);
      // 已取消技能独立冷却
    }

    this.audio.play('shoot');
    this._saveBattleState();
  }

  // 普通弹射：按武器 fireMode 发射
  _fireWeapon(angle, speed) {
    const w = this.weaponInfo.def;
    const st = this.weaponInfo.stats || {};
    const dmg = Math.round(this.weaponInfo.damage * (1 + (st.dmg_pct || 0) / 100));
    const color = '#FFE66D';
    const opts = {
      aoeRadius: (w.aoeRadius || 0) * (1 + (st.aoe_pct || 0) / 100),
      clearsSauce: !!w.clearsSauce,
      lifesteal: (st.lifesteal || 0) / 100,
      critBonus: (st.crit_pct || 0) / 100,
      weakBonus: (st.weakpoint_pct || 0) / 100,
    };
    const mode = w.fireMode || 'single';

    if (mode === 'burst') {
      const rounds = w.rounds || 6;
      for (let i = 0; i < rounds; i++) {
        this.pendingShots.push({
          unit: this.player, angle, speed,
          dmg, color, delay: i * (w.roundInterval || 0.2),
          opts: { ...opts },
        });
      }
    } else if (mode === 'volley') {
      const rounds = w.rounds || 2;
      const per = w.shotsPerRound || 5;
      const spread = (w.spreadDeg || 10) * Math.PI / 180;
      for (let r = 0; r < rounds; r++) {
        for (let i = 0; i < per; i++) {
          const t = per > 1 ? i / (per - 1) - 0.5 : 0;
          this.pendingShots.push({
            unit: this.player, angle: angle + t * spread, speed,
            dmg, color, delay: r * 0.28 + i * 0.04,
            opts: { ...opts },
          });
        }
      }
    } else {
      this._spawnProjectile(this.player, angle, speed, dmg, color, null, null, opts);
    }
  }

  _fireSkill(skill, angle, speed) {
    const lv = this.player.skillLevels[skill.id] || 1;
    // ★ 使用 skillEffect 获取随等级提升的实际参数
    const eff = skillEffect(skill, lv);
    const dmg = Math.round(eff.damage * (1 + (this.talent.skillDmgPct || 0) / 100));
    const color = skill.color || '#FF6B6B';
    const opts = {
      effect: skill.effect || null,
      effectTurns: eff.effectTurns,
      effectValue: eff.effectValue,
      aoeRadius: eff.aoeRadius,
      isTracking: skill.type === 'tracking',
      ignoreWind: !!skill.ignoreWind,
      noSuperCrit: !!skill.noSuperCrit,
      nearFull: skill.nearFull,
      farMin: skill.farMin,
      falloffRange: skill.falloffRange,
      isSkill: true,
      skillId: skill.id,
    };

    if (skill.type === 'utility') {
      if (!this.modState.healAllowed) {
        this._floatText('本关禁止治疗', '#9E9E9E');
      } else {
        const heal = Math.round(this.player.maxHp * eff.healRatio);
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
        this._floatText('+' + heal, '#8BC34A', this.player.x, this.player.y - 70, 26);
      }
      if (skill.cleanse) this.status.cleanse(this.player);
      this.audio.play('button');
      return;
    }

    if (skill.type === 'single' || skill.type === 'tracking') {
      const target = skill.type === 'tracking' ? this._nearestEnemy() : null;
      this._spawnProjectile(this.player, angle, speed, dmg, color, target, skill, opts);
    } else if (skill.type === 'aoe') {
      if (skill.effect === 'obstacle') {
        this._placeObstacle();
      } else {
        this._spawnProjectile(this.player, angle, speed, dmg, color, null, skill, opts);
      }
    } else if (skill.type === 'multi') {
      const count = eff.count;
      for (let i = 0; i < count; i++) {
        this.pendingShots.push({
          unit: this.player, angle, speed, dmg, color,
          delay: i * (eff.interval || 0.15),
          skillData: skill, opts: { ...opts },
        });
      }
    } else if (skill.type === 'scatter') {
      const count = eff.count;
      const spread = (skill.spread || 25) * Math.PI / 180;
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) - 0.5 : 0;
        this._spawnProjectile(this.player, angle + t * spread, speed, dmg, color, null, skill, opts);
      }
    }
  }

  // 课桌障碍（desk 技能）：在玩家前方放一张课桌
  _placeObstacle() {
    const x = Math.max(80, Math.min(CONFIG.WIDTH - 160, this.player.x + 220));
    const obj = new TerrainObject({
      shape: 'rect', x, y: CONFIG.GROUND_Y - 55, w: 70, h: 55, material: 'wood',
    });
    this.terrain.push(obj);
    this.particles.push(...createHitParticles(x + 35, CONFIG.GROUND_Y - 30, '#C89B6A', 12));
    this.audio.play('destroy');
  }

  _spawnProjectile(source, angle, speed, damage, color, targetUnit, skillData, extraOpts) {
    const o = extraOpts || {};
    const r = o.radius || (skillData && skillData.type === 'aoe' ? 11 : 8);
    const px = source.x + Math.cos(angle) * (source.radius + r);
    const py = source.y - source.radius / 2 + Math.sin(angle) * (source.radius + r);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const sourceType = source === this.player ? 'player' : 'boss';
    const proj = new Projectile(px, py, vx, vy, {
      radius: r,
      color,
      damage,
      source: sourceType,
      skillData,
      isTracking: !!o.isTracking,
      trackingTarget: targetUnit || null,
    });
    proj._sourceUnit = source;
    proj.skillData = skillData || null;
    proj.opts = o;
    proj.aoeRadius = o.aoeRadius || 0;
    proj.isAOE = !!o.isAOE;
    proj.ignoreWind = !!o.ignoreWind;
    proj.noSuperCrit = !!o.noSuperCrit;
    proj.clearsSauce = !!o.clearsSauce;
    proj.lifesteal = o.lifesteal || 0;
    proj.critBonus = o.critBonus || 0;
    proj.weakBonus = o.weakBonus || 0;
    proj.effect = o.effect || null;
    proj.effectTurns = o.effectTurns || 0;
    proj.effectValue = o.effectValue || 0;
    proj.trackingTarget = targetUnit || null;
    this.projectiles.push(proj);
    return proj;
  }

  // ===== 弹丸飞行 & 碰撞 =====
  _updateFiring(dt) {
    // 处理延迟发射
    this.pendingShots = this.pendingShots.filter(ps => {
      ps.delay -= dt;
      if (ps.delay <= 0) {
        this._spawnProjectile(ps.unit, ps.angle, ps.speed, ps.dmg, ps.color, ps.target || null, ps.skillData || null, ps.opts || {});
        this.audio.play('shoot');
        return false;
      }
      return true;
    });

    // 更新弹丸
    this._updateProjectiles(dt);

    // 全部结束 → 回合结束（风筝飞行中不触发）
    if (this.projectiles.length === 0 && this.pendingShots.length === 0 && !this.kiteAnim) {
      this._onShotsComplete();
    }
  }

  // 弹丸更新（可被 _updateFiring 和主循环复用）
  _updateProjectiles(dt) {
    const units = [...this.bossList, this.player, ...this.minions];

    // 更新弹丸
    for (const proj of this.projectiles) {
      if (!proj.alive) continue;
      const windAccel = proj.ignoreWind ? 0 : this.wind.accel;
      proj.update(dt, windAccel);

      // 场景互动物
      const it = checkInteractableHit([proj], this.interactables);
      if (it) {
        this._onInteractableHit(it);
        continue;
      }
      if (!proj.alive) continue;

      // 平台分段碰撞（半球形坑）
      const platHit = checkPlatformHit(proj.x, proj.y, proj.radius, this.platforms);
      if (platHit) {
        // 半球形坑：中心段最深，左右递减
        const seg = platHit.seg;
        const plat = platHit.platform;
        const idx = platHit.segIdx;
        const craterMaxDepth = seg.h * 0.8; // 坑深不超过平台高度的80%
        const craterRadius = 2;
        for (let off = -craterRadius; off <= craterRadius; off++) {
          const s = plat.segments[idx + off];
          if (!s) continue;
          const ratio = Math.cos(Math.abs(off) / craterRadius * Math.PI / 2);
          const depth = Math.round(craterMaxDepth * ratio);
          s.craterDepth = Math.max(s.craterDepth, depth);
          if (s.craterDepth > 0) s.destroyed = true;
        }
        this.audio.play('destroy');
        this.particles.push(...createHitParticles(proj.x, proj.y, '#8D6E63', 16, 1.8));
        this._addShake(5, 0.2);
        proj.alive = false;
        continue;
      }

      // 地形 / 单位碰撞
      const hit = checkCollision(proj, this.terrain, units, this.groundSegments);
      if (hit) {
        this._handleHit(proj, hit);
        proj.alive = false;
        continue;
      }

      // 作业本（吴老师）
      for (const hw of this.homeworkBooks) {
        if (hw.collected) continue;
        const dx = proj.x - hw.x;
        const dy = proj.y - hw.y;
        if (dx * dx + dy * dy <= (hw.radius + proj.radius) * (hw.radius + proj.radius)) {
          hw.collected = true;
          this.player.ap = Math.min(this.player.apMax, this.player.ap + 1);
          this.player.rage = Math.min(RAGE_MAX, (this.player.rage || 0) + 20);
          this.status.add(this.player, 'confiscate', 1, 0);
          this._floatText('+1AP 没收!', '#FFD700', hw.x, hw.y - 20, 20);
          this.audio.play('button');
          proj.alive = false;
          break;
        }
      }
    }

    this.projectiles = this.projectiles.filter(p => p.alive);
  }

  // 场景互动物被击中
  _onInteractableHit(it) {
    this.audio.play('destroy');
    this.particles.push(...createHitParticles(it.x, it.y, it.glow || '#FFF', 16, 1.5));
    this._addShake(5, 0.2);
    if (it.effect === 'turbulence') {
      this.turbulenceTimer = 6;
      this.wind = this._rollWind();
      this._floatText('气流紊乱!', '#4FC3F7', it.x, it.y + 40, 24);
    } else if (it.effect === 'blur') {
      // 投影仪：屏幕白光 + 弹道预测线不可见
      this.blurTimer = 2.0;
      this._floatText('屏幕反光，看不清弹道!', '#FFD54F', it.x, it.y + 40, 22);
    } else if (it.effect === 'chalkDust') {
      // 黑板报：粉笔灰飘落，玩家命中 -15%，持续 3 回合
      this.status.add(this.player, 'chalkDust', 3, 0);
      this._floatText('粉笔灰弥漫，命中下降!', '#ECEFF1', it.x, it.y + 50, 22);
    }
  }

  _handleHit(proj, hit) {
    // AOE 爆炸
    if (proj.aoeRadius > 0) {
      this._explode(proj);
    }

    if (hit.type === 'terrain') {
      const t = hit.terrain;
      const material = t.material;
      const isGround = t.y >= CONFIG.GROUND_Y - 2;
      const decalMaterial = isGround ? 'ground' : material;
      const decal = createDecal(proj.x, proj.y, decalMaterial);
      if (material === 'wall' && proj.y < CONFIG.GROUND_Y && !isGround) {
        this.floatDecals.push(decal);
      } else {
        t.addDecal(proj.x, proj.y, proj.radius + 4, decal.type);
      }
      if (t.destructible) {
        const destroyed = t.takeDamage(proj.damage);
        if (destroyed) {
          this.audio.play('destroy');
          this.particles.push(...createHitParticles(proj.x, proj.y, MATERIALS[material]?.color || '#888', 12, 1.5));
        } else {
          this.audio.play('hit');
          this.particles.push(...createHitParticles(proj.x, proj.y, MATERIALS[material]?.color || '#888', 6));
        }
      } else {
        this.audio.play('hit');
        this.particles.push(...createHitParticles(proj.x, proj.y, MATERIALS[material]?.color || '#ccc', 4));
      }
      this._addShake(3, 0.1);
    } else if (hit.type === 'ground') {
      // 半球形坑：命中段最深，左右递减
      const segIdx = Math.floor(proj.x / 40);
      const seg = this.groundSegments[Math.max(0, Math.min(this.groundSegments.length - 1, segIdx))];
      if (seg && !seg.destroyed) {
        // 半球形深度分布：中心最深，左右2段递减
        const craterMaxDepth = 60; // 中心段坑深
        const craterRadius = 2; // 左右各影响2段
        for (let off = -craterRadius; off <= craterRadius; off++) {
          const s = this.groundSegments[segIdx + off];
          if (!s) continue;
          // 半球形：cos(off/radius * π/2) 的深度比例
          const ratio = Math.cos(Math.abs(off) / craterRadius * Math.PI / 2);
          const depth = Math.round(craterMaxDepth * ratio);
          s.craterDepth = Math.max(s.craterDepth, depth);
          if (s.craterDepth > 0) s.destroyed = true;
        }
        this.audio.play('destroy');
        this.particles.push(...createHitParticles(proj.x, CONFIG.GROUND_Y, CONFIG.COLORS.groundDark || '#6B5B3F', 28, 2.5));
        this._addShake(10, 0.3);
        this._checkGroundFall(this.player);
        for (const b of this.bossList) this._checkGroundFall(b);
      }
      const decal = createDecal(proj.x, CONFIG.GROUND_Y, 'ground');
      this.decals.push(decal);
    } else if (hit.type === 'unit') {
      this._dealDamageToUnit(proj, hit.unit);
    } else if (hit.type === 'weakpoint') {
      this._dealDamageToWeakpoint(proj, hit.unit, hit.weakpoint);
    }
  }

  // 范围爆炸
  _explode(proj) {
    const R = proj.aoeRadius;
    this.particles.push(...createHitParticles(proj.x, proj.y, proj.color, 22, 2.2));
    this._addShake(7, 0.25);
    this.audio.play('destroy');

    // 杀虫剂清理番茄炒蛋汤汁
    if (proj.clearsSauce) {
      const before = this.terrain.length;
      this.terrain = this.terrain.filter(t =>
        !(t.material === 'sauce' && Math.hypot(t.x + (t.w || 0) / 2 - proj.x, t.y + (t.h || 0) / 2 - proj.y) < R + 60)
      );
      if (this.terrain.length < before) {
        this._floatText('清理汤汁!', '#8BC34A', proj.x, proj.y - 30, 22);
      }
    }

    const targets = proj.source === 'player'
      ? [...this.bossList, ...this.minions]
      : [this.player];
    for (const u of targets) {
      if (u.dead) continue;
      const d = Math.hypot(u.x - proj.x, u.y - proj.y);
      if (d <= R + u.radius) {
        const falloff = Math.max(0.45, 1 - (d / (R + u.radius)) * 0.55);
        this._applyRawDamage(u, proj.damage * falloff * 0.65, proj.color, '溅射');
      }
    }
  }

  _dealDamageToUnit(proj, target) {
    const isPlayerAttack = proj.source === 'player';
    const dmgResult = calculateDamage({
      projectile: proj,
      target,
      wind: this.wind,
      skillData: proj.skillData,
      weaponData: (isPlayerAttack && !proj.skillData) ? this.weaponInfo.def : null,
      allowCrit: isPlayerAttack,
    });

    let actualDamage = dmgResult.damage;

    // 武器词条：暴击率补判
    if (isPlayerAttack && proj.critBonus > 0 && !dmgResult.isCrit) {
      if (Math.random() < proj.critBonus) {
        dmgResult.isCrit = true;
        dmgResult.critMul = CONFIG.CRIT_MUL;
        actualDamage = Math.round(actualDamage * CONFIG.CRIT_MUL);
      }
    }
    // 天赋：超暴击伤害加成
    if (dmgResult.isSuper && this.talent.superCritMul) {
      actualDamage = Math.round(actualDamage * (1 + this.talent.superCritMul / 100));
    }
    // 追踪类距离衰减
    if (proj.opts && proj.opts.nearFull !== undefined && proj.opts.farMin !== undefined) {
      const src = proj._sourceUnit || this.player;
      const dist = Math.abs(target.x - src.x);
      const range = proj.opts.falloffRange || 700;
      const ratio = Math.min(1, dist / range);
      const mul = proj.opts.nearFull + (proj.opts.farMin - proj.opts.nearFull) * ratio;
      actualDamage = Math.round(actualDamage * mul);
    }

    // 攻击力修正
    const attacker = proj._sourceUnit || null;
    if (attacker) actualDamage = Math.round(actualDamage * this.status.getAttackModifier(attacker));
    // 受伤倍率
    actualDamage = Math.round(actualDamage * this.status.getDamageTakenMultiplier(target));
    // 减伤
    const dr = this.status.getDamageReduction(target);
    actualDamage = Math.round(actualDamage * (1 - dr));

    target.hp -= actualDamage;
    if (target === this.player) this.battleStats.playerDamaged = true;

    // 怒气
    if (isPlayerAttack) {
      const rageMul = 1 + (this.talent.ragePct || 0) / 100;
      this.player.rage = Math.min(RAGE_MAX, (this.player.rage || 0) + Math.round(RAGE_GAIN.hit * rageMul));
      if (dmgResult.isSuper) this.player.rage = Math.min(RAGE_MAX, this.player.rage + RAGE_GAIN.weakpoint);
    } else {
      this.player.rage = Math.min(RAGE_MAX, (this.player.rage || 0) + RAGE_GAIN.hurt);
    }

    // 飘字 / 粒子 / 音效
    this.damageTexts.push(createDamageText(proj.x, proj.y, actualDamage, dmgResult));
    this.particles.push(...createHitParticles(proj.x, proj.y, target.color || '#FF6B6B',
      dmgResult.isSuper ? 16 : dmgResult.isCrit ? 10 : 6, dmgResult.isSuper ? 2 : 1));

    if (dmgResult.isSuper) {
      this.audio.play('superCrit');
      this._addShake(12, 0.4);
      this.timeScale = CONFIG.SUPER_CRIT_SLOWMO;
    } else if (dmgResult.isCrit) {
      this.audio.play('crit');
      this._addShake(7, 0.25);
      this.timeScale = CONFIG.SLOWMO_SCALE;
    } else {
      this.audio.play('hit');
      this._addShake(3, 0.1);
    }

    // 吸血
    if (isPlayerAttack && proj.lifesteal > 0) {
      const heal = Math.round(actualDamage * proj.lifesteal);
      if (heal > 0) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
        this._floatText('+' + heal, '#8BC34A', this.player.x, this.player.y - 90, 18);
      }
    }

    // 反射盾
    if (!isPlayerAttack) {
      const reflect = this.status.getReflectRatio(this.player);
      if (reflect > 0 && attacker) {
        const back = Math.round(actualDamage * reflect);
        if (back > 0) {
          this._applyRawDamage(attacker, back, '#FF7043', '反弹');
        }
      }
    }

    // 技能附加效果
    if (proj.effect) {
      this._applySkillEffect(proj, target, isPlayerAttack);
    }

    // 统计
    if (isPlayerAttack) {
      this.saveData.stats.totalShots = (this.saveData.stats.totalShots || 0) + 1;
      if (dmgResult.isSuper) this.saveData.stats.superCrits = (this.saveData.stats.superCrits || 0) + 1;
      if (actualDamage > (this.saveData.stats.maxSingleHit || 0)) this.saveData.stats.maxSingleHit = actualDamage;
      if (actualDamage > this.battleStats.maxSingleHit) this.battleStats.maxSingleHit = actualDamage;
    }

    // 死亡
    if (target.hp <= 0) this._onUnitDeath(target);
  }

  // 技能附加效果
  _applySkillEffect(proj, target, isPlayerAttack) {
    const eff = proj.effect;
    const turns = proj.effectTurns || 1;
    const val = proj.effectValue || 0;
    // 攻击者：玩家投射物 → 玩家是攻击者；敌人投射物 → 找到来源单位
    const attacker = isPlayerAttack ? this.player : (proj._sourceUnit || this.boss);
    switch (eff) {
      case 'silence':
        this.status.add(target, 'silence', turns, 0);
        this._floatText('沉默!', '#7B68EE', target.x, target.y - target.radius - 30, 22);
        break;
      case 'swap': {
        const px = this.player.x;
        this.player.x = target.x;
        target.x = px;
        this._floatText('换位!', '#4ECDC4', target.x, target.y - target.radius - 30, 22);
        break;
      }
      case 'knockback': {
        const dir = Math.sign(target.x - attacker.x) || 1;
        target.x = Math.max(120, Math.min(CONFIG.WIDTH - 120, target.x + dir * (val || 130)));
        this._floatText('击退!', '#FFB300', target.x, target.y - target.radius - 30, 22);
        this._addShake(6, 0.2);
        break;
      }
      case 'dot':
        this.status.add(target, 'dot', turns, val || 12);
        this._floatText('番茄汁!', '#8BC34A', target.x, target.y - target.radius - 30, 22);
        break;
      case 'root':
        this.status.add(target, 'root', turns, 0);
        this._floatText('束缚!', '#795548', target.x, target.y - target.radius - 30, 22);
        break;
      default:
        break;
    }
  }

  _dealDamageToWeakpoint(proj, bossUnit, wp) {
    const dmgResult = calculateDamage({
      projectile: proj,
      target: bossUnit,
      wind: this.wind,
      skillData: proj.skillData,
      weaponData: proj.skillData ? null : this.weaponInfo.def,
      isWeakpoint: true,
    });

    let dmg = dmgResult.damage;
    // 天赋：弱点伤害加成
    if (this.talent.weakpointPct) {
      dmg = Math.round(dmg * (1 + this.talent.weakpointPct / 100));
    }
    if (proj.weakBonus > 0) {
      dmg = Math.round(dmg * (1 + proj.weakBonus));
    }

    wp.currentHp -= dmg;
    const splash = Math.round(dmg * 0.5);
    bossUnit.hp -= splash;

    this.damageTexts.push(createDamageText(proj.x, proj.y, dmg, { ...dmgResult, isCrit: true }));
    this.particles.push(...createHitParticles(proj.x, proj.y, wp.color || '#FFCDD2', 10, 1.5));
    this.audio.play('crit');
    this._addShake(5, 0.15);

    // 怒气
    this.player.rage = Math.min(RAGE_MAX, (this.player.rage || 0) + RAGE_GAIN.hit + RAGE_GAIN.weakpoint);

    if (wp.currentHp <= 0) {
      wp.currentHp = 0;
      wp.destroyed = true;
      this.battleStats.weakpointsThisBattle++;
      this.audio.play('destroy');
      this.particles.push(...createHitParticles(proj.x, proj.y, wp.color || '#FFCDD2', 16, 2));
      this.damageTexts.push({
        x: proj.x, y: proj.y - 40,
        text: wp.name + ' 破坏!',
        color: '#FF3333', size: 28, life: 2, maxLife: 2, vy: -40, vx: 0,
      });
      if (wp.breakEffect === 'no_rollcall' && this.ai) this.ai.rollCallWarning = false;
    }

    if (bossUnit.hp <= 0) this._onUnitDeath(bossUnit);
  }

  // 单位死亡统一处理
  _onUnitDeath(target) {
    target.hp = 0;
    target.dead = true;

    // 残影机制：朱婉宁·残影受到致命伤时，切换为真身
    if (target === this.boss && target.isPhantom && !this._phantomShifted) {
      this._phantomShifted = true;
      this._floatText('残影消散...真身显现!', '#9C27B0', this.boss.x, this.boss.y - 80, 30);
      // 加载真身数据
      const trueForm = STUDENT_ENEMIES['art5'];
      if (trueForm) {
        this.boss = this._buildUnit({ ...trueForm, homeX: this.boss.x }, false);
        this.boss.isBoss = true;
        this.bossList = this.bossTwin ? [this.boss, this.bossTwin] : [this.boss];
        this.atb.register(this.boss, this.boss.speed);
        // 更新 AI 引用
        if (this.ai) this.ai._unit = this.boss;
        this.particles.push(...createHitParticles(this.boss.x, this.boss.y, '#7B1FA2', 40, 3));
        this.audio.play('destroy');
        this._addShake(0.6);
      }
      return;
    }

    if (target.isBoss) {
      this.atb.unregister(target);
      this.particles.push(...createHitParticles(target.x, target.y, target.color || '#FF6B6B', 30, 2.5));
      const alive = this.bossList.filter(b => !b.dead);
      if (alive.length === 0) {
        this.audio.play('win');
        this._endBattle(true);
      } else {
        this._floatText(target.name + ' 倒下!', '#FFD700', target.x, target.y - 60, 26);
      }
    } else if (target === this.player) {
      // 天赋：摸鱼复活
      if (this.talent.revive && !this.player.revived) {
        this.player.revived = true;
        this.player.dead = false;
        this.player.hp = Math.max(1, Math.round(this.player.maxHp * (this.talent.revive / 100)));
        this.status.add(this.player, 'immune', 1, 0);
        this._floatText('摸鱼复活!', '#66BB6A', this.player.x, this.player.y - 90, 28);
        this.audio.play('button');
        return;
      }
      this.audio.play('lose');
      this._endBattle(false);
    } else {
      this.atb.unregister(target);
    }
  }

  _onShotsComplete() {
    if (this.state === BS.ENDED) return;
    // 持续伤害结算
    const dots = this.status.tickTurn();
    for (const d of dots) {
      if (d.target && !d.target.dead) {
        this._applyRawDamage(d.target, d.damage, '#8BC34A', '番茄汁');
      }
    }
    // 天赋：每回合回血
    if (this.talent.regen && !this.player.dead) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.talent.regen);
    }
    this.status.consumeOnce(this.player, 'confiscate');
    this.atb.endAction();
    // 回合制轮换：玩家射击完毕 → 切换到 Boss 回合
    this._switchToBoss();
    this._saveBattleState();
  }

  // ===== Boss 回合 =====
  _updateBossTurn(dt) {
    if (this.bossTurnDelay > 0) {
      this.bossTurnDelay -= dt;
      return;
    }

    const ai = this.activeAI || this.ai;
    const unit = this.activeBoss || this.boss;

    // 被"不批假"锁定 → 跳过本回合
    if (this.status.isLocked(unit)) {
      this._floatText(unit.name + ' 被锁定!', '#7E57C2', unit.x, unit.y - unit.radius - 40, 24);
      this._endBossAction();
      return;
    }

    const action = ai.decideAction();
    this.bossAction = action;
    this.bossActionPhase = 0;
    this.bossActionTimer = 0;

    // ★ 小怪物（学生）不显示语音
    if (action.quote && !this.isStage) {
      this.bossQuote = action.quote;
      this.bossQuoteTimer = 2.5;
    }

    this.state = BS.BOSS_ACTING;
  }

  _updateBossActing(dt) {
    this.bossActionTimer += dt;
    const action = this.bossAction;

    switch (action.type) {
      case 'enrage':
        // 叫家长 — 召唤小怪
        if (this.bossActionPhase === 0 && this.bossActionTimer > 1) {
          this._spawnMinions();
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 2.5) {
          this._endBossAction();
        }
        break;

      case 'drag_class':
        // 拖堂 — 生成落课桌
        if (this.bossActionPhase === 0 && this.bossActionTimer > 1) {
          this._spawnDragClassDesks();
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 2) {
          this._endBossAction();
        }
        break;

      case 'roll_call_warning':
        // 举书预警 — 只亮感叹号，下回合才点名
        if (this.bossActionTimer > 1.6) {
          this._endBossAction();
        }
        break;

      case 'roll_call':
        // 点名 — 玩家被点名，下次受伤+50%
        if (this.bossActionTimer > 1.5) {
          this.status.add(this.player, 'named', 2, 0);
          this._endBossAction();
        }
        break;

      case 'paper_rage':
        // 300道题的锤炼 — 生成试卷堆
        if (this.bossActionPhase === 0 && this.bossActionTimer > 1) {
          this._spawnPaperRage();
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 2.5) {
          this._endBossAction();
        }
        break;

      case 'quiz':
        // 口答 — 进入口答状态
        if (this.bossActionTimer > 1) {
          this._startQuiz();
        }
        break;

      case 'homework':
        // 禁写作业 — 生成作业本
        if (this.bossActionPhase === 0 && this.bossActionTimer > 1) {
          this._spawnHomeworkBook();
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 2) {
          this._endBossAction();
        }
        break;

      case 'discipline':
        // 纪律检查 — 进入纪律检查状态
        if (this.bossActionTimer > 1) {
          this._startDiscipline();
        }
        break;

      case 'double_shot':
        // 学生双发
        if (this.bossActionPhase === 0 && this.bossActionTimer > 0.5) {
          const ai = this.activeAI || this.ai;
          const unit = this.activeBoss || this.boss;
          for (let k = 0; k < 2; k++) {
            const params = ai.getNormalShotParams();
            const angle = Math.atan2(params.vy, params.vx);
            const speed = Math.hypot(params.vx, params.vy);
            this.pendingShots.push({
              unit, angle, speed,
              dmg: Math.round((unit.shotBaseDamage || 10) * (unit.dmgMul || 1) * (unit.buffMul || 1)),
              color: unit.color || '#FF9999',
              delay: k * 0.28,
            });
          }
          this.audio.play('bossAtk');
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 2.0) this._endBossAction();
        break;

      case 'triple_shot':
        // 三连射
        if (this.bossActionPhase === 0 && this.bossActionTimer > 0.5) {
          const ai = this.activeAI || this.ai;
          const unit = this.activeBoss || this.boss;
          for (let k = 0; k < 3; k++) {
            const params = ai.getNormalShotParams();
            const angle = Math.atan2(params.vy, params.vx);
            const speed = Math.hypot(params.vx, params.vy);
            this.pendingShots.push({
              unit, angle, speed,
              dmg: Math.round((unit.shotBaseDamage || 10) * (unit.dmgMul || 1) * (unit.buffMul || 1) * 0.8),
              color: unit.color || '#FF9999',
              delay: k * 0.22,
            });
          }
          this.audio.play('bossAtk');
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 2.2) this._endBossAction();
        break;

      case 'shield_self': {
        const unit = this.activeBoss || this.boss;
        if (this.bossActionTimer > 1.0) {
          this.status.add(unit, 'shield', 2, 0.35);
          this._floatText(unit.name + ' 撑起了盾', '#4169E1', unit.x, unit.y - unit.radius - 40, 22);
          this._endBossAction();
        }
        break;
      }

      case 'normal_shot':
      default:
        if (this.bossActionPhase === 0 && this.bossActionTimer > 0.5) {
          const ai = this.activeAI || this.ai;
          const unit = this.activeBoss || this.boss;
          const params = ai.getNormalShotParams();
          const angle = Math.atan2(params.vy, params.vx);
          const speed = Math.hypot(params.vx, params.vy);
          const dmg = Math.round((unit.shotBaseDamage || 18) * (unit.dmgMul || 1) * (unit.buffMul || 1));
          const proj = this._spawnProjectile(unit, angle, speed, dmg, unit.color || '#FF6B6B');
          // 学生"沉默弹"机制
          if ((unit.mechanics || []).includes('silence_shot') && Math.random() < 0.35) {
            proj.effect = 'silence';
            proj.effectTurns = 2;
          }
          this.audio.play('bossAtk');
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 1.5) {
          this._endBossAction();
        }
        break;

      case 'paint_splash':
        // 吕老师：颜料范围攻击
        if (this.bossActionPhase === 0 && this.bossActionTimer > 0.5) {
          const ai = this.activeAI || this.ai;
          const unit = this.activeBoss || this.boss;
          const params = ai.getNormalShotParams();
          const angle = Math.atan2(params.vy, params.vx);
          const speed = Math.hypot(params.vx, params.vy) * 0.8;
          const dmg = Math.round((unit.shotBaseDamage || 13) * 1.6 * (unit.buffMul || 1));
          const proj = this._spawnProjectile(unit, angle, speed, dmg, unit.color || '#FF9800');
          proj.aoeRadius = 140;
          proj.isAOE = true;
          proj.effect = 'slow';
          proj.effectTurns = 2;
          this.audio.play('bossAtk');
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 2.0) this._endBossAction();
        break;

      case 'sketch_burst':
        // 吕老师：速写4连射
        if (this.bossActionPhase === 0 && this.bossActionTimer > 0.5) {
          const ai = this.activeAI || this.ai;
          const unit = this.activeBoss || this.boss;
          for (let k = 0; k < 4; k++) {
            const params = ai.getNormalShotParams();
            const angle = Math.atan2(params.vy, params.vx) + (k - 1.5) * 0.04;
            const speed = Math.hypot(params.vx, params.vy);
            this.pendingShots.push({
              unit, angle, speed,
              dmg: Math.round((unit.shotBaseDamage || 13) * 0.6 * (unit.buffMul || 1)),
              color: '#795548',
              delay: k * 0.15,
            });
          }
          this.audio.play('bossAtk');
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 2.0) this._endBossAction();
        break;

      case 'ball_throw':
        // 马老师：实心球重击
        if (this.bossActionPhase === 0 && this.bossActionTimer > 0.5) {
          const ai = this.activeAI || this.ai;
          const unit = this.activeBoss || this.boss;
          const params = ai.getNormalShotParams();
          const angle = Math.atan2(params.vy, params.vx);
          const speed = Math.hypot(params.vx, params.vy) * 0.9;
          const dmg = Math.round((unit.shotBaseDamage || 16) * 2.2 * (unit.buffMul || 1));
          const proj = this._spawnProjectile(unit, angle, speed, dmg, unit.color || '#4CAF50');
          proj.radius = 20;
          proj.effect = 'knockback';
          proj.effectValue = 180;
          this.audio.play('bossAtk');
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 2.0) this._endBossAction();
        break;

      case 'sprint_charge':
        // 马老师：冲刺冲撞
        if (this.bossActionPhase === 0 && this.bossActionTimer > 0.3) {
          const unit = this.activeBoss || this.boss;
          const target = this._nearestEnemy();
          if (target) {
            const dx = target.x - unit.x;
            const dist = Math.abs(dx);
            if (dist > 80) {
              // 冲刺
              unit.x += Math.sign(dx) * Math.min(dist - 60, 200);
              unit.x = Math.max(unit.radius, Math.min(CONFIG.WIDTH - unit.radius, unit.x));
              this._floatText('冲刺！', '#4CAF50', unit.x, unit.y - unit.radius - 30, 22);
            } else {
              // 近身冲撞
              const dmg = Math.round((unit.shotBaseDamage || 16) * 1.5 * (unit.buffMul || 1));
              target.hp -= dmg;
              if (target.hp <= 0) { target.hp = 0; target.dead = true; target.falling = true; }
              this._floatText('-' + dmg, '#FF5722', target.x, target.y - target.radius - 30, 22);
              this._addShake(8, 0.3);
              this._floatText('冲撞！', '#FF5722', target.x, target.y - target.radius - 30, 22);
              this.audio.play('hit');
            }
          }
          this.audio.play('bossAtk');
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 1.5) this._endBossAction();
        break;

      // ===== 学生敌人技能 =====
      case 'heavy_shot':
        // 高伤单发
        if (this.bossActionPhase === 0 && this.bossActionTimer > 0.5) {
          const ai = this.activeAI || this.ai;
          const unit = this.activeBoss || this.boss;
          const params = ai.getNormalShotParams();
          const angle = Math.atan2(params.vy, params.vx);
          const speed = Math.hypot(params.vx, params.vy) * 1.1;
          const dmg = Math.round((unit.shotBaseDamage || 14) * 1.8 * (unit.buffMul || 1));
          const proj = this._spawnProjectile(unit, angle, speed, dmg, '#FF5252');
          proj.radius = 14;
          this.audio.play('bossAtk');
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 1.5) this._endBossAction();
        break;

      case 'knockback_shot':
        // 击退弹
        if (this.bossActionPhase === 0 && this.bossActionTimer > 0.5) {
          const ai = this.activeAI || this.ai;
          const unit = this.activeBoss || this.boss;
          const params = ai.getNormalShotParams();
          const angle = Math.atan2(params.vy, params.vx);
          const speed = Math.hypot(params.vx, params.vy);
          const dmg = Math.round((unit.shotBaseDamage || 12) * 1.2 * (unit.buffMul || 1));
          const proj = this._spawnProjectile(unit, angle, speed, dmg, '#FF9800');
          proj.effect = 'knockback';
          proj.effectValue = 150;
          this.audio.play('bossAtk');
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 1.5) this._endBossAction();
        break;

      case 'swap_shot':
        // 换位弹
        if (this.bossActionPhase === 0 && this.bossActionTimer > 0.5) {
          const ai = this.activeAI || this.ai;
          const unit = this.activeBoss || this.boss;
          const params = ai.getNormalShotParams();
          const angle = Math.atan2(params.vy, params.vx);
          const speed = Math.hypot(params.vx, params.vy);
          const dmg = Math.round((unit.shotBaseDamage || 12) * 1.0 * (unit.buffMul || 1));
          const proj = this._spawnProjectile(unit, angle, speed, dmg, '#4ECDC4');
          proj.effect = 'swap';
          this.audio.play('bossAtk');
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 1.5) this._endBossAction();
        break;

      case 'scatter_shot':
        // 散射：5发扇形
        if (this.bossActionPhase === 0 && this.bossActionTimer > 0.5) {
          const ai = this.activeAI || this.ai;
          const unit = this.activeBoss || this.boss;
          const baseParams = ai.getNormalShotParams();
          const baseAngle = Math.atan2(baseParams.vy, baseParams.vx);
          const speed = Math.hypot(baseParams.vx, baseParams.vy);
          for (let k = -2; k <= 2; k++) {
            const angle = baseAngle + k * 0.18;
            const dmg = Math.round((unit.shotBaseDamage || 14) * 0.6 * (unit.buffMul || 1));
            this.pendingShots.push({ unit, angle, speed, dmg, color: unit.color || '#AB47BC', delay: Math.abs(k) * 0.08 });
          }
          this.audio.play('bossAtk');
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 2.0) this._endBossAction();
        break;

      case 'heal_self':
        // 自愈
        if (this.bossActionPhase === 0 && this.bossActionTimer > 0.5) {
          const unit = this.activeBoss || this.boss;
          const heal = Math.round(unit.maxHp * 0.2);
          unit.hp = Math.min(unit.maxHp, unit.hp + heal);
          this._floatText('+' + heal, '#8BC34A', unit.x, unit.y - unit.radius - 30, 22);
          this.particles.push(...createHitParticles(unit.x, unit.y - unit.radius, '#8BC34A', 16, 1.2));
          this.audio.play('hit');
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 1.5) this._endBossAction();
        break;

      case 'silence_shot':
        // 沉默弹
        if (this.bossActionPhase === 0 && this.bossActionTimer > 0.5) {
          const ai = this.activeAI || this.ai;
          const unit = this.activeBoss || this.boss;
          const params = ai.getNormalShotParams();
          const angle = Math.atan2(params.vy, params.vx);
          const speed = Math.hypot(params.vx, params.vy);
          const dmg = Math.round((unit.shotBaseDamage || 12) * 1.0 * (unit.buffMul || 1));
          const proj = this._spawnProjectile(unit, angle, speed, dmg, '#7B68EE');
          proj.effect = 'silence';
          proj.effectTurns = 2;
          this.audio.play('bossAtk');
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 1.5) this._endBossAction();
        break;

      case 'enemy_item': {
        // ★ 怪物使用道具
        const unit = this.activeBoss || this.boss;
        const itemId = action.itemId;
        const item = ITEMS[itemId];
        if (item && this.bossActionTimer > 0.8) {
          this._applyEnemyItem(unit, item);
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 1.5) this._endBossAction();
        break;
      }

      case 'enemy_stealth': {
        // ★ 盛丽文隐身
        const unit = this.activeBoss || this.boss;
        if (this.bossActionPhase === 0 && this.bossActionTimer > 0.5) {
          this.status.add(unit, 'stealth', 2, 0.4);
          this._floatText('隐身!', '#4ECDC4', unit.x, unit.y - unit.radius - 40, 24);
          // 虚化粒子
          this.particles.push(...createHitParticles(unit.x, unit.y - unit.radius, '#4ECDC4', 20, 1.5));
          this.audio.play('button');
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 1.5) this._endBossAction();
        break;
      }

      case 'heal_ally': {
        // ★ 治疗队友（双课代表关）
        const ally = this.bossTwin && !this.bossTwin.dead ? this.bossTwin : null;
        if (ally && this.bossActionPhase === 0 && this.bossActionTimer > 0.5) {
          const heal = Math.round(ally.maxHp * 0.25);
          ally.hp = Math.min(ally.maxHp, ally.hp + heal);
          this._floatText('+' + heal, '#8BC34A', ally.x, ally.y - ally.radius - 30, 22);
          this.particles.push(...createHitParticles(ally.x, ally.y - ally.radius, '#8BC34A', 16, 1.2));
          this.audio.play('hit');
          this.bossActionPhase = 1;
        }
        if (this.bossActionTimer > 1.5) this._endBossAction();
        break;
      }
    }
  }

  _endBossAction() {
    const ai = this.activeAI || this.ai;
    if (ai) ai.tickCooldowns();
    // 持续伤害结算（Boss 回合结束时）
    const dots = this.status.tickTurn();
    for (const d of dots) {
      if (d.target && !d.target.dead) {
        this._applyRawDamage(d.target, d.damage, '#8BC34A', '番茄汁');
      }
    }
    if (this.talent.regen && !this.player.dead) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.talent.regen);
    }
    this.atb.endAction();
    this.bossAction = null;
    this.bossActionPhase = 0;
    this.activeAI = null;
    this.activeBoss = null;
    // 回合制轮换：Boss 行动完毕 → 切换到玩家回合
    this._switchToPlayer();
  }

  // ===== 怪物使用道具 =====
  _applyEnemyItem(unit, item) {
    const lv = 1; // 怪物道具默认1级
    switch (item.id) {
      case 'teacher_snack':
      case 'snack': {
        const heal = Math.round(unit.maxHp * 0.3);
        unit.hp = Math.min(unit.maxHp, unit.hp + heal);
        this._floatText('+' + heal, '#8BC34A', unit.x, unit.y - unit.radius - 30, 22);
        this.particles.push(...createHitParticles(unit.x, unit.y - unit.radius, '#8BC34A', 12, 1));
        break;
      }
      case 'not_our_class': {
        this.status.add(unit, 'shield', 2, 0.4);
        this._floatText('护盾!', '#4169E1', unit.x, unit.y - unit.radius - 40, 22);
        break;
      }
      case 'what_doing': {
        unit.buffMul = (unit.buffMul || 1) * 1.5;
        this.status.add(unit, 'buff_dmg', 3, 0.5);
        this._floatText('攻击提升!', '#FF5722', unit.x, unit.y - unit.radius - 40, 22);
        break;
      }
      case 'leave': {
        this.status.add(unit, 'stealth', 2, 0.4);
        this._floatText('隐身!', '#4ECDC4', unit.x, unit.y - unit.radius - 40, 22);
        this.particles.push(...createHitParticles(unit.x, unit.y - unit.radius, '#4ECDC4', 16, 1.2));
        break;
      }
      case 'kite': {
        // 随机位移
        const dir = Math.random() < 0.5 ? -1 : 1;
        unit.x = Math.max(200, Math.min(CONFIG.WIDTH - 200, unit.x + dir * 200));
        if (unit.homeX) unit.homeX = unit.x;
        this._floatText('闪!', '#FFD54F', unit.x, unit.y - unit.radius - 40, 22);
        break;
      }
      default:
        break;
    }
  }

  // ===== 金老师机制 =====
  _spawnMinions() {
    if (!this.minions) this.minions = [];
    for (let i = 0; i < 2; i++) {
      const m = {
        team: 'enemy',
        x: this.boss.x + (i === 0 ? -60 : 60),
        y: CONFIG.GROUND_Y - MINION.radius,
        radius: MINION.radius,
        hp: MINION.hp,
        maxHp: MINION.hp,
        facing: -1,
        dr: 0,
        speed: MINION.speed,
        dead: false,
        shotDamage: MINION.shotDamage,
      };
      this.minions.push(m);
      this.atb.register(m);
    }
    this.particles.push(...createHitParticles(this.boss.x, this.boss.y, '#FF6B6B', 20, 2));
  }

  _spawnDragClassDesks() {
    for (let i = 0; i < 2; i++) {
      const x = 600 + i * 200 + Math.random() * 50;
      this.terrain.push(new TerrainObject({
        shape: 'rect', x, y: CONFIG.GROUND_Y - 50, w: 65, h: 50, material: 'wood',
      }));
    }
  }

  // ===== 韩老师机制 =====
  _spawnPaperRage() {
    const paperCount = this.boss.paperCount || CONFIG.BOSS_HAN_PAPER_COUNT || 6;
    for (let i = 0; i < paperCount; i++) {
      const x = 500 + i * 120 + Math.random() * 30;
      this.terrain.push(new TerrainObject({
        shape: 'rect', x, y: CONFIG.GROUND_Y - 35, w: 50, h: 35, material: 'paper',
      }));
    }
    this.particles.push(...createHitParticles(this.boss.x, this.boss.y, '#E0E0E0', 30, 2));
  }

  _startQuiz() {
    const q = getRandomQuestion();
    const timer = this.ai.getQuizTimer();
    this.quiz = {
      question: q.question,
      answer: q.answer,
      options: q.options,
      timer: timer,
      maxTimer: timer,
      selected: null,
      result: null,
    };
    this.state = BS.QUIZ;
  }

  _updateQuiz(dt) {
    if (!this.quiz) return;
    if (this.quiz.result === null) {
      this.quiz.timer -= dt;
      if (this.quiz.timer <= 0) {
        // 超时 — 答错
        this._onQuizAnswer(null);
      }
    } else {
      // 显示结果后 1.5 秒结束
      this.quiz.resultTimer = (this.quiz.resultTimer || 0) + dt;
      if (this.quiz.resultTimer > 1.5) {
        this.quiz = null;
        this._endBossAction();
      }
    }
  }

  _handleQuizClick(x, y) {
    if (!this.quiz || this.quiz.result !== null) return;
    const cx = CONFIG.WIDTH / 2;
    const startY = 350;
    const btnW = 300;
    const btnH = 50;
    const gap = 15;
    for (let i = 0; i < this.quiz.options.length; i++) {
      const bx = cx - btnW / 2;
      const by = startY + i * (btnH + gap);
      if (x >= bx && x <= bx + btnW && y >= by && y <= by + btnH) {
        this._onQuizAnswer(this.quiz.options[i]);
        return;
      }
    }
  }

  _onQuizAnswer(selected) {
    this.quiz.selected = selected;
    if (selected === this.quiz.answer) {
      // 答对 — 免伤 + 额外弹射
      this.quiz.result = 'correct';
      this.player.ap = Math.min(this.player.apMax, this.player.ap + 3); // 额外一次弹射
      this.status.add(this.player, 'immune', 1, 0);
      this.audio.play('button');
    } else {
      // 答错 — 受伤翻倍
      this.quiz.result = 'wrong';
      this.status.add(this.player, 'vulnerable', 2, 0);
      this.audio.play('hit');
    }
  }

  // ===== 吴老师机制 =====
  _spawnHomeworkBook() {
    const x = 400 + Math.random() * 600;
    this.homeworkBooks.push({
      x,
      y: CONFIG.GROUND_Y - 20,
      radius: 18,
      collected: false,
      life: 15, // 15秒后消失
      bounce: 0,
    });
  }

  _updateHomeworkBooks(dt) {
    this.homeworkBooks = this.homeworkBooks.filter(hw => {
      if (hw.collected) return false;
      hw.life -= dt;
      hw.bounce += dt * 3;
      return hw.life > 0;
    });
  }

  _startDiscipline() {
    this.discipline = {
      timer: this.boss.disciplineDuration || 3,
      violated: false,
    };
    this.state = BS.DISCIPLINE;
  }

  _updateDiscipline(dt) {
    if (!this.discipline) return;
    this.discipline.timer -= dt;
    if (this.discipline.timer <= 0) {
      if (this.discipline.violated) {
        // 违规 — 伤害 + 沉默
        this.player.hp -= (this.boss.disciplineDamage || 30);
        this.status.add(this.player, 'silence', 2, 0);
        this.damageTexts.push({
          x: this.player.x, y: this.player.y - 40,
          text: '违纪! -' + (this.boss.disciplineDamage || 30),
          color: '#FF3333', size: 32, life: 1.5, maxLife: 1.5, vy: -60, vx: 0,
        });
        this.audio.play('hit');
        this._addShake(8, 0.3);
        if (this.player.hp <= 0) {
          this.player.hp = 0;
          this.player.dead = true;
          this.audio.play('lose');
          this._endBattle(false);
          return;
        }
      }
      this.discipline = null;
      this._endBossAction();
    }
  }

  // ===== 小怪行动 =====
  _minionAction(minion) {
    if (minion.dead) return;
    const target = this.player;
    const bx = minion.x;
    const by = minion.y - minion.radius / 2;
    const tx = target.x + (Math.random() - 0.5) * 60;
    const ty = target.y - target.radius;
    const dx = tx - bx;
    const dy = ty - by;
    const dist = Math.hypot(dx, dy);
    const speed = MINION.shotSpeed;
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed - 80;
    const angle = Math.atan2(vy, vx);
    this._spawnProjectile(minion, angle, speed, minion.shotDamage, '#FF9999');
    this.audio.play('bossAtk');
    this.atb.endAction();
  }

  // ===== 结束战斗 =====
  _endBattle(victory) {
    if (this.state === BS.ENDED) return;
    this.state = BS.ENDED;
    this._clearBattleState();

    const save = this.saveData;
    let reward = null;

    if (victory) {
      const baseCoins = this.isStage
        ? ((this.stageCfg.reward && this.stageCfg.reward.coins) || 80)
        : 500;
      const baseExp = this.isStage
        ? ((this.stageCfg.reward && this.stageCfg.reward.exp) || 30)
        : 150;
      const coinMul = this.diff.coinMul || 1;
      const coins = Math.round(baseCoins * coinMul);
      const exp = Math.round(baseExp * coinMul);
      reward = { coins, exp };

      onBattleWin(save, {
        bossId: this.isStage ? null : this.bossId,
        stageId: this.isStage ? this.bossId : null,
        subjectId: this.isStage ? this.stageCfg.subject : null,
        difficulty: this.difficultyId,
        reward,
      });

      addExp(save, exp);
      save.stats.totalWins = (save.stats.totalWins || 0) + 1;
      if (!this.battleStats.playerDamaged) {
        save.stats.noDamageWins = (save.stats.noDamageWins || 0) + 1;
      }
      if (this.battleStats.weakpointsThisBattle > (save.stats.maxWeakpointsOneBattle || 0)) {
        save.stats.maxWeakpointsOneBattle = this.battleStats.weakpointsThisBattle;
      }
      for (const mid of this.modifierIds) {
        save.challenges.cleared[mid] = (save.challenges.cleared[mid] || 0) + 1;
      }
    } else {
      save.stats.totalLosses = (save.stats.totalLosses || 0) + 1;
    }

    const unlocked = checkAchievements(save) || [];
    persistSave(save);

    if (this.callbacks.onEnd) {
      const bossDef = BOSSES[this.bossId];
      const info = {
        reward,
        achievements: unlocked,
        bossId: this.isStage ? null : this.bossId,
        stageId: this.isStage ? this.bossId : null,
        subjectId: this.isStage ? this.stageCfg.subject : null,
        stageIndex: this.isStage ? this.stageCfg.index : null,
        name: this.isStage ? (this.stageCfg.name || '') : ((bossDef && bossDef.name) || ''),
        weakpoints: this.battleStats.weakpointsThisBattle || 0,
        maxHit: this.battleStats.maxSingleHit || 0,
        difficulty: this.difficultyId,
        modifierIds: this.modifierIds.slice(),
        challengeId: this.opts.challengeId || null,
        challengeReward: this.opts.challengeReward || null,
        challengeLabel: this.opts.challengeLabel || null,
      };
      try {
        this.callbacks.onEnd(victory, info);
      } catch (e) { console.warn('onEnd 回调异常', e); }
    }
  }

  // ===== 大招 =====
  _tryUseUlt() {
    if (this.state !== BS.PLAYER_TURN && this.state !== BS.PLAYER_AIMING) return;
    if (!canUseUlt(this.player)) {
      this._floatText('怒气不足', '#9E9E9E');
      return;
    }
    // 治疗类大招直接释放，无需瞄准
    if (this.ult.type === 'heal') {
      this._fireUlt(0, 0);
      return;
    }
    // 进入大招瞄准模式（手动瞄准）
    this._pendingAimMode = 'ult';
    this.aimMode = 'ult';
    this.state = BS.PLAYER_AIMING;
    this._aimDragging = false;
  }

  // 执行大招发射（手动瞄准方向）
  _fireUlt(angle, speed) {
    const ult = this.ult;
    resetRage(this.player);
    this.state = BS.FIRING;
    this.atb.freeze();
    this.aimMode = 'normal';
    this._pendingAimMode = null;

    if (ult.type === 'heal') {
      if (this.modState.healAllowed) {
        const heal = Math.round(this.player.maxHp * (ult.healRatio || 0.3));
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
        this._floatText('+' + heal, '#66BB6A', this.player.x, this.player.y - 90, 30);
      }
      if (ult.cleanse) this.status.cleanse(this.player);
      if (ult.immuneTurns) this.status.add(this.player, 'immune', ult.immuneTurns, 0);
      this.audio.play('win');
      this._addShake(4, 0.2);
      this._floatText(ult.name + '!', ult.color, this.player.x, this.player.y - 130, 32);
      this._onShotsComplete();
      return;
    }

    const src = this.player;
    const sp = speed;
    const ang = angle;

    const opts = {
      aoeRadius: ult.aoeRadius || 0,
      clearsSauce: !!ult.clearsSauce,
      ignoreWind: !!ult.ignoreWind,
      isTracking: ult.type === 'tracking',
      isUlt: true,
    };

    if (ult.type === 'volley') {
      const count = ult.count || 8;
      const spread = (ult.spreadDeg || 26) * Math.PI / 180;
      for (let i = 0; i < count; i++) {
        const tt = count > 1 ? i / (count - 1) - 0.5 : 0;
        this.pendingShots.push({
          unit: src, angle: ang + tt * spread, speed: sp,
          dmg: ult.damage, color: ult.color, delay: i * 0.06,
          opts: { ...opts },
        });
      }
    } else if (ult.type === 'tracking') {
      const target = this._nearestEnemy();
      const count = ult.count || 3;
      for (let i = 0; i < count; i++) {
        this.pendingShots.push({
          unit: src, angle: ang, speed: sp,
          dmg: ult.damage, color: ult.color, delay: i * 0.18,
          target, opts: { ...opts },
        });
      }
    } else {
      this._spawnProjectile(src, ang, sp, ult.damage, ult.color, null, null, opts);
    }

    this.audio.play('superCrit');
    this._addShake(14, 0.5);
    this.timeScale = 0.5;
    this._floatText(ult.name + '!', ult.color, src.x, src.y - 110, 34);
  }

  // ===== 画面震动 =====
  _addShake(intensity, duration) {
    if (intensity > this.shake.intensity) {
      this.shake.intensity = intensity;
      this.shake.duration = duration;
    }
  }

  // ============================================================
  // ===== 渲染 =====
  // ============================================================
  _render() {
    const ctx = this.ctx;
    const sx = this.shake.x;
    const sy = this.shake.y;

    ctx.save();
    ctx.translate(sx, sy);

    // 背景
    this._renderBackground(ctx);

    // 地形
    this._renderTerrain(ctx);

    // 地面贴花
    this._renderDecals(ctx);

    // 作业本（吴老师）
    this._renderHomeworkBooks(ctx);

    // 小怪
    if (this.minions) {
      for (const m of this.minions) this._renderMinion(ctx, m);
    }

    // 场景互动物
    this._renderInteractables(ctx);

    // Boss / 学生
    this._renderBossList(ctx);

    // 玩家
    if (this.kiteAnim) {
      this._renderKiteFlying(ctx);
    } else {
      this._renderPlayer(ctx);
    }

    // 弹丸
    this._renderProjectiles(ctx);

    // 瞄准辅助线
    if (this.state === BS.PLAYER_AIMING && this.blurTimer <= 0) this._renderAimLine(ctx);

    // 粒子
    this._renderParticles(ctx);

    // 飘字
    this._renderDamageTexts(ctx);

    ctx.restore();

    // HUD（不随震动偏移）
    this._renderHUD(ctx);

    // Boss 台词
    this._renderBossQuote(ctx);

    // 口答 UI
    if (this.state === BS.QUIZ) this._renderQuizUI(ctx);

    // 纪律检查 UI
    if (this.state === BS.DISCIPLINE) this._renderDisciplineUI(ctx);

    // 低血量警告
    if (this.player.hp / this.player.maxHp < 0.25 && this.state !== BS.ENDED) {
      this._renderLowHpWarning(ctx);
    }
  }

  // ===== 背景渲染（优化版）=====
  _renderBackground(ctx) {
    const cfg = BOSSES[this.bossId] || this.stageCfg || null;
    const bgColor = (cfg && cfg.color) || '#FF6B6B';
    const gy = CONFIG.GROUND_Y;

    // 渐变天空（更丰富的渐变）
    const grad = ctx.createLinearGradient(0, 0, 0, gy);
    grad.addColorStop(0, this._darkenColor(bgColor, 0.22));
    grad.addColorStop(0.3, this._darkenColor(bgColor, 0.38));
    grad.addColorStop(0.6, this._darkenColor(bgColor, 0.52));
    grad.addColorStop(1, this._darkenColor(bgColor, 0.68));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CONFIG.WIDTH, gy);

    // 远山剪影（多层视差）
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.moveTo(0, gy * 0.55);
    for (let x = 0; x <= CONFIG.WIDTH; x += 80) {
      ctx.lineTo(x, gy * 0.55 + Math.sin(x * 0.008) * 40 - 20);
    }
    ctx.lineTo(CONFIG.WIDTH, gy);
    ctx.lineTo(0, gy);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.beginPath();
    ctx.moveTo(0, gy * 0.65);
    for (let x = 0; x <= CONFIG.WIDTH; x += 60) {
      ctx.lineTo(x, gy * 0.65 + Math.cos(x * 0.012) * 30 - 15);
    }
    ctx.lineTo(CONFIG.WIDTH, gy);
    ctx.lineTo(0, gy);
    ctx.fill();

    // 云朵装饰（更立体）
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    const cloudSeeds = [[200,60],[600,90],[1100,50],[1400,100],[400,180],[900,150],[1300,70]];
    for (const [cx, cy] of cloudSeeds) {
      ctx.beginPath();
      ctx.arc(cx, cy, 32, 0, Math.PI * 2);
      ctx.arc(cx + 28, cy + 6, 26, 0, Math.PI * 2);
      ctx.arc(cx - 28, cy + 10, 24, 0, Math.PI * 2);
      ctx.arc(cx + 12, cy - 18, 22, 0, Math.PI * 2);
      ctx.arc(cx - 12, cy - 12, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // 天花板灯管（装饰）
    for (let i = 0; i < 6; i++) {
      const lx = 130 + i * 280;
      const ly = 30;
      // 灯管
      ctx.fillStyle = 'rgba(255,255,220,0.12)';
      ctx.fillRect(lx - 40, ly - 4, 80, 8);
      // 光晕
      const lightGrad = ctx.createRadialGradient(lx, ly + 4, 5, lx, ly + 4, 60);
      lightGrad.addColorStop(0, 'rgba(255,255,220,0.08)');
      lightGrad.addColorStop(1, 'rgba(255,255,220,0)');
      ctx.fillStyle = lightGrad;
      ctx.fillRect(lx - 60, ly, 120, 80);
    }

    // 黑板（远景墙上，更大更精细）
    ctx.fillStyle = '#1a3a2a';
    ctx.fillRect(480, 70, 640, 160);
    // 黑板边框
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(474, 64, 652, 8);
    ctx.fillRect(474, 228, 652, 8);
    ctx.fillRect(474, 64, 8, 172);
    ctx.fillRect(1118, 64, 8, 172);
    // 粉笔字痕迹
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('同学们好', 520, 110);
    ctx.font = '18px sans-serif';
    ctx.fillText('今天考试', 520, 145);
    ctx.fillText('不许作弊！', 520, 175);
    ctx.fillStyle = 'rgba(255,200,200,0.1)';
    ctx.font = 'italic 16px sans-serif';
    ctx.fillText('——班主任寄语', 520, 205);

    // 海报装饰（墙上）
    for (let i = 0; i < 3; i++) {
      const px = 80 + i * 520;
      const py = 320;
      ctx.fillStyle = `rgba(${i === 0 ? '255,107,107' : i === 1 ? '78,205,196' : '255,214,102'},0.08)`;
      ctx.fillRect(px, py, 100, 130);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, 100, 130);
      // 海报内容线
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let j = 0; j < 4; j++) {
        ctx.beginPath();
        ctx.moveTo(px + 10, py + 25 + j * 22);
        ctx.lineTo(px + 90, py + 25 + j * 22);
        ctx.stroke();
      }
    }

    // 窗户（远景，更精致）
    for (let i = 0; i < 4; i++) {
      const wx = 120 + i * 380;
      const wy = 100;
      const ww = 160;
      const wh = 180;
      // 窗框
      ctx.fillStyle = 'rgba(200,180,140,0.15)';
      ctx.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
      // 玻璃
      const winGrad = ctx.createLinearGradient(wx, wy, wx, wy + wh);
      winGrad.addColorStop(0, 'rgba(135,206,235,0.25)');
      winGrad.addColorStop(1, 'rgba(100,180,220,0.15)');
      ctx.fillStyle = winGrad;
      ctx.fillRect(wx, wy, ww, wh);
      // 窗户十字
      ctx.strokeStyle = 'rgba(200,180,140,0.25)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy);
      ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.moveTo(wx, wy + wh / 2);
      ctx.lineTo(wx + ww, wy + wh / 2);
      ctx.stroke();
      // 窗外远景（小树）
      ctx.fillStyle = 'rgba(100,180,100,0.1)';
      ctx.beginPath();
      ctx.arc(wx + 40, wy + wh - 20, 15, 0, Math.PI * 2);
      ctx.arc(wx + 100, wy + wh - 15, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // 背景课桌组（半透明，无碰撞）
    const deskAlpha = 0.35;
    ctx.globalAlpha = deskAlpha;
    ctx.fillStyle = '#8B7355';
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 2;
    // 玩家侧课桌
    for (let i = 0; i < 4; i++) {
      const dx = 200 + i * 80;
      const dy = gy - 55;
      ctx.fillRect(dx, dy, 64, 6);
      ctx.strokeRect(dx, dy, 64, 6);
      ctx.fillRect(dx + 3, dy + 6, 5, 38);
      ctx.fillRect(dx + 56, dy + 6, 5, 38);
    }
    // Boss 侧课桌
    for (let i = 0; i < 4; i++) {
      const dx = 880 + i * 80;
      const dy = gy - 55;
      ctx.fillRect(dx, dy, 64, 6);
      ctx.strokeRect(dx, dy, 64, 6);
      ctx.fillRect(dx + 3, dy + 6, 5, 38);
      ctx.fillRect(dx + 56, dy + 6, 5, 38);
    }
    // 讲台（背景）
    ctx.fillStyle = '#6D4C41';
    ctx.fillRect(1180, gy - 90, 140, 8);
    ctx.strokeRect(1180, gy - 90, 140, 8);
    ctx.fillRect(1184, gy - 82, 8, 82);
    ctx.fillRect(1308, gy - 82, 8, 82);
    ctx.globalAlpha = 1;

    // ===== 学科特色背景装饰（夸张化）=====
    this._renderSubjectDecor(ctx, gy);

    // 地面渲染（半球形坑：破坏段渲染为凹陷曲面，不直通地心）
    const groundThickness = CONFIG.HEIGHT - gy;
    for (const seg of this.groundSegments) {
      if (seg.destroyed && seg.craterDepth > 0) {
        // 破坏段：渲染坑底（从坑底到画布底部）
        const craterBottom = gy + seg.craterDepth;
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(seg.x, craterBottom, seg.w, 4);
        const groundGrad = ctx.createLinearGradient(0, craterBottom, 0, CONFIG.HEIGHT);
        groundGrad.addColorStop(0, '#6D4C41');
        groundGrad.addColorStop(0.3, '#5D4037');
        groundGrad.addColorStop(1, '#3E2723');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(seg.x, craterBottom + 4, seg.w, CONFIG.HEIGHT - craterBottom - 4);
        continue;
      }
      if (seg.destroyed) continue;
      // 完好段
      ctx.fillStyle = '#5D4037';
      ctx.fillRect(seg.x, gy, seg.w, 6);
      const groundGrad = ctx.createLinearGradient(0, gy, 0, CONFIG.HEIGHT);
      groundGrad.addColorStop(0, '#6D4C41');
      groundGrad.addColorStop(0.3, '#5D4037');
      groundGrad.addColorStop(1, '#3E2723');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(seg.x, gy + 6, seg.w, groundThickness - 6);
    }
    // 坑壁渲染（半球形边缘）
    for (let i = 0; i < this.groundSegments.length; i++) {
      const seg = this.groundSegments[i];
      if (!seg.destroyed || seg.craterDepth <= 0) continue;
      const prev = this.groundSegments[i - 1];
      const next = this.groundSegments[i + 1];
      const segBottom = gy + seg.craterDepth;
      // 左侧坑壁（如果左边比当前浅或完好）
      if (prev && (!prev.destroyed || (prev.craterDepth || 0) < seg.craterDepth)) {
        const prevBottom = prev.destroyed ? (gy + (prev.craterDepth || 0)) : gy;
        ctx.fillStyle = '#3E2723';
        ctx.fillRect(seg.x, prevBottom, 3, segBottom - prevBottom);
      }
      // 右侧坑壁
      if (next && (!next.destroyed || (next.craterDepth || 0) < seg.craterDepth)) {
        const nextBottom = next.destroyed ? (gy + (next.craterDepth || 0)) : gy;
        ctx.fillStyle = '#3E2723';
        ctx.fillRect(seg.x + seg.w - 3, nextBottom, 3, segBottom - nextBottom);
      }
    }
    // 地面瓷砖纹理线
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    for (const seg of this.groundSegments) {
      if (seg.destroyed) continue;
      ctx.beginPath();
      ctx.moveTo(seg.x, gy);
      ctx.lineTo(seg.x, CONFIG.HEIGHT);
      ctx.stroke();
      for (let yy = gy + 30; yy < CONFIG.HEIGHT; yy += 35) {
        ctx.beginPath();
        ctx.moveTo(seg.x, yy);
        ctx.lineTo(seg.x + seg.w, yy);
        ctx.stroke();
      }
    }

    // ===== 悬空平台渲染（半球形坑）=====
    for (const plat of this.platforms) {
      for (const seg of plat.segments) {
        if (seg.destroyed && seg.craterDepth > 0) {
          // 坑底段：从坑底渲染到段底
          const craterBottom = seg.y + seg.craterDepth;
          ctx.fillStyle = 'rgba(255,255,255,0.1)';
          ctx.fillRect(seg.x, craterBottom, seg.w, 2);
          const platGrad = ctx.createLinearGradient(0, craterBottom, 0, seg.y + seg.h);
          platGrad.addColorStop(0, '#8D6E63');
          platGrad.addColorStop(1, '#5D4037');
          ctx.fillStyle = platGrad;
          ctx.fillRect(seg.x, craterBottom + 2, seg.w, seg.y + seg.h - craterBottom - 2);
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fillRect(seg.x, seg.y + seg.h - 3, seg.w, 3);
          ctx.strokeStyle = '#3E2723';
          ctx.lineWidth = 1;
          ctx.strokeRect(seg.x, craterBottom, seg.w, seg.y + seg.h - craterBottom);
          continue;
        }
        if (seg.destroyed) continue;
        // 完好段
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(seg.x, seg.y, seg.w, 3);
        const platGrad = ctx.createLinearGradient(0, seg.y, 0, seg.y + seg.h);
        platGrad.addColorStop(0, '#8D6E63');
        platGrad.addColorStop(1, '#5D4037');
        ctx.fillStyle = platGrad;
        ctx.fillRect(seg.x, seg.y + 3, seg.w, seg.h - 3);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(seg.x, seg.y + seg.h - 3, seg.w, 3);
        ctx.strokeStyle = '#3E2723';
        ctx.lineWidth = 1;
        ctx.strokeRect(seg.x, seg.y, seg.w, seg.h);
      }
      // 坑壁渲染
      for (let i = 0; i < plat.segments.length; i++) {
        const seg = plat.segments[i];
        if (!seg.destroyed || seg.craterDepth <= 0) continue;
        const prev = plat.segments[i - 1];
        const next = plat.segments[i + 1];
        const segTop = seg.y + seg.craterDepth;
        ctx.fillStyle = '#3E2723';
        if (prev && (!prev.destroyed || (prev.craterDepth || 0) < seg.craterDepth)) {
          const prevTop = prev.destroyed ? (prev.y + (prev.craterDepth || 0)) : prev.y;
          ctx.fillRect(seg.x, prevTop, 2, segTop - prevTop);
        }
        if (next && (!next.destroyed || (next.craterDepth || 0) < seg.craterDepth)) {
          const nextTop = next.destroyed ? (next.y + (next.craterDepth || 0)) : next.y;
          ctx.fillRect(seg.x + seg.w - 2, nextTop, 2, segTop - nextTop);
        }
      }
    }
  }
  _renderSubjectDecor(ctx, gy) {
    // 统一映射到学科 key（pe/chinese/art/math/english）
    const subjectMap = { jin: 'math', han: 'chinese', wu: 'english', ding: 'art', huang: 'pe' };
    const bid = this.isStage ? (this.stageCfg.subject || 'pe') : (subjectMap[this.bossId] || this.bossId);
    ctx.save();
    ctx.globalAlpha = 0.3;

    if (bid === 'math') {
      // 数学：巨型三角尺、量角器漂浮在背景
      ctx.strokeStyle = '#FFD54F';
      ctx.lineWidth = 4;
      // 三角尺 1
      ctx.beginPath();
      ctx.moveTo(300, gy - 350);
      ctx.lineTo(500, gy - 350);
      ctx.lineTo(300, gy - 200);
      ctx.closePath();
      ctx.stroke();
      // 三角尺刻度
      ctx.lineWidth = 1;
      for (let i = 1; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(300 + i * 20, gy - 350);
        ctx.lineTo(300 + i * 20, gy - 345);
        ctx.stroke();
      }
      // 量角器
      ctx.strokeStyle = '#81C784';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(1200, gy - 250, 120, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(1080, gy - 250);
      ctx.lineTo(1320, gy - 250);
      ctx.stroke();
      // 漂浮的数字
      ctx.fillStyle = 'rgba(255,213,79,0.15)';
      ctx.font = 'bold 60px sans-serif';
      ctx.fillText('π', 800, gy - 400);
      ctx.fillText('√', 1000, gy - 500);
      ctx.fillText('∞', 600, gy - 600);
    } else if (bid === 'chinese') {
      // 语文：巨型毛笔、古诗卷轴
      ctx.strokeStyle = '#8D6E63';
      ctx.lineWidth = 6;
      // 毛笔
      ctx.beginPath();
      ctx.moveTo(200, gy - 600);
      ctx.lineTo(200, gy - 350);
      ctx.stroke();
      ctx.fillStyle = '#3E2723';
      ctx.beginPath();
      ctx.ellipse(200, gy - 360, 12, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      // 卷轴
      ctx.fillStyle = 'rgba(245,240,224,0.2)';
      ctx.fillRect(900, gy - 500, 300, 180);
      ctx.strokeStyle = 'rgba(139,107,63,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(900, gy - 500, 300, 180);
      // 竖排文字线
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(920 + i * 45, gy - 480);
        ctx.lineTo(920 + i * 45, gy - 340);
        ctx.stroke();
      }
    } else if (bid === 'english') {
      // 英语：巨型字母、词典堆
      ctx.fillStyle = 'rgba(100,181,249,0.15)';
      ctx.font = 'bold 120px sans-serif';
      ctx.fillText('ABC', 250, gy - 350);
      ctx.font = 'bold 80px sans-serif';
      ctx.fillText('Hello!', 1000, gy - 500);
      ctx.fillText('Grammar', 700, gy - 600);
      // 词典
      ctx.fillStyle = 'rgba(144,202,249,0.2)';
      ctx.strokeStyle = 'rgba(21,101,192,0.3)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(1100 + i * 5, gy - 200 - i * 30, 150, 30);
        ctx.strokeRect(1100 + i * 5, gy - 200 - i * 30, 150, 30);
      }
    } else if (bid === 'art') {
      // 美术：巨型调色盘、画笔、颜料溅射
      ctx.strokeStyle = '#E91E63';
      ctx.lineWidth = 4;
      // 调色盘
      ctx.beginPath();
      ctx.ellipse(300, gy - 400, 100, 70, 0, 0, Math.PI * 2);
      ctx.stroke();
      // 颜料点
      const colors = ['#F44336', '#FF9800', '#FFEB3B', '#4CAF50', '#2196F3', '#9C27B0'];
      for (let i = 0; i < colors.length; i++) {
        ctx.fillStyle = colors[i] + '40';
        ctx.beginPath();
        ctx.arc(250 + i * 30, gy - 420, 12, 0, Math.PI * 2);
        ctx.fill();
      }
      // 巨型画笔
      ctx.strokeStyle = '#795548';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(1100, gy - 600);
      ctx.lineTo(1100, gy - 300);
      ctx.stroke();
      ctx.fillStyle = '#E91E6340';
      ctx.beginPath();
      ctx.ellipse(1100, gy - 310, 15, 35, 0, 0, Math.PI * 2);
      ctx.fill();
      // 颜料溅射
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = colors[i % colors.length] + '20';
        ctx.beginPath();
        ctx.arc(500 + Math.random() * 600, gy - 500 + Math.random() * 200, 20 + Math.random() * 30, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (bid === 'pe') {
      // 体育：跨栏、球门、跑道
      ctx.strokeStyle = '#FF5722';
      ctx.lineWidth = 4;
      // 跨栏
      for (let i = 0; i < 3; i++) {
        const hx = 250 + i * 200;
        ctx.beginPath();
        ctx.moveTo(hx, gy - 120);
        ctx.lineTo(hx, gy - 60);
        ctx.moveTo(hx + 60, gy - 120);
        ctx.lineTo(hx + 60, gy - 60);
        ctx.moveTo(hx, gy - 120);
        ctx.lineTo(hx + 60, gy - 120);
        ctx.stroke();
      }
      // 球门
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(1100, gy - 280);
      ctx.lineTo(1100, gy - 150);
      ctx.lineTo(1300, gy - 150);
      ctx.lineTo(1300, gy - 280);
      ctx.stroke();
      // 跑道线
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 2;
      ctx.setLineDash([20, 15]);
      ctx.beginPath();
      ctx.moveTo(0, gy - 20);
      ctx.lineTo(CONFIG.WIDTH, gy - 20);
      ctx.stroke();
      ctx.setLineDash([]);
      // 巨型秒表
      ctx.strokeStyle = 'rgba(76,175,80,0.2)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(700, gy - 450, 80, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = 'bold 40px sans-serif';
      ctx.fillStyle = 'rgba(76,175,80,0.15)';
      ctx.fillText('00:00', 660, gy - 440);
    }

    ctx.restore();
  }

  _darkenColor(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
  }

  // ===== 地形渲染 =====
  _renderTerrain(ctx) {
    for (const t of this.terrain) {
      if (t.destroyed) continue;
      const mat = MATERIALS[t.material];
      const hpRatio = t.destructible ? t.hp / t.maxHp : 1;

      if (t.shape === 'rect') {
        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(t.x + 3, t.y + 3, t.w, t.h);
        // 主体
        ctx.fillStyle = mat.color;
        ctx.fillRect(t.x, t.y, t.w, t.h);
        // 描边
        ctx.strokeStyle = mat.stroke;
        ctx.lineWidth = 2;
        ctx.strokeRect(t.x, t.y, t.w, t.h);

        // 木纹纹理（wood 材质）
        if (t.material === 'wood') {
          ctx.strokeStyle = 'rgba(139,107,63,0.3)';
          ctx.lineWidth = 1;
          for (let ly = t.y + 8; ly < t.y + t.h; ly += 12) {
            ctx.beginPath();
            ctx.moveTo(t.x + 4, ly);
            ctx.lineTo(t.x + t.w - 4, ly);
            ctx.stroke();
          }
        }

        // 损坏裂纹
        if (t.destructible && hpRatio < 0.5) {
          ctx.strokeStyle = 'rgba(0,0,0,0.4)';
          ctx.lineWidth = 1.5;
          const cracks = Math.floor((1 - hpRatio) * 4);
          for (let i = 0; i < cracks; i++) {
            const sx = t.x + t.w * (0.2 + i * 0.2);
            ctx.beginPath();
            ctx.moveTo(sx, t.y);
            ctx.lineTo(sx + (Math.random() - 0.5) * 20, t.y + t.h);
            ctx.stroke();
          }
        }
      }

      // 贴花渲染
      for (const d of t.decals) {
        this._drawDecal(ctx, d);
      }
    }

    // 浮动贴花（黑板上）
    for (const d of this.floatDecals) {
      this._drawDecal(ctx, d);
    }
  }

  _drawDecal(ctx, decal) {
    const { x, y, r, seed, type } = decal;
    // seeded random for consistent shape
    const rng = this._seededRandom(seed);
    ctx.save();
    switch (type) {
      case 'crater':
        ctx.fillStyle = 'rgba(40,30,20,0.5)';
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(20,15,10,0.4)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const a = rng() * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 0.8);
          ctx.stroke();
        }
        break;
      case 'crack':
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          const a = rng() * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          let cx = x, cy = y;
          for (let j = 0; j < 3; j++) {
            cx += Math.cos(a + rng() * 0.5) * r * 0.4;
            cy += Math.sin(a + rng() * 0.5) * r * 0.4;
            ctx.lineTo(cx, cy);
          }
          ctx.stroke();
        }
        break;
      case 'chalk':
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        for (let i = 0; i < 5; i++) {
          const px = x + (rng() - 0.5) * r * 2;
          const py = y + (rng() - 0.5) * r * 2;
          ctx.beginPath();
          ctx.arc(px, py, 1 + rng() * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'paper':
        ctx.fillStyle = 'rgba(200,200,200,0.5)';
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.8, r * 0.5, rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  _seededRandom(seed) {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  _renderDecals(ctx) {
    for (const d of this.decals) {
      this._drawDecal(ctx, d);
    }
  }

  // ===== 风筝飞行中渲染 =====
  _renderKiteFlying(ctx) {
    const ka = this.kiteAnim;
    if (!ka) return;
    const rx = ka.renderX || ka.startX;
    const ry = ka.renderY || ka.startY;

    // 风筝线（从起点到当前位置）
    ctx.strokeStyle = 'rgba(41,182,246,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ka.startX, ka.startY);
    ctx.lineTo(rx, ry - 30);
    ctx.stroke();

    // 风筝图形（菱形+尾巴）
    ctx.save();
    ctx.translate(rx, ry - 50);
    ctx.rotate(Math.sin(ka.t * 8) * 0.15);
    ctx.fillStyle = '#29B6F6';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(14, 0);
    ctx.lineTo(0, 18);
    ctx.lineTo(-14, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0277BD';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 风筝十字骨架
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(0, 18);
    ctx.moveTo(-14, 0); ctx.lineTo(14, 0);
    ctx.stroke();
    // 风筝尾巴
    ctx.strokeStyle = '#FFEB3B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.quadraticCurveTo(-8, 28, 4, 36);
    ctx.quadraticCurveTo(12, 44, -4, 50);
    ctx.stroke();
    ctx.restore();

    // 玩家简化渲染（飞行姿态：手脚张开）
    const p = this.player;
    ctx.save();
    ctx.translate(rx, ry);
    // 身体（渐变球）
    const grad = ctx.createRadialGradient(-4, -6, 2, 0, 0, p.radius);
    grad.addColorStop(0, '#A5D6A7');
    grad.addColorStop(1, '#2E7D32');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-4, -3, 4, 0, Math.PI * 2);
    ctx.arc(6, -3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(-3, -2, 2, 0, Math.PI * 2);
    ctx.arc(7, -2, 2, 0, Math.PI * 2);
    ctx.fill();
    // 张嘴笑
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(1, 4, 5, 0.1, Math.PI - 0.1);
    ctx.stroke();
    // 手臂张开（飞行姿态）
    ctx.strokeStyle = '#2E7D32';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-8, 2); ctx.lineTo(-16, -6);
    ctx.moveTo(10, 2); ctx.lineTo(18, -6);
    ctx.stroke();
    ctx.restore();
  }

  // ===== 玩家渲染 =====
  _renderPlayer(ctx) {
    const p = this.player;
    if (p.dead) return;
    const x = p.x;
    const y = p.y;
    const r = p.radius;

    // 掉落状态：旋转 + 渐隐
    if (p.falling) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((Date.now() / 200) % (Math.PI * 2));
      ctx.globalAlpha = 0.7;
      ctx.translate(-x, -y);
    }

    // 阴影（检查地面是否被破坏）
    const segIdx = Math.max(0, Math.min(this.groundSegments.length - 1, Math.floor(x / 40)));
    const groundSeg = this.groundSegments[segIdx];
    if (!groundSeg || !groundSeg.destroyed) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(x, this._groundYAt(x), r * 0.8, r * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 身体（Q版圆头，渐变着色）
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
    grad.addColorStop(0, '#7FF0E8');
    grad.addColorStop(0.5, '#4ECDC4');
    grad.addColorStop(1, '#2E9A92');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.3, r * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2C8B85';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    // 书包（背后小书包，带肩带）
    ctx.strokeStyle = '#3E2723';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - p.facing * r * 0.3, y - r * 0.3);
    ctx.lineTo(x - p.facing * (r * 0.7), y + r * 0.1);
    ctx.moveTo(x - p.facing * r * 0.3, y + r * 0.1);
    ctx.lineTo(x - p.facing * (r * 0.7), y + r * 0.3);
    ctx.stroke();
    ctx.fillStyle = '#5D4037';
    ctx.beginPath();
    ctx.roundRect(x - p.facing * (r * 0.95) - r * 0.25, y - r * 0.1, r * 0.5, r * 0.6, 4);
    ctx.fill();
    ctx.strokeStyle = '#3E2723';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 书包扣
    ctx.fillStyle = '#FFD666';
    ctx.beginPath();
    ctx.arc(x - p.facing * (r * 0.95), y + r * 0.15, 3, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛（更大更可爱，根据朝向偏移）
    const eyeOff = p.facing * 3;
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(x - 7 + eyeOff, y - 5, 6, 0, Math.PI * 2);
    ctx.arc(x + 10 + eyeOff, y - 5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x - 6 + eyeOff, y - 4, 3.5, 0, Math.PI * 2);
    ctx.arc(x + 11 + eyeOff, y - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(x - 5 + eyeOff, y - 5, 1.5, 0, Math.PI * 2);
    ctx.arc(x + 12 + eyeOff, y - 5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 腮红
    ctx.fillStyle = 'rgba(255,130,130,0.3)';
    ctx.beginPath();
    ctx.ellipse(x - 10, y + 5, 5, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 14, y + 5, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 嘴巴（微笑）
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 2 + eyeOff * 0.5, y + 4, 4, 0.15, Math.PI - 0.15);
    ctx.stroke();

    // 帽子（棒球帽，更精细）
    ctx.fillStyle = '#FF5252';
    ctx.beginPath();
    ctx.arc(x, y - r * 0.75, r * 0.68, Math.PI, Math.PI * 2);
    ctx.fill();
    // 帽子高光
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.2, y - r * 0.85, r * 0.2, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#C0392B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.75, r * 0.68, Math.PI, Math.PI * 2);
    ctx.stroke();
    // 帽檐
    ctx.fillStyle = '#E55656';
    ctx.beginPath();
    ctx.ellipse(x + p.facing * r * 0.55, y - r * 0.55, r * 0.55, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#C0392B';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 帽顶徽章（五角星）
    ctx.fillStyle = '#FFE66D';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', x, y - r * 0.95);
    ctx.textAlign = 'left';

    // 状态效果图标
    if (this.status.has(p, 'shield')) {
      ctx.strokeStyle = CONFIG.COLORS.shieldBlue;
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x, y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (this.status.has(p, 'stealth')) {
      // ★ 隐身虚化特效：脉动半透明 + 残影
      const stealthVal = this.status.getValue(p, 'stealth') || 0.5;
      const pulse = 0.35 + Math.sin(this.time * 4) * 0.12;
      ctx.globalAlpha = pulse;
      // 残影效果
      ctx.shadowColor = '#4ECDC4';
      ctx.shadowBlur = 15;
    }
    if (this.status.has(p, 'named')) {
      ctx.fillStyle = '#FF3333';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', x, y - r - 20);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;

    // 瞄准指示
    if (this.state === BS.PLAYER_AIMING && this.input && this.input.isDown) {
      const dx = this.input.x - this.input.downX;
      const dy = this.input.y - this.input.downY;
      const dist = Math.hypot(dx, dy);
      if (dist > CONFIG.DRAG_DEADZONE) {
        const ratio = Math.min(1, (dist - CONFIG.DRAG_DEADZONE) / (CONFIG.DRAG_MAX - CONFIG.DRAG_DEADZONE));
        ctx.strokeStyle = `rgba(255,230,109,${0.3 + ratio * 0.5})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (p.falling) ctx.restore();
  }

  // ===== Boss 渲染 =====
  _renderBossList(ctx) {
    for (const b of this.bossList) {
      if (b.dead) continue;
      this._renderBossUnit(ctx, b);
    }
  }

  _renderBossUnit(ctx, b) {
    if (b.dead) return;
    const x = b.x;
    const y = b.y;
    const r = b.radius;

    // ★ 隐身虚化特效
    const bossStealthed = this.status && this.status.has(b, 'stealth');
    if (bossStealthed) {
      const pulse = 0.3 + Math.sin(this.time * 4) * 0.1;
      ctx.globalAlpha = pulse;
      ctx.shadowColor = '#4ECDC4';
      ctx.shadowBlur = 15;
    }

    // 掉落状态：旋转 + 渐隐
    if (b.falling) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((Date.now() / 200 + b.id) % (Math.PI * 2));
      ctx.globalAlpha = 0.7;
      ctx.translate(-x, -y);
    }

    // 阴影（仅未掉落时绘制）
    if (!b.falling) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(x, this._groundYAt(x), r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boss 主体
    ctx.fillStyle = b.color || '#FF6B6B';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this._darkenColor(b.color || '#FF6B6B', 0.7);
    ctx.lineWidth = 3;
    ctx.stroke();

    // 按 bossId 绘制不同特征
    if (this.bossId === 'jin') {
      this._drawJinFeatures(ctx, x, y, r, b);
    } else if (this.bossId === 'han') {
      this._drawHanFeatures(ctx, x, y, r, b);
    } else if (this.bossId === 'wu') {
      this._drawWuFeatures(ctx, x, y, r, b);
    } else if (this.bossId === 'ding') {
      this._drawDingFeatures(ctx, x, y, r, b);
    } else if (this.bossId === 'huang') {
      this._drawHuangFeatures(ctx, x, y, r, b);
    } else {
      this._drawStudentFeatures(ctx, x, y, r, b);
    }

    // 弱点部件
    this._renderWeakpoints(ctx, b);

    // 点名预警感叹号
    if (this.bossAction && this.bossAction.type === 'roll_call_warning') {
      const bob = Math.sin(this.time * 10) * 6;
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 56px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', x, y - r - 46 + bob);
      ctx.strokeStyle = 'rgba(255,215,0,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y - r - 46 + bob, 30, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 怒气值条（Boss 半血以下显示）
    const hpRatio = b.hp / b.maxHp;
    if (hpRatio < 0.5) {
      const barW = 60;
      const barX = x - barW / 2;
      const barY = y - r - 30;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barX, barY, barW, 6);
      ctx.fillStyle = '#FF4500';
      ctx.fillRect(barX, barY, barW * (1 - hpRatio * 2), 6);
    }

    if (b.falling) ctx.restore();
    // ★ 重置隐身特效
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
  _drawJinFeatures(ctx, x, y, r, b) {
    // 眼镜
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - 10, y - 5, 7, 0, Math.PI * 2);
    ctx.arc(x + 10, y - 5, 7, 0, Math.PI * 2);
    ctx.stroke();
    // 眼镜连接
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 5);
    ctx.lineTo(x + 3, y - 5);
    ctx.stroke();
    // 眼睛
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x - 10, y - 5, 2.5, 0, Math.PI * 2);
    ctx.arc(x + 10, y - 5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // 严肃嘴巴
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 8);
    ctx.lineTo(x + 8, y + 8);
    ctx.stroke();
    // 头发（短直发）
    ctx.fillStyle = this._darkenColor(b.color || '#FF6B6B', 0.6);
    ctx.beginPath();
    ctx.arc(x, y - r + 5, r - 3, Math.PI, 0);
    ctx.fill();
  }

  // 韩老师特征：马尾辫 + 气场
  _drawHanFeatures(ctx, x, y, r, b) {
    // 眼睛（锐利）
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(x - 10, y - 4, 4, 3, -0.3, 0, Math.PI * 2);
    ctx.ellipse(x + 10, y - 4, 4, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // 眉毛（上挑）
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 14, y - 12);
    ctx.lineTo(x - 6, y - 14);
    ctx.moveTo(x + 6, y - 14);
    ctx.lineTo(x + 14, y - 12);
    ctx.stroke();
    // 嘴巴（微微一笑）
    ctx.beginPath();
    ctx.arc(x, y + 6, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();
    // 马尾辫
    ctx.fillStyle = '#4A148C';
    ctx.beginPath();
    ctx.moveTo(x + r - 5, y - r + 10);
    ctx.quadraticCurveTo(x + r + 15, y, x + r + 8, y + 15);
    ctx.quadraticCurveTo(x + r + 5, y + 10, x + r - 5, y - r + 10);
    ctx.fill();
    // 头发
    ctx.fillStyle = '#4A148C';
    ctx.beginPath();
    ctx.arc(x, y - r + 5, r - 3, Math.PI, 0);
    ctx.fill();
    // 气场特效（粉色光环）
    if (this.ai.paperRaged) {
      ctx.strokeStyle = 'rgba(233,30,99,0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.arc(x, y, r + 8 + Math.sin(this.time * 3) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // 吴老师特征：眼镜 + 严厉
  _drawWuFeatures(ctx, x, y, r, b) {
    // 方框眼镜
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 15, y - 10, 12, 10);
    ctx.strokeRect(x + 3, y - 10, 12, 10);
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 5);
    ctx.lineTo(x + 3, y - 5);
    ctx.stroke();
    // 眼睛
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x - 9, y - 5, 2, 0, Math.PI * 2);
    ctx.arc(x + 9, y - 5, 2, 0, Math.PI * 2);
    ctx.fill();
    // 皱眉
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 14, y - 14);
    ctx.lineTo(x - 6, y - 11);
    ctx.moveTo(x + 6, y - 11);
    ctx.lineTo(x + 14, y - 14);
    ctx.stroke();
    // 紧闭嘴巴
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 8);
    ctx.lineTo(x + 6, y + 8);
    ctx.stroke();
    // 头发（背头）
    ctx.fillStyle = '#3D2B56';
    ctx.beginPath();
    ctx.arc(x, y - r + 5, r - 3, Math.PI, 0);
    ctx.fill();
    // 领带
    ctx.fillStyle = '#C0392B';
    ctx.beginPath();
    ctx.moveTo(x - 4, y + r - 5);
    ctx.lineTo(x + 4, y + r - 5);
    ctx.lineTo(x + 2, y + r + 8);
    ctx.lineTo(x, y + r + 10);
    ctx.lineTo(x - 2, y + r + 8);
    ctx.closePath();
    ctx.fill();
  }

  // 场景互动物
  _renderInteractables(ctx) {
    for (const it of this.interactables) {
      if (it.used && it.hitAnim <= 0) continue;
      const alpha = it.used ? Math.max(0.25, it.hitAnim) : 1;
      ctx.save();
      // 光晕
      const pulse = 0.5 + Math.sin(this.time * 3 + it.x) * 0.25;
      ctx.globalAlpha = alpha * (0.16 + pulse * 0.12);
      ctx.fillStyle = it.glow;
      ctx.beginPath();
      ctx.arc(it.x, it.y, it.r + 14, 0, Math.PI * 2);
      ctx.fill();
      // 主体
      ctx.globalAlpha = alpha;
      ctx.fillStyle = it.color;
      ctx.beginPath();
      ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = it.glow;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // 图标字
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.label.slice(0, 1), it.x, it.y);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
  }

  // 学生特征
  _drawStudentFeatures(ctx, x, y, r, b) {
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.15, r * 0.12, 0, Math.PI * 2);
    ctx.arc(x + r * 0.3, y - r * 0.15, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y + r * 0.12, r * 0.25, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    // 校服领子
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.4, y + r * 0.55);
    ctx.lineTo(x, y + r * 0.92);
    ctx.lineTo(x + r * 0.4, y + r * 0.55);
    ctx.closePath();
    ctx.fill();
    // 名字
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.name || '', x, y - r - 14);
    ctx.textAlign = 'left';
  }

  _drawDingFeatures(ctx, x, y, r, b) {
    // 丁老师（美术老师）：贝雷帽 + 调色盘
    // 贝雷帽
    ctx.fillStyle = '#E91E63';
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.7, r * 0.7, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#C2185B';
    ctx.beginPath();
    ctx.arc(x + r * 0.3, y - r * 0.85, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x - r * 0.28, y - r * 0.15, r * 0.12, 0, Math.PI * 2);
    ctx.arc(x + r * 0.28, y - r * 0.15, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    // 微笑
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y + r * 0.1, r * 0.28, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    // 围裙
    ctx.fillStyle = '#FFF8E1';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y + r * 0.4);
    ctx.lineTo(x + r * 0.5, y + r * 0.4);
    ctx.lineTo(x + r * 0.45, y + r * 0.95);
    ctx.lineTo(x - r * 0.45, y + r * 0.95);
    ctx.closePath();
    ctx.fill();
    // 颜料点
    const colors = ['#F44336', '#FFEB3B', '#2196F3', '#4CAF50'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.arc(x - r * 0.3 + i * r * 0.2, y + r * 0.6, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
    // 名字
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.name || '', x, y - r - 14);
    ctx.textAlign = 'left';
  }

  _drawHuangFeatures(ctx, x, y, r, b) {
    // 黄老师（体育老师）：运动头带 + 哨子
    // 头带
    ctx.fillStyle = '#FF5722';
    ctx.fillRect(x - r * 0.55, y - r * 0.5, r * 1.1, r * 0.18);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x - r * 0.15, y - r * 0.5, r * 0.3, r * 0.18);
    // 眼睛（严厉）
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x - r * 0.28, y - r * 0.15, r * 0.11, 0, Math.PI * 2);
    ctx.arc(x + r * 0.28, y - r * 0.15, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
    // 眉毛（怒）
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.4, y - r * 0.35);
    ctx.lineTo(x - r * 0.15, y - r * 0.28);
    ctx.moveTo(x + r * 0.4, y - r * 0.35);
    ctx.lineTo(x + r * 0.15, y - r * 0.28);
    ctx.stroke();
    // 嘴（喊话）
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.2, r * 0.15, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    // 运动服
    ctx.fillStyle = b.color || '#4CAF50';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.45, y + r * 0.5);
    ctx.lineTo(x + r * 0.45, y + r * 0.5);
    ctx.lineTo(x + r * 0.4, y + r * 0.95);
    ctx.lineTo(x - r * 0.4, y + r * 0.95);
    ctx.closePath();
    ctx.fill();
    // 哨子
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath();
    ctx.arc(x + r * 0.45, y + r * 0.55, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + r * 0.2, y + r * 0.5);
    ctx.lineTo(x + r * 0.35, y + r * 0.55);
    ctx.stroke();
    // 名字
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.name || '', x, y - r - 14);
    ctx.textAlign = 'left';
  }

  _renderWeakpoints(ctx, b) {
    if (!b || !b.weakpoints) return;
    for (const wp of b.weakpoints) {
      const wx = b.x + wp.offsetX;
      const wy = b.y + wp.offsetY;
      // 阴影
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.arc(wx + 2, wy + 2, wp.radius, 0, Math.PI * 2);
      ctx.fill();
      // 主体
      ctx.fillStyle = wp.destroyed ? 'rgba(100,100,100,0.3)' : wp.color;
      ctx.beginPath();
      ctx.arc(wx, wy, wp.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // HP 条
      if (!wp.destroyed) {
        const ratio = wp.currentHp / wp.hp;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(wx - wp.radius, wy + wp.radius + 3, wp.radius * 2, 4);
        ctx.fillStyle = ratio > 0.5 ? '#4CAF50' : ratio > 0.25 ? '#FFD700' : '#F44336';
        ctx.fillRect(wx - wp.radius, wy + wp.radius + 3, wp.radius * 2 * ratio, 4);
      } else {
        ctx.fillStyle = '#F44336';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('×', wx, wy + 4);
        ctx.textAlign = 'left';
      }
    }
  }

  // ===== 小怪渲染 =====
  _renderMinion(ctx, m) {
    if (m.dead) return;
    const x = m.x;
    const y = m.y;
    const r = m.radius;

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, this._groundYAt(x), r * 0.8, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FF9999';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#CC6666';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 简单五官
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x - 6, y - 3, 3, 0, Math.PI * 2);
    ctx.arc(x + 6, y - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    // HP 条
    const ratio = m.hp / m.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - r, y - r - 10, r * 2, 4);
    ctx.fillStyle = '#F44336';
    ctx.fillRect(x - r, y - r - 10, r * 2 * ratio, 4);
  }

  // ===== 作业本渲染（吴老师）=====
  _renderHomeworkBooks(ctx) {
    for (const hw of this.homeworkBooks) {
      if (hw.collected) continue;
      const yOff = Math.sin(hw.bounce) * 5;
      const x = hw.x;
      const y = hw.y + yOff;

      // 光环
      ctx.fillStyle = 'rgba(255,215,0,0.2)';
      ctx.beginPath();
      ctx.arc(x, y, hw.radius + 8, 0, Math.PI * 2);
      ctx.fill();

      // 作业本
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(x - hw.radius, y - hw.radius / 2, hw.radius * 2, hw.radius);
      ctx.strokeStyle = '#B8860B';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - hw.radius, y - hw.radius / 2, hw.radius * 2, hw.radius);
      ctx.fillStyle = '#333';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('作业', x, y + 3);
      ctx.textAlign = 'left';
    }
  }

  // ===== 弹丸渲染 =====
  _renderProjectiles(ctx) {
    for (const proj of this.projectiles) {
      // ★ 隐身对手的炮弹仅在玩家附近显示
      const sourceStealthed = proj._sourceUnit && this.status && this.status.has(proj._sourceUnit, 'stealth');
      if (sourceStealthed) {
        const distToPlayer = Math.hypot(proj.x - this.player.x, proj.y - this.player.y);
        if (distToPlayer > 280) continue; // 玩家280px外不渲染
        // 近距离时半透明渲染
        ctx.globalAlpha = 0.5;
      }
      // 轨迹
      if (proj.trail.length > 1) {
        ctx.globalAlpha = (sourceStealthed ? 0.15 : 0.3);
        ctx.strokeStyle = proj.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < proj.trail.length; i++) {
          const t = proj.trail[i];
          if (i === 0) ctx.moveTo(t.x, t.y);
          else ctx.lineTo(t.x, t.y);
        }
        ctx.stroke();
        ctx.globalAlpha = sourceStealthed ? 0.5 : 1;
      }
      // 弹丸
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
      ctx.fill();
      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(proj.x - 2, proj.y - 2, proj.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ===== 瞄准辅助线 =====
  _renderAimLine(ctx) {
    if (!this._aimDragging || !this.input || !this.input.isDown) return;
    const dx = this.input.x - this.input.downX;
    const dy = this.input.y - this.input.downY;
    const dist = Math.hypot(dx, dy);
    if (dist < CONFIG.DRAG_DEADZONE) return;

    const clamped = Math.min(dist, CONFIG.DRAG_MAX);
    const ratio = (clamped - CONFIG.DRAG_DEADZONE) / (CONFIG.DRAG_MAX - CONFIG.DRAG_DEADZONE);
    const speed = CONFIG.VELOCITY_MIN + ratio * (CONFIG.VELOCITY_MAX - CONFIG.VELOCITY_MIN);
    const angle = Math.atan2(-dy, -dx);

    const startX = this.player.x + Math.cos(angle) * (this.player.radius + 8);
    const startY = this.player.y - this.player.radius / 2 + Math.sin(angle) * (this.player.radius + 8);

    // 逐帧模拟，截断为部分轨迹（只显示前段弹道）
    const step = 1 / 60;
    const maxPoints = CONFIG.PREDICT_POINTS; // 截断点数
    const pts = [];
    let px = startX, py = startY;
    let pvx = Math.cos(angle) * speed, pvy = Math.sin(angle) * speed;
    const units = [this.boss, ...(this.minions || [])];
    let stop = null;
    let hitUnit = false;

    for (let i = 0; i < maxPoints; i++) {
      pvy += CONFIG.GRAVITY * step;
      pvx += this.wind.accel * step;
      px += pvx * step;
      py += pvy * step;
      pts.push({ x: px, y: py });

      if (py >= CONFIG.GROUND_Y) {
        // 检查可破坏地面分段
        const segIdx = Math.max(0, Math.min(this.groundSegments.length - 1, Math.floor(px / 40)));
        const seg = this.groundSegments[segIdx];
        if (!seg || !seg.destroyed) { stop = { x: px, y: CONFIG.GROUND_Y }; break; }
        // 分段被破坏，弹道继续穿过
      }
      if (px < -40 || px > CONFIG.WIDTH + 40) { stop = { x: px, y: py }; break; }

      let blocked = false;
      for (const t of this.terrain) {
        if (t.destroyed) continue;
        if (t.hitTest(px, py, 6)) { stop = { x: px, y: py }; blocked = true; break; }
      }
      if (blocked) break;

      for (const u of units) {
        if (!u || u.dead) continue;
        if (Math.hypot(px - u.x, py - u.y) <= u.radius + 6) {
          stop = { x: px, y: py }; hitUnit = true; blocked = true; break;
        }
      }
      if (blocked) break;
    }

    // 虚线弹道
    ctx.save();
    ctx.strokeStyle = hitUnit ? 'rgba(255,107,107,0.85)' : 'rgba(255,230,109,0.75)';
    ctx.lineWidth = 3;
    ctx.setLineDash([9, 7]);
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 落点标记
    if (stop) {
      ctx.strokeStyle = hitUnit ? '#FF6B6B' : '#FFE66D';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(stop.x, stop.y, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(stop.x - 20, stop.y); ctx.lineTo(stop.x - 8, stop.y);
      ctx.moveTo(stop.x + 8, stop.y); ctx.lineTo(stop.x + 20, stop.y);
      ctx.moveTo(stop.x, stop.y - 20); ctx.lineTo(stop.x, stop.y - 8);
      ctx.moveTo(stop.x, stop.y + 8); ctx.lineTo(stop.x, stop.y + 20);
      ctx.stroke();
      if (hitUnit) {
        ctx.fillStyle = 'rgba(255,107,107,0.9)';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('命中', stop.x, stop.y - 26);
        ctx.textAlign = 'left';
      }
    }

    // 力度条（角色上方）
    const barW = 110, barH = 12;
    const barX = this.player.x - barW / 2;
    const barY = this.player.y - this.player.radius - 46;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(barX - 3, barY - 3, barW + 6, barH + 6);
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, '#4ECDC4');
    grad.addColorStop(0.6, '#FFE66D');
    grad.addColorStop(1, '#FF6B6B');
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barW * ratio, barH);
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('力度 ' + Math.round(ratio * 100) + '%', this.player.x, barY - 8);
    ctx.textAlign = 'left';

    // 技能名提示
    if (this.aimMode !== 'normal' && SKILLS[this.aimMode]) {
      const sk = SKILLS[this.aimMode];
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(this.player.x - 70, barY + 22, 140, 26);
      ctx.fillStyle = sk.color;
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sk.name, this.player.x, barY + 40);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  // ===== 粒子渲染 =====
  _renderParticles(ctx) {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ===== 飘字渲染 =====
  _renderDamageTexts(ctx) {
    for (const t of this.damageTexts) {
      const alpha = Math.min(1, t.life / t.maxLife * 1.5);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t.color;
      ctx.font = `bold ${t.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
  }

  // ===== HUD =====
  _renderHUD(ctx) {
    // 玩家 HP 条
    this._drawBar(ctx, 20, 20, 200, 20, this.player.hp / this.player.maxHp, CONFIG.COLORS.hpGreen, CONFIG.COLORS.hpRed, 'HP');
    // 玩家 AP
    this._drawAPBar(ctx, 20, 48, 200, 16, this.player.ap / this.player.apMax);
    // 怒气条
    this._drawBar(ctx, 20, 70, 200, 12, this.player.rage / CONFIG.RAGE_MAX, CONFIG.COLORS.rageBar, '#333', 'RAGE');

    // 难度 / 挑战条件标签
    const dName = (CONFIG.DIFFICULTIES[this.difficultyId] || {}).name || '';
    const tags = [];
    if (dName && this.difficultyId !== 'normal') tags.push(dName);
    for (const id of this.modifierIds) {
      const m = MODIFIERS[id];
      if (m) tags.push(m.name);
    }
    if (tags.length) {
      ctx.font = 'bold 12px sans-serif';
      let tx = 20;
      const ty = 110;
      for (const t of tags) {
        const tw = ctx.measureText(t).width + 16;
        ctx.fillStyle = 'rgba(255,82,82,0.25)';
        ctx.fillRect(tx, ty, tw, 20);
        ctx.strokeStyle = 'rgba(255,138,101,0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, ty, tw, 20);
        ctx.fillStyle = '#FFCCBC';
        ctx.textAlign = 'center';
        ctx.fillText(t, tx + tw / 2, ty + 14);
        ctx.textAlign = 'left';
        tx += tw + 6;
      }
    }

    // Boss HP 条（顶部，支持多目标）
    const list = this.bossList || [this.boss];
    const bw = list.length > 1 ? 380 : 500;
    const bgap = 20;
    const totalW = list.length * bw + (list.length - 1) * bgap;
    let bx = CONFIG.WIDTH / 2 - totalW / 2;
    const by = 20;
    for (const u of list) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx - 5, by - 5, bw + 10, 37);
      ctx.fillStyle = u.dead ? '#888' : '#FFF';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${u.name || 'Boss'}${u.title ? ' · ' + u.title : ''}${u.dead ? '（已倒下）' : ''}`, bx + bw / 2, by + 12);
      ctx.textAlign = 'left';
      this._drawBar(ctx, bx, by + 16, bw, 12, Math.max(0, u.hp) / u.maxHp, CONFIG.COLORS.hpRed, '#333');
      bx += bw + bgap;
    }

    // 风向
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(CONFIG.WIDTH - 180, 20, 160, 30);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this._windLabel(), CONFIG.WIDTH - 100, 40);
    ctx.textAlign = 'left';

    // 回合提示
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px sans-serif';
    let turnText = '';
    switch (this.state) {
      case BS.WAITING: turnText = '...'; break;
      case BS.PLAYER_TURN: turnText = '你的回合 — 按住场地往后拉松手发射 | A/D或方向键移动'; break;
      case BS.PLAYER_AIMING: turnText = this.aimMode === 'ult' ? '大招瞄准 — 拖拽方向，松手释放' : this.aimMode === 'kite' ? '风筝瞄准 — 拖拽方向，松手飞过去' : this.aimMode === 'normal' ? '拖拽瞄准，松手发射' : '技能已选中 — 拖拽瞄准，松手发射'; break;
      case BS.FIRING: turnText = ''; break;
      case BS.BOSS_TURN: case BS.BOSS_ACTING: turnText = `${(this.activeBoss || this.boss).name || 'Boss'} 的回合`; break;
      case BS.QUIZ: turnText = '口答时间！'; break;
      case BS.DISCIPLINE: turnText = '纪律检查 — 不要操作！'; break;
      case BS.ENDED: turnText = ''; break;
    }
    if (turnText) {
      ctx.textAlign = 'center';
      ctx.fillText(turnText, CONFIG.WIDTH / 2, CONFIG.HEIGHT - 105);
      ctx.textAlign = 'left';
    }

    // 技能栏
    this._renderActionBar(ctx);
  }

  _drawBar(ctx, x, y, w, h, ratio, color, bg, label = '') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
    if (label) {
      ctx.fillStyle = '#FFF';
      ctx.font = `bold ${h - 4}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(`${label} ${Math.round(ratio * 100)}%`, x + 4, y + h - 3);
    }
  }

  _drawAPBar(ctx, x, y, w, h, ratio) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, w, h);
    // AP 格子
    const segs = CONFIG.AP_MAX;
    const segW = w / segs;
    for (let i = 0; i < segs; i++) {
      if (i < this.player.ap) {
        ctx.fillStyle = CONFIG.COLORS.apBlue;
      } else {
        ctx.fillStyle = 'rgba(33,150,243,0.2)';
      }
      ctx.fillRect(x + i * segW + 1, y + 1, segW - 2, h - 2);
    }
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(`AP ${this.player.ap}/${this.player.apMax}`, x + 4, y + h - 3);
  }

  _drawATB(ctx, x, y, w, h, ratio, color, label) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
    // 满格高亮
    if (ratio >= 0.999) {
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
    }
    if (label) {
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, x + 4, y + h - 2);
    }
  }

  _renderActionBar(ctx) {
    const y = CONFIG.HEIGHT - 90;
    const skillSize = 56;
    const skillGap = 10;
    const startX = 300;

    // 移动按钮（左下角圆形）
    const moveBtnR = 30;
    const moveBtnCY = y + 45;
    const moveLX = 20, moveRX = 90;
    // 左移按钮
    ctx.fillStyle = this._moveBtnLeft ? 'rgba(78,205,196,0.5)' : 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(moveLX, moveBtnCY, moveBtnR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4ECDC4';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('◀', moveLX, moveBtnCY + 8);
    // 右移按钮
    ctx.fillStyle = this._moveBtnRight ? 'rgba(78,205,196,0.5)' : 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(moveRX, moveBtnCY, moveBtnR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4ECDC4';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('▶', moveRX, moveBtnCY + 8);
    ctx.textAlign = 'left';

    // 技能栏
    for (let i = 0; i < this.player.skills.length; i++) {
      const sid = this.player.skills[i];
      const skill = SKILLS[sid];
      if (!skill) continue;
      const sx = startX + i * (skillSize + skillGap);
      const sy = y;
      const isReady = this.atb.isReady(this.player, sid);
      const canAfford = this.player.ap >= skill.ap;
      const isActive = this.aimMode === sid;

      ctx.fillStyle = isActive ? 'rgba(255,230,109,0.3)' : 'rgba(0,0,0,0.4)';
      ctx.fillRect(sx, sy, skillSize, skillSize);
      ctx.strokeStyle = isReady && canAfford ? '#FFE66D' : '#556270';
      ctx.lineWidth = isActive ? 3 : 1;
      ctx.strokeRect(sx, sy, skillSize, skillSize);

      ctx.fillStyle = skill.color;
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(skill.icon, sx + skillSize / 2, sy + 25);
      ctx.fillStyle = '#FFF';
      ctx.font = '9px sans-serif';
      ctx.fillText(skill.name.slice(0, 4), sx + skillSize / 2, sy + 38);
      ctx.fillStyle = '#FFE66D';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(skill.ap + 'AP', sx + skillSize / 2, sy + 50);
      ctx.textAlign = 'left';
    }

    // 道具栏
    const itemStartX = startX + this.player.skills.length * (skillSize + skillGap) + 30;
    const itemSize = 48;
    for (let i = 0; i < this.player.items.length; i++) {
      const iid = this.player.items[i];
      const item = ITEMS[iid];
      if (!item) continue;
      const ix = itemStartX + i * (itemSize + 10);
      const iy = y + 4;
      const canAfford = this.player.ap >= item.ap;

      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(ix, iy, itemSize, itemSize);
      ctx.strokeStyle = canAfford ? item.color : '#556270';
      ctx.lineWidth = 1;
      ctx.strokeRect(ix, iy, itemSize, itemSize);

      ctx.fillStyle = item.color;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.icon, ix + itemSize / 2, iy + 20);
      ctx.fillStyle = '#FFF';
      ctx.font = '8px sans-serif';
      ctx.fillText(item.name.slice(0, 3), ix + itemSize / 2, iy + 32);
      ctx.fillStyle = '#FFE66D';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(item.ap + 'AP', ix + itemSize / 2, iy + 42);
      ctx.textAlign = 'left';
    }

    // 大招按钮
    const ultX = 1000, ultY = y + 2, ultW = 180, ultH = 76;
    const ultReady = canUseUlt(this.player);
    const rageRatio = Math.min(1, (this.player.rage || 0) / RAGE_MAX);
    ctx.fillStyle = ultReady ? 'rgba(255,82,82,0.28)' : 'rgba(0,0,0,0.45)';
    ctx.fillRect(ultX, ultY, ultW, ultH);
    ctx.strokeStyle = ultReady ? '#FFD700' : '#556270';
    ctx.lineWidth = ultReady ? 3 : 1;
    ctx.strokeRect(ultX, ultY, ultW, ultH);
    ctx.fillStyle = this.ult.color;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.ult.name, ultX + ultW / 2, ultY + 30);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(ultX + 12, ultY + 42, ultW - 24, 16);
    ctx.fillStyle = ultReady ? '#FFD700' : CONFIG.COLORS.rageBar;
    ctx.fillRect(ultX + 12, ultY + 42, (ultW - 24) * rageRatio, 16);
    ctx.fillStyle = ultReady ? '#333' : '#FFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`怒气 ${Math.round(this.player.rage || 0)}/${RAGE_MAX}`, ultX + ultW / 2, ultY + 54);
    ctx.fillStyle = '#FFF';
    ctx.font = '10px sans-serif';
    ctx.fillText(ultReady ? '点击释放' : '打中/被打中攒怒气', ultX + ultW / 2, ultY + 70);
    ctx.textAlign = 'left';

    // 待机按钮
    const sbX = CONFIG.WIDTH - 120;
    const sbY = y + 10;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(sbX, sbY, 100, 40);
    ctx.strokeStyle = '#FF6B6B';
    ctx.lineWidth = 2;
    ctx.strokeRect(sbX, sbY, 100, 40);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('待机 +1AP', sbX + 50, sbY + 25);
    ctx.textAlign = 'left';

    // 退出按钮（右上角）
    const exitX = CONFIG.WIDTH - 60;
    const exitY = 10;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(exitX, exitY, 50, 36);
    ctx.strokeStyle = '#FF6B6B';
    ctx.lineWidth = 2;
    ctx.strokeRect(exitX, exitY, 50, 36);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('退出', exitX + 25, exitY + 23);
    ctx.textAlign = 'left';

    // 移动步数显示
    const maxMove = CONFIG.PLAYER_MOVE_MAX || 200;
    const moveLeft = Math.max(0, maxMove - this.moveUsed);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(120, y + 50, 80, 14);
    ctx.fillStyle = '#4ECDC4';
    ctx.fillRect(122, y + 52, 76 * (moveLeft / maxMove), 10);
    ctx.fillStyle = '#FFF';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`移动 ${Math.round(moveLeft)}`, 160, y + 60);
    ctx.textAlign = 'left';

    // 普通弹射提示
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(20, y, 260, 56);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('拖拽角色 → 普通弹射', 30, y + 22);
    ctx.fillStyle = '#FFE66D';
    ctx.font = '12px sans-serif';
    ctx.fillText(`伤害 ${Math.round(this.weaponInfo ? this.weaponInfo.damage : (this.player.weapon.baseDamage || 0))} · AP ${CONFIG.NORMAL_SHOT_AP}`, 30, y + 42);
    if (this.player.shotsThisTurn >= (this.modState.maxShotsPerTurn || 99)) {
      ctx.fillStyle = '#FF6B6B';
      ctx.fillText('本回合发射次数已用尽', 30, y + 74);
    }
  }

  // ===== Boss 台词 =====
  _renderBossQuote(ctx) {
    if (!this.bossQuote) return;
    const cx = CONFIG.WIDTH / 2;
    const cy = 120;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const text = this.bossQuote;
    ctx.font = 'bold 22px sans-serif';
    const w = ctx.measureText(text).width + 40;
    ctx.fillRect(cx - w / 2, cy - 20, w, 40);
    ctx.strokeStyle = '#FF6B6B';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - w / 2, cy - 20, w, 40);
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center';
    ctx.fillText(text, cx, cy + 8);
    ctx.textAlign = 'left';
  }

  // ===== Boss 入场 =====
  _renderBossIntro(ctx) {
    const bossCfg = BOSSES[this.bossId] || this.stageCfg || null;
    const alpha = Math.min(1, this.bossIntroTimer);
    ctx.fillStyle = `rgba(0,0,0,${alpha * 0.6})`;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = bossCfg?.color || '#FF6B6B';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(bossCfg?.name || 'Boss', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 30);
    // ★ 小怪物（学生）不显示称号和语音
    if (!this.isStage) {
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(bossCfg?.title || '', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 10);
      const introQuote = (bossCfg && bossCfg.quotes && bossCfg.quotes.intro) || (bossCfg && bossCfg.quote) || '';
      if (introQuote) {
        ctx.fillStyle = '#FFE66D';
        ctx.font = '18px sans-serif';
        ctx.fillText('"' + introQuote + '"', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 50);
      }
    }
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  // ===== 口答 UI =====
  _renderQuizUI(ctx) {
    if (!this.quiz) return;
    const cx = CONFIG.WIDTH / 2;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    // 问题面板
    const panelW = 700;
    const panelH = 400;
    const panelX = cx - panelW / 2;
    const panelY = 200;

    ctx.fillStyle = 'rgba(30,30,50,0.95)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = '#E91E63';
    ctx.lineWidth = 3;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    // 标题
    ctx.fillStyle = '#E91E63';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('韩老师口答', cx, panelY + 35);

    // 问题
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(this.quiz.question, cx, panelY + 80);

    // 选项
    const btnW = 300;
    const btnH = 50;
    const gap = 15;
    const startY = panelY + 120;
    for (let i = 0; i < this.quiz.options.length; i++) {
      const opt = this.quiz.options[i];
      const bx = cx - btnW / 2;
      const by = startY + i * (btnH + gap);

      let bg = 'rgba(255,255,255,0.1)';
      let border = '#666';
      if (this.quiz.result !== null) {
        if (opt === this.quiz.answer) {
          bg = 'rgba(76,175,80,0.3)';
          border = '#4CAF50';
        } else if (opt === this.quiz.selected) {
          bg = 'rgba(244,67,54,0.3)';
          border = '#F44336';
        }
      }
      ctx.fillStyle = bg;
      ctx.fillRect(bx, by, btnW, btnH);
      ctx.strokeStyle = border;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, btnW, btnH);
      ctx.fillStyle = '#FFF';
      ctx.font = '18px sans-serif';
      ctx.fillText(opt, cx, by + 32);
    }

    // 计时器
    if (this.quiz.result === null) {
      const timerRatio = this.quiz.timer / this.quiz.maxTimer;
      const timerW = 300;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(cx - timerW / 2, panelY + panelH - 40, timerW, 20);
      ctx.fillStyle = timerRatio > 0.3 ? '#4CAF50' : '#F44336';
      ctx.fillRect(cx - timerW / 2, panelY + panelH - 40, timerW * timerRatio, 20);
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(this.quiz.timer.toFixed(1) + 's', cx, panelY + panelH - 26);
    }

    // 结果
    if (this.quiz.result !== null) {
      ctx.font = 'bold 28px sans-serif';
      if (this.quiz.result === 'correct') {
        ctx.fillStyle = '#4CAF50';
        ctx.fillText('✓ 正确！+2AP 护盾', cx, panelY + panelH - 20);
      } else {
        ctx.fillStyle = '#F44336';
        ctx.fillText('✗ 错误！下次受伤增加', cx, panelY + panelH - 20);
      }
    }

    ctx.textAlign = 'left';
  }

  // ===== 纪律检查 UI =====
  _renderDisciplineUI(ctx) {
    if (!this.discipline) return;
    const cx = CONFIG.WIDTH / 2;
    const cy = CONFIG.HEIGHT / 2;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    // 警告框
    ctx.fillStyle = 'rgba(123,104,238,0.9)';
    ctx.fillRect(cx - 250, cy - 80, 500, 160);
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - 250, cy - 80, 500, 160);

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('纪律检查！', cx, cy - 40);
    ctx.font = '18px sans-serif';
    ctx.fillText('不要进行任何操作', cx, cy - 10);

    // 倒计时
    const t = Math.ceil(this.discipline.timer);
    ctx.font = 'bold 48px sans-serif';
    ctx.fillStyle = t <= 1 ? '#FF3333' : '#FFE66D';
    ctx.fillText(t + '', cx, cy + 40);

    // 进度条
    const barW = 400;
    const ratio = this.discipline.timer / (this.boss.disciplineDuration || 3);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(cx - barW / 2, cy + 55, barW, 8);
    ctx.fillStyle = '#7B68EE';
    ctx.fillRect(cx - barW / 2, cy + 55, barW * ratio, 8);

    // 违规提示
    if (this.discipline.violated) {
      ctx.fillStyle = '#FF3333';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('⚠ 检测到违规操作！', cx, cy + 75);
    }

    ctx.textAlign = 'left';
  }

  // ===== 低血量警告 =====
  _renderLowHpWarning(ctx) {
    const alpha = 0.15 + Math.sin(this.time * 6) * 0.1;
    const grad = ctx.createRadialGradient(
      CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, 200,
      CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, CONFIG.WIDTH / 2
    );
    grad.addColorStop(0, 'rgba(255,0,0,0)');
    grad.addColorStop(1, `rgba(255,0,0,${alpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  }

  // ===== 启动/停止 =====
  start() {
    this._init();
    this.loop.start();
  }

  stop() {
    this.loop.stop();
    if (this.input) this.input.destroy();
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
      window.removeEventListener('keyup', this._keyHandler);
    }
  }

  _exitBattle() {
    this.stop();
    if (this.onExit) this.onExit();
  }
}
