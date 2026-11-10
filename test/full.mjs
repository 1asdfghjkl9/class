// ============================================================
// test/full.mjs — 完整版全功能验收测试（无头）
// 覆盖：12 技能 / 10 道具 / 6 武器 / 5 大招 / 12 关卡 / 双 Boss
//       互动物 / 难度 / 挑战 / 商店 / 天赋 / 成就 / 进度
//       菜单全页面 / 结算页 / 剧情页
// ============================================================

const noop = () => {};
const gradient = { addColorStop: noop };

function makeCtx() {
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k === 'measureText') return () => ({ width: 50 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => gradient;
      if (k === 'canvas') return { width: 1600, height: 900 };
      if (k in t) return t[k];
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

const canvas = {
  getContext: () => makeCtx(),
  addEventListener: noop,
  removeEventListener: noop,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }),
  setPointerCapture: noop,
  releasePointerCapture: noop,
  style: {},
  width: 1600,
  height: 900,
};
const ctx = makeCtx();

globalThis.window = {
  addEventListener: noop, removeEventListener: noop,
  devicePixelRatio: 1, innerWidth: 1600, innerHeight: 900,
};
globalThis.document = { getElementById: () => null, addEventListener: noop };
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = noop;
globalThis.performance = { now: () => Date.now() };
const mem = {};
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};

const { BattleScene } = await import('../src/battle/battle.js');
const { createDefaultSave, saveData } = await import('../src/save.js');
const { SKILLS } = await import('../src/data/skills.js');
const { ITEMS, ITEM_POOL } = await import('../src/data/items.js');
const { WEAPONS, WEAPON_POOL } = await import('../src/data/weapons.js');
const { ULTIMATES, ULT_ORDER } = await import('../src/battle/ult.js');
const { SUBJECTS, SUBJECT_ORDER, ALL_STAGES } = await import('../src/data/subjects.js');
const { BOSSES } = await import('../src/data/bosses.js');
const { ACHIEVEMENT_LIST, checkAchievements } = await import('../src/data/achievements.js');
const { MODIFIER_LIST } = await import('../src/data/challenges.js');
const { TALENT_TREES, TALENT_ORDER, aggregateTalents } = await import('../src/data/talents.js');
const { MenuScene, ResultScene } = await import('../src/ui/menu.js');
const DAMAGE = await import('../src/battle/damage.js');
const INTERACT = await import('../src/battle/interactables.js');
const ECO = await import('../src/meta/economy.js');
const PROG = await import('../src/meta/progression.js');

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log('PASS ', name, extra); }
  else { fail++; failures.push(name); console.log('FAIL ', name, extra); }
}
function safe(name, fn) {
  try { fn(); } catch (e) {
    fail++; failures.push(name);
    console.log('FAIL ', name, '→', e && e.message);
    console.log(String(e && e.stack).split('\n').slice(1, 5).join('\n'));
  }
}

const DT = 1 / 120;
function step(scene, frames = 300) {
  for (let i = 0; i < frames; i++) {
    scene._update(DT);
    scene._render();
    if (scene.state === 'ended') break;
  }
}
function fresh(bossId, opts) {
  const save = createDefaultSave();
  const sc = new BattleScene(canvas, bossId, save, {}, opts);
  sc._init();
  return { sc, save };
}
function readyFire(sc, aimMode) {
  sc.state = 'player_aiming';
  sc.aimMode = aimMode;
  sc.player.ap = 99;
  sc.player.apMax = 99;
  sc.player.shotsThisTurn = 0;
  sc.atb.freeze();
  sc.state = 'firing';
}

// ---------- 1. 12 个技能 ----------
for (const id of Object.keys(SKILLS)) {
  safe('技能 ' + id, () => {
    const { sc } = fresh('jin');
    sc.player.skills = [id];
    sc.player.skillLevels[id] = 3;
    readyFire(sc, id);
    sc._fireSkill(SKILLS[id], -0.35, 820);
    step(sc, 240);
    check('技能可用 ' + id, true, `state=${sc.state}`);
  });
}

// ---------- 2. 10 个道具 ----------
for (const id of ITEM_POOL) {
  safe('道具 ' + id, () => {
    const { sc } = fresh('jin');
    sc.state = 'player_turn';
    sc.player.ap = 99;
    sc.player.items = [id];
    sc._useItem(id);
    step(sc, 60);
    check('道具可用 ' + id, sc.player.items.length === 0, `type=${ITEMS[id].type}`);
  });
}

