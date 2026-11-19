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

const G=CONFIG.GRAVITY, VMIN=CONFIG.VELOCITY_MIN, VMAX=CONFIG.VELOCITY_MAX, DMAX=CONFIG.DRAG_MAX, DEAD=CONFIG.DRAG_DEADZONE;
function aimAt(sc,tx,ty){const sx=sc.player.x,sy=sc.player.y-sc.player.radius/2,dist=Math.abs(tx-sx),vxMag=780,t=dist/vxMag,vy=(ty-sy-0.5*G*t*t)/t,speed=Math.hypot(vxMag,vy),ratio=Math.min(1,Math.max(0,(speed-VMIN)/(VMAX-VMIN))),drag=DEAD+ratio*(DMAX-DEAD),ang=Math.atan2(vy,vxMag);return{dx:-Math.cos(ang)*drag,dy:-Math.sin(ang)*drag,drag};}

const sc = new BattleScene(canvas,'jin',createDefaultSave(),{});
sc._init();
const dt=1/120;
for(let i=0;i<4000 && sc.state!=='player_turn';i++) sc._update(dt);
console.log('state', sc.state, 'boss', sc.boss.x, sc.boss.y, 'player', sc.player.x, sc.player.y);
sc.player.ap=6;
const a = aimAt(sc, sc.boss.x, sc.boss.y-4);
console.log('aim drag', a.drag.toFixed(1), 'dx', a.dx.toFixed(1), 'dy', a.dy.toFixed(1));
sc.aimMode='justice'; sc.state='player_aiming'; sc._aimDragging=true;
sc._firePlayerShot(a.dx,a.dy,a.drag);
console.log('after fire: state', sc.state, 'proj', sc.projectiles.length, 'ap', sc.player.ap);
if (sc.projectiles[0]) { const p=sc.projectiles[0]; console.log('proj', p.x.toFixed(0), p.y.toFixed(0), 'vx', p.vx.toFixed(0), 'vy', p.vy.toFixed(0), 'dmg', p.damage, 'skillData', !!p.skillData); }

for (let f=0; f<400; f++){
  const before = sc.boss.hp;
  sc._update(dt);
  if (sc.projectiles[0]) {
    const p=sc.projectiles[0];
    if (f%10===0) console.log('f',f,'pos',p.x.toFixed(0),p.y.toFixed(0),'bossHp',sc.boss.hp,'state',sc.state);
  } else {
    console.log('proj gone f',f,'bossHp',before,'→',sc.boss.hp,'state',sc.state);
    break;
  }
}
console.log('dmgTexts', sc.damageTexts.map(d=>d.text));
