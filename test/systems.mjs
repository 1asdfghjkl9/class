const noop=()=>{};const gradient={addColorStop:noop};
function makeCtx(){const s={};return new Proxy(s,{get(t,k){if(k==='measureText')return()=>({width:50});if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return()=>gradient;if(k==='canvas')return{width:1600,height:900};if(k in t)return t[k];return noop;},set(t,k,v){t[k]=v;return true;}});}
const canvas={getContext:()=>makeCtx(),addEventListener:noop,removeEventListener:noop,getBoundingClientRect:()=>({left:0,top:0,width:1600,height:900}),setPointerCapture:noop,releasePointerCapture:noop,style:{},width:1600,height:900};
globalThis.window={addEventListener:noop,removeEventListener:noop,devicePixelRatio:1,innerWidth:1600,innerHeight:900};
globalThis.document={getElementById:()=>canvas,addEventListener:noop};
globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=noop;
globalThis.performance={now:()=>Date.now()};
const mem={};globalThis.localStorage={getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=String(v);},removeItem:k=>{delete mem[k];}};

const { BattleScene } = await import('../src/battle/battle.js');
const { createDefaultSave } = await import('../src/save.js');
const { CONFIG } = await import('../src/config.js');
const { SKILLS } = await import('../src/data/skills.js');

const G=CONFIG.GRAVITY, VMIN=CONFIG.VELOCITY_MIN, VMAX=CONFIG.VELOCITY_MAX;
const DMAX=CONFIG.DRAG_MAX, DEAD=CONFIG.DRAG_DEADZONE;

// 暴力搜索可行解：证明"存在能命中目标的力度+角度"
function aimAt(scene, tx, ty, hitRadius = 36) {
  const R = 8, G = CONFIG.GRAVITY;
  const hitR = hitRadius + R;
  for (let sp = 1200; sp >= VMIN; sp -= 8) {
    for (let deg = 6; deg <= 72; deg += 0.5) {
      const ang = deg * Math.PI / 180;
      let px = scene.player.x + Math.cos(ang) * (scene.player.radius + R);
      let py = scene.player.y - scene.player.radius / 2 - Math.sin(ang) * (scene.player.radius + R);
      let vx = Math.cos(ang) * sp, vy = -Math.sin(ang) * sp;
      const dt = 1 / 120; // 与游戏物理步长一致，避免搜索解擦边
      for (let i = 0; i < 1200; i++) {
        vy += G * dt;
        vx += scene.wind.accel * dt; // 风必须算进去，否则随回合随机漂移
        px += vx * dt; py += vy * dt;
        // 弱点优先，其次本体拦截（与 checkCollision 顺序一致）
        if (Math.hypot(px - tx, py - ty) <= hitR) {
          const ratio = Math.min(1, Math.max(0, (sp - VMIN) / (VMAX - VMIN)));
          const drag = DEAD + ratio * (DMAX - DEAD);
          return { dx: -Math.cos(ang) * drag, dy: Math.sin(ang) * drag, drag };
        }
        if (Math.hypot(px - scene.boss.x, py - scene.boss.y) <= scene.boss.radius + 8) break;
        // 必须绕开地形，否则搜出来的解实际会被挡住
        let blocked = false;
        for (const t of scene.terrain) {
          if (t.destroyed) continue;
          if (t.hitTest(px, py, 8)) { blocked = true; break; }
        }
        if (blocked) break;
        if (py > CONFIG.GROUND_Y || px > CONFIG.WIDTH || px < 0) break;
      }
    }
  }
  return null;
}

function warm(scene, dt=1/120){
  for(let i=0;i<4000 && scene.state!=='player_turn';i++) scene._update(dt);
}
function stepUntilSettle(scene, dt=1/120, max=900){
  for(let i=0;i<max;i++){ scene._update(dt); if(scene.state==='player_turn'||scene.state==='ended') break; }
}

const results=[];
function check(name, cond, extra=''){ results.push(`${cond?'PASS':'FAIL'}  ${name} ${extra}`); }

// ---- 1. 技能释放：伤害 + AP + 冷却 ----
{
  const sc = new BattleScene(canvas,'jin',createDefaultSave(),{});
  sc._init();
  sc.ai.updatePosition = () => {}; // 冻结 Boss，单独验证技能伤害链路
  warm(sc);
  sc.player.ap = 6;
  const hp0 = sc.boss.hp;
  const a = aimAt(sc, sc.boss.x, sc.boss.y-4);
  if (!a) { check('找到可行瞄准解', false, 'no solution'); }
  sc.aimMode='justice'; sc.state='player_aiming'; sc._aimDragging=true;
  sc._firePlayerShot(a.dx,a.dy,a.drag);
  check('技能发射后 AP 扣除', sc.player.ap === 0, `ap=${sc.player.ap} (justice.ap=${SKILLS.justice.ap})`);
  check('技能设置冷却', (sc.player.cooldowns['justice']||0) > 0, `cd=${sc.player.cooldowns['justice']}`);
  stepUntilSettle(sc);
  check('技能造成伤害', sc.boss.hp < hp0, `${hp0}→${sc.boss.hp}`);
}