// ---------- 3. 6 把武器（4 种 fireMode） ----------
for (const id of WEAPON_POOL) {
  safe('武器 ' + id, () => {
    const { sc, save } = fresh('jin');
    save.weapons.owned[id] = { level: 3, affixes: [] };
    save.weapons.equipped = id;
    const sc2 = new BattleScene(canvas, 'jin', save, {});
    sc2._init();
    readyFire(sc2, 'normal');
    sc2._fireWeapon(-0.3, 820);
    step(sc2, 300);
    check('武器可用 ' + id, true, `mode=${WEAPONS[id].fireMode} dmg=${sc2.weaponInfo.damage}`);
  });
}

// ---------- 4. 5 个大招 ----------
for (const uid of ULT_ORDER) {
  safe('大招 ' + uid, () => {
    const { sc, save } = fresh('jin', { ultId: uid });
    sc.state = 'player_turn';
    sc.player.rage = 100;
    sc._tryUseUlt();
    step(sc, 300);
    check('大招可放 ' + uid, sc.player.rage === 0, `type=${ULTIMATES[uid].type}`);
  });
}

// ---------- 5. 12 个学科关卡 ----------
for (const sid of SUBJECT_ORDER) {
  const sub = SUBJECTS[sid];
  for (const st of sub.stages) {
    safe('关卡 ' + st.id, () => {
      const { sc } = fresh(st.id);
      check('关卡初始化 ' + st.id, sc.bossList.length >= 1, `boss=${sc.boss.name} hp=${sc.boss.maxHp}`);
      step(sc, 120);
    });
  }
}

// ---------- 6. 双 Boss ----------
safe('双 Boss', () => {
  const { sc } = fresh('english_rep');
  check('双 Boss 数量=2', sc.bossList.length === 2, `len=${sc.bossList.length}`);
  check('双 Boss 有独立 AI', !!sc.aiTwin, `twin=${sc.bossTwin && sc.bossTwin.name}`);
  // 打死一个不应直接胜利
  sc.bossTwin.hp = 0;
  sc._onUnitDeath(sc.bossTwin);
  check('打死一个不结束', sc.state !== 'ended', `state=${sc.state}`);
  sc.boss.hp = 0;
  sc._onUnitDeath(sc.boss);
  check('两个都死才结束', sc.state === 'ended', `state=${sc.state}`);
});

// ---------- 7. 场景互动物 ----------
safe('互动物', () => {
  const { sc } = fresh('jin');
  check('互动物数量 1-2 个', sc.interactables.length >= 1 && sc.interactables.length <= 2,
    `n=${sc.interactables.length} [${sc.interactables.map(i => i.id).join(',')}]`);
  // 同一关重复生成结果一致
  const again = INTERACT.createInteractables('jin').map(i => i.id).join(',');
  check('互动物按关卡固定', again === sc.interactables.map(i => i.id).join(','), again);

  // 逐个效果
  const fan = INTERACT.createInteractables().find(i => i.effect === 'turbulence');
  sc._onInteractableHit(fan);
  check('吊扇→气流紊乱', sc.turbulenceTimer > 0, `t=${sc.turbulenceTimer.toFixed(1)}`);

  const proj = INTERACT.createInteractables().find(i => i.effect === 'blur');
  sc._onInteractableHit(proj);
  check('投影仪→弹道不可见', sc.blurTimer > 0, `t=${sc.blurTimer.toFixed(1)}`);

  const board = INTERACT.createInteractables().find(i => i.effect === 'chalkDust');
  sc._onInteractableHit(board);
  check('黑板报→粉笔灰', sc.status.has(sc.player, 'chalkDust'), '');
});

// ---------- 8. 三档难度 ----------
for (const [id, mul] of [['normal', 1], ['hard', 1.3], ['nightmare', 1.6]]) {
  safe('难度 ' + id, () => {
    const { sc } = fresh('jin', { difficulty: id });
    const base = BOSSES.jin.hp;
    check('难度血量 ' + id, sc.boss.maxHp >= Math.round(base * mul) - 1, `${sc.boss.maxHp} vs ${base}×${mul}`);
  });
}

