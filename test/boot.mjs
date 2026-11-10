// 启动链路回归：DOMContentLoaded → 主菜单 → 点 Boss → 进战斗 → 跑帧 → 结算
const noop=()=>{};const gradient={addColorStop:noop};
function makeCtx(){const s={};return new Proxy(s,{get(t,k){if(k==='measureText')return()=>({width:50});if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return()=>gradient;if(k==='canvas')return{width:1600,height:900};if(k in t)return t[k];return noop;},set(t,k,v){t[k]=v;return true;}});}

const canvasListeners={};
const canvas={getContext:()=>makeCtx(),addEventListener:(k,f)=>{(canvasListeners[k]=canvasListeners[k]||[]).push(f);},removeEventListener:(k,f)=>{canvasListeners[k]=(canvasListeners[k]||[]).filter(x=>x!==f);},getBoundingClientRect:()=>({left:0,top:0,width:1600,height:900}),setPointerCapture:noop,releasePointerCapture:noop,style:{},width:1600,height:900};

const winListeners={};
globalThis.window={addEventListener:(k,f)=>{(winListeners[k]=winListeners[k]||[]).push(f);},removeEventListener:noop,devicePixelRatio:1,innerWidth:1600,innerHeight:900};
globalThis.document={getElementById:()=>canvas,addEventListener:noop};
const rafQueue=[];
globalThis.requestAnimationFrame=(f)=>{rafQueue.push(f);return rafQueue.length;};
globalThis.cancelAnimationFrame=noop;
globalThis.performance={now:()=>Date.now()};
const mem={};globalThis.localStorage={getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=String(v);},removeItem:k=>{delete mem[k];}};

const results=[];
const check=(name,cond,extra='')=>{results.push(`${cond?'PASS':'FAIL'}  ${name} ${extra}`);};
const frames=(n,base=0)=>{for(let i=0;i<n;i++){const q=rafQueue.splice(0);for(const f of q)f(performance.now()+base+i*16);}};
const tap=(x,y)=>{
  for(const f of (canvasListeners['pointerdown']||[])) f({clientX:x,clientY:y});
  for(const f of (winListeners['pointerup']||[])) f({clientX:x,clientY:y});
};

let bootErr=null;
try {
  await import('../src/main.js');
  for(const f of (winListeners['DOMContentLoaded']||[])) f();
} catch(e){ bootErr=e; }
check('入口加载不抛错', !bootErr, bootErr?bootErr.message:'');

const game = globalThis.window.__game;
check('Game 实例已挂载', !!game, game ? `state=${game.state}` : '');
check('默认横屏缩放=1', game && Math.abs(game.scale-1)<1e-6, game?`scale=${game.scale}`:'');

// 跑几帧主菜单
let frameErr=null;
try{ frames(10); }catch(e){ frameErr=e; }
check('主菜单渲染不抛错', !frameErr, frameErr?frameErr.message:'');
check('主菜单有可点按钮', game && game.menu.hits.length > 0, game?`hits=${game.menu.hits.length}`:'');

// 切到 Boss 页并点第一个 Boss
let clickErr=null;
try{
  game.menu.page='bosses';
  frames(2, 500);
  const hit = game.menu.hits.find(h=>String(h.action||'').startsWith('fightBoss:'));
  check('Boss 页有开战按钮', !!hit, hit?hit.action:'');
  if (hit) tap(hit.x + hit.w/2, hit.y + hit.h/2);
}catch(e){ clickErr=e; }
check('点击 Boss 卡片不抛错', !clickErr, clickErr?clickErr.message:'');
check('开战先进剧情页', game && game.menu.page==='story', game?game.menu.page:'');
// 剧情页连点推进，直到进入战斗
try{
  for(let i=0;i<30 && game.state!=='battle';i++){
    tap(800, 700);
    frames(2, 1000+i*100);
  }
}catch(e){ clickErr=e; }
check('剧情推进后进入战斗', game && game.state==='battle', game?`state=${game.state} page=${game.menu.page}`:'');

// 战斗跑帧
let battleErr=null;
try{ frames(600, 2000); }catch(e){ battleErr=e; }
check('战斗主循环不抛错', !battleErr, battleErr?battleErr.message:'');

// 结算页
let resultErr=null;
try{
  game._onEnd(true, {
    victory:true, title:'金老师 — 通关',
    reward:{ coins:500, exp:150 },
    achievements:[], weakpoints:1, maxHit:66, nextTarget:'han',
  });
  frames(10, 30000);
}catch(e){ resultErr=e; }
check('结算页渲染不抛错', !resultErr, resultErr?resultErr.message:'');
check('结算态已切换', game && game.state==='result', game?game.state:'');
check('结算页有按钮', game && game.result.hits.length>=2, game?`hits=${game.result.hits.length}`:'');

// 每日挑战奖励记录
let chErr=null;
try{
  const coinsBefore = game.saveData.coins;
  game._onEnd(true, {
    victory:true, title:'每日挑战',
    reward:{ coins:100, exp:50 },
    challengeId:'daily_test', challengeReward:{ coins:150, exp:30 },
    challengeLabel:'每日挑战 1',
    achievements:[], weakpoints:0, maxHit:0, nextTarget:null,
  });
  frames(4, 35000);
  check('挑战进度已记录', game.saveData.challenges.cleared.daily_test === 1, `${game.saveData.challenges.cleared.daily_test}`);
  check('挑战额外奖励到账', game.saveData.coins >= coinsBefore + 150, `${coinsBefore}→${game.saveData.coins}`);
}catch(e){ chErr=e; }
check('挑战奖励链路不抛错', !chErr, chErr?chErr.message:'');

// 从结算返回菜单
let backErr=null;
try{
  const b = game.result.hits.find(h=>h.action==='menu');
  if (b) tap(b.x+b.w/2, b.y+b.h/2);
  frames(4, 40000);
}catch(e){ backErr=e; }
check('返回菜单不抛错', !backErr, backErr?backErr.message:'');
check('已回到主菜单', game && game.state==='menu', game?game.state:'');

// 竖屏提示（模拟竖屏尺寸）
let oriErr=null;
try{
  globalThis.window.innerWidth=430; globalThis.window.innerHeight=932;
  game._checkOrientation();
}catch(e){ oriErr=e; }
check('竖屏检测不抛错', !oriErr, oriErr?oriErr.message:'');

console.log(results.join('\n'));
console.log(results.every(r=>r.startsWith('PASS'))?'ALL PASS':'HAS FAIL');
if(bootErr) console.error(bootErr);
if(battleErr) console.error(battleErr);
