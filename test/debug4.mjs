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

const sc = new BattleScene(canvas,'jin',createDefaultSave(),{});
sc._init();
const dt=1/120;
for(let i=0;i<4000 && sc.state!=='player_turn';i++) sc._update(dt);
sc.player.ap=6;
const tx=sc.boss.x, ty=sc.boss.y-4;
console.log('target', tx.toFixed(0), ty.toFixed(0), 'boss r', sc.boss.radius);

function search(){
  const R=8, hitR=36+R;
  for(let sp=1200;sp>=VMIN;sp-=8){
    for(let deg=6;deg<=72;deg+=0.5){
      const ang=deg*Math.PI/180;
      let px=sc.player.x+Math.cos(ang)*(sc.player.radius+R);
      let py=sc.player.y-sc.player.radius/2+Math.sin(ang)*(sc.player.radius+R);
      let vx=Math.cos(ang)*sp, vy=-Math.sin(ang)*sp;
      const h=1/240;
      let ok=false;
      for(let i=0;i<2400;i++){
        vy+=G*h; px+=vx*h; py+=vy*h;
        if(Math.hypot(px-tx,py-ty)<=hitR){ok=true;break;}
        let b=false;
        for(const t of sc.terrain){ if(t.destroyed)continue; if(t.hitTest(px,py,6)){b=true;break;} }
        if(b)break;
        if(py>CONFIG.GROUND_Y||px>CONFIG.WIDTH||px<0)break;
      }
      if(ok){
        const ratio=Math.min(1,Math.max(0,(sp-VMIN)/(VMAX-VMIN)));
        const drag=DEAD+ratio*(DMAX-DEAD);
        return {sp,deg,drag,dx:-Math.cos(ang)*drag,dy:-Math.sin(ang)*drag};
      }
    }
  }
  return null;
}
const a=search();
console.log('solution', a);
if(!a){ console.log('NO SOLUTION'); process.exit(0); }

sc.aimMode='justice'; sc.state='player_aiming'; sc._aimDragging=true;
sc._firePlayerShot(a.dx,a.dy,Math.hypot(a.dx,a.dy));
const p=sc.projectiles[0];
console.log('proj', p? `${p.x.toFixed(0)},${p.y.toFixed(0)} v${p.vx.toFixed(0)},${p.vy.toFixed(0)}` : 'NONE', 'state', sc.state);
for(let f=0;f<400;f++){
  sc._update(dt);
  const q=sc.projectiles[0];
  if(q){ if(f%15===0) console.log('f',f,q.x.toFixed(0),q.y.toFixed(0),'bossHp',sc.boss.hp); }
  else { console.log('gone f',f,'bossHp',sc.boss.hp,'state',sc.state); break; }
}
