const noop = () => {};
const gradient = { addColorStop: noop };
function makeCtx(){const s={};return new Proxy(s,{get(t,k){if(k==='measureText')return()=>({width:50});if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return()=>gradient;if(k==='canvas')return{width:1600,height:900};if(k in t)return t[k];return noop;},set(t,k,v){t[k]=v;return true;}});}
const canvas={getContext:()=>makeCtx(),addEventListener:noop,removeEventListener:noop,getBoundingClientRect:()=>({left:0,top:0,width:1600,height:900}),setPointerCapture:noop,releasePointerCapture:noop,style:{},width:1600,height:900};
globalThis.window={addEventListener:noop,removeEventListener:noop,devicePixelRatio:1,innerWidth:1600,innerHeight:900};
globalThis.document={getElementById:()=>canvas,addEventListener:noop};
globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=noop;
globalThis.performance={now:()=>Date.now()};
const mem={};globalThis.localStorage={getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=String(v);},removeItem:k=>{delete mem[k];}};

const { BattleScene } = await import('../src/battle/battle.js');
const { createDefaultSave } = await import('../src/save.js');

const scene = new BattleScene(canvas, 'jin', createDefaultSave(), {});
scene._init();
console.log('player', scene.player.x, scene.player.y, 'r', scene.player.radius, 'ap', scene.player.ap, 'atb', scene.player.atb);
console.log('boss  ', scene.boss.x, scene.boss.y, 'r', scene.boss.radius, 'hp', scene.boss.hp);
console.log('terrain count', scene.terrain.length);
console.log('GROUND_Y', (await import('../src/config.js')).CONFIG.GROUND_Y);

const dt = 1/120;
// 推进到玩家回合
for (let i=0;i<2000 && scene.state!=='player_turn';i++) scene._update(dt);
console.log('after warmup state =', scene.state, 'ap =', scene.player.ap);

scene.aimMode='normal';
scene.state='player_aiming';
scene._aimDragging=true;
const dx=-150, dy=-90;
scene._firePlayerShot(dx,dy,Math.hypot(dx,dy));
console.log('after fire state =', scene.state, 'projectiles =', scene.projectiles.length, 'ap =', scene.player.ap);
if (scene.projectiles[0]) {
  const p = scene.projectiles[0];
  console.log('proj start', p.x.toFixed(1), p.y.toFixed(1), 'v', p.vx.toFixed(1), p.vy.toFixed(1), 'dmg', p.damage);
}

for (let i=0;i<600;i++){
  scene._update(dt);
  if (scene.projectiles[0]) {
    const p=scene.projectiles[0];
    if (i%20===0) console.log('f',i,'proj',p.x.toFixed(0),p.y.toFixed(0),'state',scene.state,'bossHp',scene.boss.hp,'playerHp',scene.player.hp);
  } else if (i<40 || i%40===0) {
    console.log('f',i,'no proj, state',scene.state,'bossHp',scene.boss.hp,'playerHp',scene.player.hp);
  }
  if (scene.state==='player_turn' && i>30) { console.log('back to player_turn at frame', i); break; }
}