// ---- 2. 打弱点（直接验证判定链路，排除弹道随机性） ----
{
  const { checkCollision } = await import('../src/battle/collision.js');
  const { Projectile } = await import('../src/battle/projectile.js');

  const sc = new BattleScene(canvas,'jin',createDefaultSave(),{});
  sc._init();
  const wp = sc.boss.weakpoints.find(w=>w.id==='book');
  const wx = sc.boss.x + wp.offsetX;
  const wy = sc.boss.y + wp.offsetY;

  const proj = new Projectile(wx, wy, 0, 0, { radius: 8, damage: 45, source: 'player' });
  proj._sourceUnit = sc.player;
  const hit = checkCollision(proj, [], [sc.boss]);
  check('弱点判定优先命中弱点', hit && hit.type === 'weakpoint' && hit.weakpoint.id === 'book',
        hit ? `type=${hit.type}` : 'no hit');

  // 命中弱点后：弱点掉血 + 本体吃一半
  const wpHp0 = wp.currentHp, bossHp0 = sc.boss.hp;
  sc._handleHit(proj, hit);
  check('弱点被扣血', wp.currentHp < wpHp0, `${wpHp0}→${wp.currentHp}`);
  check('打弱点本体也掉血', sc.boss.hp < bossHp0, `${bossHp0}→${sc.boss.hp}`);
}

// ---- 3. 道具：一次性消耗 + 不结束回合 ----
{
  const sc = new BattleScene(canvas,'jin',createDefaultSave(),{});
  sc._init(); warm(sc);
  sc.player.ap = 6;
  sc.player.items = ['not_our_class', 'kite', 'what_doing', 'teacher_snack'];
  const before = sc.player.items.length;
  sc._useItem('not_our_class');
  check('道具被消耗', sc.player.items.length === before-1, `${before}→${sc.player.items.length}`);
  check('用道具后仍在玩家回合', sc.state === 'player_turn', sc.state);
  check('道具给到护盾状态', sc.status.has(sc.player,'shield'), '');
}

// ---- 4. 口答答错 → 受伤翻倍 ----
{
  const sc = new BattleScene(canvas,'han',createDefaultSave(),{});
  sc._init(); warm(sc);
  sc._startQuiz();
  const correct = sc.quiz.correctIndex;
  const wrong = (correct+1) % 3;
  sc._onQuizAnswer(wrong);
  check('答错施加受伤翻倍', sc.status.has(sc.player,'vulnerable'), '');
  const mul = sc.status.getDamageTakenMultiplier(sc.player);
  check('受伤倍率=2', mul === 2, `mul=${mul}`);
}

// ---- 5. 击杀 Boss → 胜利回调 ----
{
  let ended = null;
  const sc = new BattleScene(canvas,'jin',createDefaultSave(),{ onEnd:(v)=>{ended=v;} });
  sc._init();
  sc.ai.updatePosition = () => {}; // 冻结 Boss，验证击杀结算
  warm(sc);
  sc.boss.hp = 1;
  sc.player.ap = 6;
  const a = aimAt(sc, sc.boss.x, sc.boss.y-4);
  sc.aimMode='normal'; sc.state='player_aiming'; sc._aimDragging=true;
  sc._firePlayerShot(a.dx,a.dy,a.drag);
  stepUntilSettle(sc, 1/120, 1200);
  check('击杀 Boss 触发胜利', ended === true, `ended=${ended} bossHp=${sc.boss.hp} state=${sc.state}`);
}

// ---- 6. 沉默时不能用技能 ----
{
  const sc = new BattleScene(canvas,'jin',createDefaultSave(),{});
  sc._init(); warm(sc);
  sc.player.ap = 6;
  sc.status.add(sc.player,'silence',2,0);
  // 模拟点击第一个技能按钮
  const ay = CONFIG.HEIGHT - 90, startX = 300, size = 56;
  sc._handleUIClick(startX + 5, ay + 5);
  check('沉默时点技能不进入瞄准', sc.state !== 'player_aiming', sc.state);
}

console.log(results.join('\n'));
const fails = results.filter(r=>r.startsWith('FAIL')).length;
console.log('\n' + (fails===0 ? 'ALL PASS' : `${fails} FAILED`));