// ---------- 9. 挑战修饰符 ----------
safe('挑战修饰符', () => {
  for (const m of MODIFIER_LIST) {
    const { sc } = fresh('jin', { modifierIds: [m.id] });
    check('修饰符 ' + m.id, !!sc.modState, `windMul=${sc.modState.windMul}`);
  }
  const { sc } = fresh('jin', { modifierIds: ['no_skill'] });
  check('技能封印生效', sc.modState.skillAllowed === false, '');
  const { sc: sc2 } = fresh('jin', { modifierIds: ['low_hp'] });
  check('残血开局生效', sc2.player.maxHp < 140, `maxHp=${sc2.player.maxHp}`);
});

// ---------- 10. 商店 / 经济 ----------
safe('经济系统', () => {
  const save = createDefaultSave();
  save.coins = 100000;

  const up = ECO.upgradeSkill(save, 'wall');
  check('技能升级', up.ok && save.skillLevels.wall === 2, `lv=${save.skillLevels.wall}`);

  const wu = ECO.upgradeWeapon(save, 'pen_gun');
  check('武器升级', wu.ok && save.weapons.owned.pen_gun.level === 2, `lv=${save.weapons.owned.pen_gun.level}`);

  const iu = ECO.upgradeItem(save, 'leave');
  check('道具升级', iu.ok && save.itemLevels.leave === 2, `lv=${save.itemLevels.leave}`);

  const pack = ECO.buyWeaponPack(save);
  check('抽武器', pack.ok && !!pack.weaponId, `got=${pack.weaponId} ${pack.quality}`);

  const rr = ECO.rerollWeapon(save, 'pen_gun');
  check('洗词条', rr.ok, `n=${(save.weapons.owned.pen_gun.affixes || []).length}`);

  const be = ECO.buyExp(save);
  check('买积分', be.ok, `exp=${save.exp} lv=${save.level}`);

  const bf = ECO.buyFragment(save, 'orange');
  check('买碎片', bf.ok, `frag=${bf.fragments}/${bf.need}`);

  const eq = ECO.equipSkill(save, 'chalk');
  check('装备切换', eq.ok && eq.removed, '');
  const eq2 = ECO.equipSkill(save, 'chalk');
  check('重新装备', eq2.ok && eq2.added, '');

  // 天赋
  save.talents.points = 5;
  const t1 = ECO.unlockTalent(save, 'grind', 0);
  check('点天赋', t1.ok && save.talents.spent.grind_1 === 1, '');
  const t2 = ECO.unlockTalent(save, 'grind', 1);
  check('顺序解锁天赋', t2.ok, '');
  const t3 = ECO.unlockTalent(save, 'grind', 4);
  check('跳层被拒绝', !t3.ok, t3.reason);

  const agg = aggregateTalents(save);
  check('天赋聚合', agg.dmgPct >= 8, `dmg=${agg.dmgPct}`);

  const rs = ECO.respecTalents(save);
  check('洗点', rs.ok && save.talents.points === 5, `pts=${save.talents.points}`);
});

// ---------- 11. 进度 / 解锁 ----------
safe('进度系统', () => {
  const save = createDefaultSave();
  PROG.onBattleWin(save, { bossId: 'jin', difficulty: 'normal', reward: { coins: 500 } });
  check('Boss 通关记录', save.progress.bosses.jin === 1, '');
  check('Boss 奖励到账', save.coins >= 1500, `coins=${save.coins}`);

  PROG.refreshSkillUnlocks(save);
  check('进度解锁技能', !!save.skillsUnlocked.snack, 'snack');

  check('学科第一关默认解锁', PROG.isStageUnlocked(save, 'chinese', 0) === true, '');
  check('学科第二关未解锁', PROG.isStageUnlocked(save, 'chinese', 1) === false, '');

  PROG.onBattleWin(save, { stageId: 'chinese_1', subjectId: 'chinese', difficulty: 'normal', reward: { coins: 60 } });
  check('关卡通关记录', save.progress.stages.chinese_1 === 1, '');
  check('下一关解锁', PROG.isStageUnlocked(save, 'chinese', 1) === true, '');

  // 全通一条线
  for (const st of SUBJECTS.chinese.stages) {
    PROG.onBattleWin(save, { stageId: st.id, subjectId: 'chinese', difficulty: 'normal', reward: { coins: 0 } });
  }
  check('学科徽章', save.progress.subjectBadges.chinese === 1, '');
  check('学科通关判定', PROG.isSubjectDone(save, 'chinese') === true, '');
});

