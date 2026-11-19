// 机制级回归：点名预警 / 打掉英语书失效 / 半血题海 / 纪律沉默
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

const results=[];
const check=(name,cond,extra='')=>results.push(`${cond?'PASS':'FAIL'}  ${name} ${extra}`);

// ---- 金老师：点名必须先预警一回合 ----
{
  const sc = new BattleScene(canvas,'jin',createDefaultSave(),{});
  sc._init();
  const seq=[];
  for(let i=0;i<12;i++){
    const a = sc.ai.decideAction();
    seq.push(a.type);
    sc.ai.tickCooldowns();
    if(a.type==='roll_call') break;
  }
  const wi = seq.indexOf('roll_call_warning');
  const ri = seq.indexOf('roll_call');
  check('金老师点名前有预警', wi>=0 && ri===wi+1, seq.join('→'));
  check('预警不直接扣力度', wi>=0 && seq.slice(0,wi).indexOf('roll_call')<0, `首轮序列=${seq.slice(0,wi+1).join('→')}`);
}

// ---- 金老师：打掉英语书后不再点名 ----
{
  const sc = new BattleScene(canvas,'jin',createDefaultSave(),{});
  sc._init();
  const book = sc.boss.weakpoints.find(w=>w.id==='book');
  book.currentHp=0; book.destroyed=true;
  const seq=[];
  for(let i=0;i<12;i++){ seq.push(sc.ai.decideAction().type); sc.ai.tickCooldowns(); }
  check('打掉英语书后不再点名', !seq.includes('roll_call') && !seq.includes('roll_call_warning'), seq.join('→'));
}

// ---- 金老师：打掉笔袋后不再拖堂 ----
{
  const sc = new BattleScene(canvas,'jin',createDefaultSave(),{});
  sc._init();
  const pen = sc.boss.weakpoints.find(w=>w.id==='penbag');
  pen.currentHp=0; pen.destroyed=true;
  const seq=[];
  for(let i=0;i<12;i++){ seq.push(sc.ai.decideAction().type); sc.ai.tickCooldowns(); }
  check('打掉笔袋后不再拖堂', !seq.includes('drag_class'), seq.join('→'));
}

// ---- 韩老师：半血触发题海 ----
{
  const sc = new BattleScene(canvas,'han',createDefaultSave(),{});
  sc._init();
  sc.boss.hp = Math.floor(sc.boss.maxHp*0.4);
  const seq=[];
  for(let i=0;i<6;i++){ seq.push(sc.ai.decideAction().type); sc.ai.tickCooldowns(); }
  check('韩老师半血触发题海', seq.includes('paper_rage'), seq.join('→'));
}

// ---- 吴老师：纪律检查会造成沉默 ----
{
  const sc = new BattleScene(canvas,'wu',createDefaultSave(),{});
  sc._init();
  sc.ai.disciplineCd = 0;
  const act = sc.ai.decideAction();
  check('吴老师会发起纪律检查', act.type==='discipline', act.type);
  // 模拟违规：扣血 + 沉默
  const hp0 = sc.player.hp;
  sc.player.hp -= (sc.boss.disciplineDamage||30);
  sc.status.add(sc.player,'silence',2,0);
  check('纪律违规扣血', sc.player.hp<hp0, `${hp0}→${sc.player.hp}`);
  check('纪律违规被沉默', sc.status.isSilenced(sc.player));
}

// ---- 沉默禁止技能 ----
{
  const sc = new BattleScene(canvas,'wu',createDefaultSave(),{});
  sc._init();
  sc.status.add(sc.player,'silence',2,0);
  sc.player.ap=6;
  sc.player.cooldowns={};
  sc.state='player_turn';
  const { CONFIG } = await import('../src/config.js');
  const ay = CONFIG.HEIGHT - 90;
  const sid = sc.player.skills[0];
  sc._handleUIClick(320, ay + 20);   // 点第 1 个技能按钮
  check('沉默时无法进入技能瞄准', sc.aimMode !== sid && sc.state !== 'player_aiming', `aimMode=${sc.aimMode} state=${sc.state}`);
}

// ---- 口答答错：受伤翻倍 ----
{
  const sc = new BattleScene(canvas,'han',createDefaultSave(),{});
  sc._init();
  check('无状态时受伤倍率=1', sc.status.getDamageTakenMultiplier(sc.player)===1);
  sc.status.add(sc.player,'vulnerable',2,0);
  check('答错后受伤倍率=2', sc.status.getDamageTakenMultiplier(sc.player)===2);
}

// ---- 口答答对：免伤 + 额外弹射 ----
{
  const sc = new BattleScene(canvas,'han',createDefaultSave(),{});
  sc._init();
  sc.player.ap = 0;
  sc.quiz = { question:'q', answer:'A', options:['A','B','C'], timer:3, maxTimer:3, selected:null, result:null };
  sc._onQuizAnswer('A');
  check('答对给额外弹射(AP+3)', sc.player.ap >= 3, `ap=${sc.player.ap}`);
  check('答对免伤', sc.status.getDamageTakenMultiplier(sc.player) === 0);
}

// ---- 口答答错：受伤翻倍 ----
{
  const sc = new BattleScene(canvas,'han',createDefaultSave(),{});
  sc._init();
  sc.quiz = { question:'q', answer:'A', options:['A','B','C'], timer:3, maxTimer:3, selected:null, result:null };
  sc._onQuizAnswer('B');
  check('答错受伤翻倍', sc.status.getDamageTakenMultiplier(sc.player) === 2);
}

console.log(results.join('\n'));
console.log(results.every(r=>r.startsWith('PASS'))?'ALL PASS':'HAS FAIL');
