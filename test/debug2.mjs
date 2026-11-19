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

for (const id of ['jin','han','wu']) {
  const scene = new BattleScene(canvas, id, createDefaultSave(), {});
  scene._init();
  console.log('\n===== ' + id + ' =====');
  console.log('boss x/y/r', scene.boss.x, scene.boss.y, scene.boss.radius);
  console.log('terrain:', scene.terrain.map(t => `${t.type}@(${t.x.toFixed(0)},${t.y.toFixed(0)}) w${t.width||t.radius} h${t.height||''} solid=${t.solid}`).join(' | '));

  const dt=1/120;
  for(let i=0;i<3000 && scene.state!=='player_turn';i++) scene._update(dt);
  const dist = Math.abs(scene.boss.x - scene.player.x);
  const v = Math.sqrt(dist*CONFIG.GRAVITY);
  const ratio = Math.min(1, Math.max(0,(v-CONFIG.VELOCITY_MIN)/(CONFIG.VELOCITY_MAX-CONFIG.VELOCITY_MIN)));
  const drag = CONFIG.DRAG_DEADZONE + ratio*(CONFIG.DRAG_MAX-CONFIG.DRAG_DEADZONE);
  const dx=-drag*Math.SQRT1_2, dy=drag*Math.SQRT1_2;
  scene.aimMode='normal'; scene.state='player_aiming'; scene._aimDragging=true;
  scene._firePlayerShot(dx,dy,Math.hypot(dx,dy));
  const p = scene.projectiles[0];
  console.log('dist', dist.toFixed(0), 'v', v.toFixed(0), 'drag', drag.toFixed(0));
  console.log('proj', p.x.toFixed(0), p.y.toFixed(0), 'vx', p.vx.toFixed(0), 'vy', p.vy.toFixed(0));

  let lastX=p.x, lastY=p.y;
  for(let f=0; f<400; f++){
    scene._update(dt);
    const q = scene.projectiles[0];
    if(q){ lastX=q.x; lastY=q.y; }
    else { console.log('projectile gone at frame', f, 'last pos', lastX.toFixed(0), lastY.toFixed(0), 'bossHp', scene.boss.hp, 'playerHp', scene.player.hp); break; }
  }
}