// ---------- 12. 成就 ----------
safe('成就系统', () => {
  const save = createDefaultSave();
  const before = save.coins;
  save.stats.totalWins = 1;
  const got = checkAchievements(save);
  check('成就触发', got.some(a => a.id === 'first_blood'), `got=${got.map(a=>a.id).join(',')}`);
  check('成就发金币', save.coins > before, `+${save.coins - before}`);
  check('成就不重复发', checkAchievements(save).length === 0, '');
  check('成就总数', ACHIEVEMENT_LIST.length >= 20, `n=${ACHIEVEMENT_LIST.length}`);
});

// ---------- 13. 菜单全页面渲染 ----------
safe('菜单渲染', () => {
  const save = createDefaultSave();
  save.coins = 5000;
  save.talents.points = 3;
  const menu = new MenuScene(save);
  menu.onStartBattle = noop;
  const pages = ['home', 'bosses', 'subjects', 'shop', 'talents', 'achievements', 'challenges', 'settings'];
  for (const p of pages) {
    menu.page = p;
    menu.update(0.016);
    menu.render(ctx);
    check('菜单页 ' + p, menu.hits.length > 0, `hits=${menu.hits.length}`);
  }
  // shop 四个 tab
  for (const t of ['skill', 'weapon', 'item', 'res']) {
    menu.page = 'shop';
    menu.shopTab = t;
    menu.render(ctx);
    check('商店 tab ' + t, menu.hits.length > 0, `hits=${menu.hits.length}`);
  }
  // 学科三个 tab
  for (const s of SUBJECT_ORDER) {
    menu.page = 'subjects';
    menu.subjectTab = s;
    menu.render(ctx);
    check('学科 tab ' + s, menu.hits.length > 0, '');
  }
  // 每日 / 每周挑战卡片可点击并开战
  menu.page = 'challenges';
  menu.render(ctx);
  const dHits = menu.hits.filter(h => String(h.action || '').startsWith('doChallenge:'));
  check('每日每周挑战卡片', dHits.length === 4, `n=${dHits.length}`);
  let started = null;
  menu.onStartBattle = (target, opts) => { started = { target, opts }; };
  if (dHits[0]) menu.click(dHits[0].x + 10, dHits[0].y + 10);
  check('挑战开战带 modifierIds', !!(started && started.opts && started.opts.modifierIds && started.opts.modifierIds.length),
    started ? `${started.target} ${(started.opts.modifierIds || []).join(',')}` : '');
  check('挑战开战带 challengeId', !!(started && started.opts && started.opts.challengeId), started ? started.opts.challengeId : '');
  menu.onStartBattle = noop;

  // 剧情页
  menu.page = 'story';
  menu.story = { lines: [{ who: '金老师', text: '测试台词' }, { who: '我', text: '第二句' }], index: 0, target: 'jin', opts: {} };
  menu.render(ctx);
  check('剧情页渲染', menu.hits.length > 0, `hits=${menu.hits.length}`);
  menu.click(800, 400);
  check('剧情推进', menu.story && menu.story.index === 1, `idx=${menu.story && menu.story.index}`);
  menu.click(800, 400);
  check('剧情结束进入战斗', menu.story === null, '');
});

// ---------- 14. 结算页 ----------
safe('结算页', () => {
  const save = createDefaultSave();
  const rs = new ResultScene(save);
  rs.show({
    victory: true,
    title: '金老师 · 班主任 — 通关',
    reward: { coins: 500, exp: 150 },
    achievements: ['first_blood'],
    weakpoints: 2,
    maxHit: 88,
    nextTarget: 'han',
  });
  rs.update(0.5);
  rs.render(ctx);
  check('胜利结算渲染', rs.hits.length >= 2, `hits=${rs.hits.length}`);

  rs.show({ victory: false, title: '失败', reward: null, achievements: [] });
  rs.update(0.5);
  rs.render(ctx);
  check('失败结算渲染', rs.hits.length >= 2, `hits=${rs.hits.length}`);
});

// ---------- 15. 完整对局（自动打完一场 Boss 战） ----------
safe('完整对局', () => {
  const save = createDefaultSave();
  const sc = new BattleScene(canvas, 'jin', save, {}, { difficulty: 'normal' });
  sc._init();

  const G = 900, VMIN = 420, VMAX = 1200, DRAG_MAX = 180, DEAD = 20;
  let shots = 0;
  for (let round = 0; round < 120 && sc.state !== 'ended'; round++) {
    if (sc.state === 'player_turn' || sc.state === 'player_aiming') {
      const target = sc.bossList.find(b => !b.dead) || sc.boss;
      sc.aimMode = 'normal';
      sc.state = 'player_aiming';
      sc._aimDragging = true;
      sc.input.downX = 800; sc.input.downY = 500;
      sc.input.isDown = true;
      sc.input.x = 700; sc.input.y = 600;
      const dist = Math.abs(target.x - sc.player.x);
      const vxMag = 780;
      const t = dist / vxMag;
      const sy = sc.player.y - sc.player.radius / 2;
      const ty = target.y - 4;
      const vy = (ty - sy - 0.5 * G * t * t) / t;
      const speed = Math.hypot(vxMag, vy);
      const ratio = Math.min(1, Math.max(0, (speed - VMIN) / (VMAX - VMIN)));
      const drag = DEAD + ratio * (DRAG_MAX - DEAD);
      const ang = Math.atan2(vy, vxMag);
      sc._firePlayerShot(-Math.cos(ang) * drag, -Math.sin(ang) * drag, drag);
      sc._aimDragging = false;
      sc.input.isDown = false;
      shots++;
    }
    if (sc.state === 'quiz') sc._onQuizAnswer(0);
    if (sc.state === 'discipline') sc._onDisciplineTap();
    for (let f = 0; f < 240; f++) {
      sc._update(DT);
      sc._render();
      if (sc.state === 'ended') break;
    }
  }
  check('对局推进', shots > 3, `shots=${shots}`);
  check('对局有结果', sc.state === 'ended', `state=${sc.state} bossHp=${sc.boss.hp}`);
});

// ---------- 16. 伤害加成链路（回归：projectile.damage 不被覆盖） ----------
safe('伤害加成链路', () => {
  const calculateDamage = DAMAGE.calculateDamage;

  // calculateDamage 必须原样采用 projectile.damage
  const r = calculateDamage({
    projectile: { damage: 100, x: 0, y: 0, vx: 600, vy: -600, prevX: -10, prevY: 10 },
    target: { dr: 0 },
    wind: { accel: 0 },
    weaponData: { baseDamage: 5 },
    allowCrit: false,
  });
  check('伤害不被武器基础值覆盖', r.baseDamage === 100 && r.damage === 100, `${r.damage}`);

  // 武器等级越高，发射伤害越高
  function fireDmg(level, dmgPct) {
    const save = createDefaultSave();
    save.weapons.owned.pen_gun = { level, affixes: [] };
    save.weapons.equipped = 'pen_gun';
    if (dmgPct) { save.talents.points = 9; save.talents.spent = { grind_1: 1 }; }
    const sc = new BattleScene(canvas, 'jin', save, {});
    sc._init();
    return sc.weaponInfo.damage;
  }
  const d1 = fireDmg(1);
  const d5 = fireDmg(5);
  check('武器等级提升伤害', d5 > d1, `lv1=${d1} lv5=${d5}`);

  // 天赋加伤生效
  const save = createDefaultSave();
  save.talents.points = 9;
  save.talents.spent = { grind_1: 1 };
  const sc = new BattleScene(canvas, 'jin', save, {});
  sc._init();
  const base = new BattleScene(canvas, 'jin', createDefaultSave(), {});
  base._init();
  check('天赋加伤生效', sc.weaponInfo.damage > base.weaponInfo.damage, `${base.weaponInfo.damage}→${sc.weaponInfo.damage}`);
});

// ---------- 17. 学生低血狂暴 ----------
safe('学生狂暴', () => {
  const { sc } = fresh('chinese_2');
  const u = sc.boss;
  u.hp = Math.floor(u.maxHp * 0.4);
  sc.ai.turnCount = 1;
  const act = sc.ai._studentDecide();
  check('低血进入狂暴', u.buffMul === 1.5, `buffMul=${u.buffMul} action=${act.type}`);
});

// ---------- 18. 互动物吃掉弹丸 ----------
safe('互动物吃弹丸', () => {
  const { sc } = fresh('jin');
  const it = sc.interactables[0];
  const proj = { x: it.x, y: it.y, r: 8, alive: true };
  // 直接走战斗内流程
  sc.projectiles = [proj];
  const hitIt = INTERACT.checkInteractableHit([proj], sc.interactables);
  check('互动物命中', !!hitIt, hitIt ? hitIt.id : '');
  check('弹丸被吃掉', proj.alive === false, `alive=${proj.alive}`);
});

// ---------- 汇总 ----------
console.log('\n===== 结果 =====');
console.log(`PASS ${pass} / FAIL ${fail}`);
if (fail) console.log('失败项：', failures.join(' | '));
