// ============================================================
// ui/menu.js — 完整主菜单（多页面） + 剧情对话 + 结算页
// 页面：home / bosses / subjects / shop / talents / achievements
//       challenges / settings / story
// ============================================================

import { CONFIG } from '../config.js';
import { BOSSES } from '../data/bosses.js';
import { SUBJECTS, SUBJECT_ORDER } from '../data/subjects.js';
import { SKILLS, MAX_EQUIPPED_SKILLS } from '../data/skills.js';
import { ITEMS, ITEM_POOL } from '../data/items.js';
import { WEAPONS, WEAPON_POOL } from '../data/weapons.js';
import { ACHIEVEMENT_LIST } from '../data/achievements.js';
import { MODIFIER_LIST, getDailyChallenges, getWeeklyChallenge } from '../data/challenges.js';
import { TALENT_TREES, TALENT_ORDER, tierSpent, canUnlockTier, totalSpentPoints } from '../data/talents.js';
import { getStory, getStageQuote } from '../data/stories.js';
import { ULTIMATES, ULT_ORDER } from '../battle/ult.js';
import { isStageUnlocked, isSubjectDone, allBossesCleared, subjectProgress } from '../meta/progression.js';
import {
  skillUpgradePrice, weaponUpgradePrice, itemUpgradePrice,
  buyWeaponPack, upgradeSkill, upgradeWeapon, upgradeItem,
  buyExp, buyFragment, rerollWeapon, unlockTalent, respecTalents,
  equipSkill, equipWeapon,
} from '../meta/economy.js';
import { saveData, resetSave, createDefaultSave, expForLevel } from '../save.js';
import { Account } from '../account.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
const W = CONFIG.WIDTH;
const H = CONFIG.HEIGHT;

function rr(ctx, x, y, w, h, r = 12) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function hexA(hex, a) {
  if (!hex || hex[0] !== '#') return `rgba(255,255,255,${a})`;
  const v = hex.length === 4
    ? [parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16), parseInt(hex[3] + hex[3], 16)]
    : [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  return `rgba(${v[0]},${v[1]},${v[2]},${a})`;
}

function fit(ctx, text, maxW, size, weight = '') {
  ctx.font = `${weight ? weight + ' ' : ''}${size}px ${FONT}`;
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

// ============================================================
// 主菜单
// ============================================================
export class MenuScene {
  constructor(save) {
    this.save = save;
    this.page = 'home';
    this.t = 0;
    this.hits = [];
    this.subjectTab = 'chinese';
    this.shopTab = 'skill';
    this.toastText = '';
    this.toastTimer = 0;
    this.challengeSel = {};
    this.story = null;
    this.onStartBattle = null;   // (target, opts) => void
    this.onResetSave = null;     // () => newSave
    this.hover = { x: -1, y: -1 };
  }

  update(dt) {
    this.t += dt;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastText = '';
    }
  }

  _toast(text) {
    this.toastText = text;
    this.toastTimer = 2.4;
  }

  _persist() {
    saveData(this.save);
  }

  // ---------- 输入 ----------
  move(x, y) { this.hover.x = x; this.hover.y = y; }

  click(x, y) {
    if (this.page === 'story') { this._advanceStory(); return true; }
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const b = this.hits[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        this._act(b.action, b.data);
        return true;
      }
    }
    return false;
  }

  _act(cmd, data) {
    const idx = cmd.indexOf(':');
    const key = idx < 0 ? cmd : cmd.slice(0, idx);
    const arg = idx < 0 ? '' : cmd.slice(idx + 1);

    switch (key) {
      case 'page': this.page = arg; this.hits = []; break;
      case 'home': this.page = 'home'; break;
      case 'account': this._showAccountDialog(); break;
      case 'subjectTab': this.subjectTab = arg; break;
      case 'shopTab': this.shopTab = arg; break;
      case 'fightBoss': this._startBoss(arg); break;
      case 'fightStage': this._startStage(arg); break;
      case 'startChallenge': this._startChallenge(arg); break;
      case 'doChallenge': this._startDaily(arg); break;
      case 'toggleMod': this.challengeSel[arg] = !this.challengeSel[arg]; break;
      case 'clearMods': this.challengeSel = {}; break;
      case 'upSkill': this._do(upgradeSkill(this.save, arg)); break;
      case 'equipSkill': this._do(equipSkill(this.save, arg)); break;
      case 'upWeapon': this._do(upgradeWeapon(this.save, arg)); break;
      case 'equipWeapon': this._do(equipWeapon(this.save, arg)); break;
      case 'rerollWeapon': this._do(rerollWeapon(this.save, arg)); break;
      case 'upItem': this._do(upgradeItem(this.save, arg)); break;
      case 'buyPack': this._buyPack(); break;
      case 'buyExp': this._do(buyExp(this.save)); break;
      case 'buyFrag': this._buyFrag(arg); break;
      case 'talent': this._do(unlockTalent(this.save, data.tree, data.tier)); break;
      case 'respec': this._do(respecTalents(this.save)); break;
      case 'setDiff': this.save.settings.difficulty = arg; this._persist(); break;
      case 'setUlt': this.save.settings.ultId = arg; this._persist(); break;
      case 'toggleSound': this.save.settings.sound = !this.save.settings.sound; this._persist(); break;
      case 'toggleAim': this.save.settings.showAimLine = !this.save.settings.showAimLine; this._persist(); break;
      case 'resetSave': this._resetSave(); break;
      case 'story': this._advanceStory(); break;
      case 'storySkip': this._finishStory(); break;
      case 'noop': break;
      default: break;
    }
  }

  _do(res) {
    if (!res) return;
    if (res.ok) {
      this._persist();
      if (res.level) this._toast('升级成功！Lv.' + res.level);
      else if (res.weapon) this._toast('获得 ' + res.weapon.name);
      else if (res.removed) this._toast('已卸下');
      else if (res.added) this._toast('已装备');
      else if (res.unlocked) this._toast('技能解锁！');
      else if (res.refunded) this._toast('已重置，返还 ' + res.refunded + ' 点');
      else this._toast('完成');
    } else {
      this._toast(res.reason || '操作失败');
    }
  }

  _buyPack() {
    const res = buyWeaponPack(this.save);
    if (!res.ok) { this._toast(res.reason || '金币不足'); return; }
    this._persist();
    const q = CONFIG.QUALITY[res.quality] ? CONFIG.QUALITY[res.quality].name : '';
    this._toast(res.duplicated
      ? `${q}色 ${res.weapon.name}（重复，返还 ${res.refund} 金币）`
      : `抽到 ${q}色 ${res.weapon.name}！`);
  }

  _buyFrag(skillId) {
    const res = buyFragment(this.save, skillId);
    if (!res.ok) { this._toast(res.reason || '操作失败'); return; }
    this._persist();
    this._toast(res.unlocked
      ? '技能解锁！'
      : `碎片 ${res.fragments}/${res.need}`);
  }

  _resetSave() {
    if (!this._resetArm) {
      this._resetArm = true;
      this._toast('再点一次「重置存档」确认清空');
      setTimeout(() => { this._resetArm = false; }, 4000);
      return;
    }
    this._resetArm = false;
    const fresh = resetSave();
    if (this.onResetSave) this.onResetSave(fresh);
    this.save = fresh;
    this.page = 'home';
    this._toast('存档已重置');
  }

  _showAccountDialog() {
    const name = prompt('输入用户名（新用户自动注册）：', (window.__account && window.__account.name) || '');
    if (!name || !name.trim()) return;
    const pwd = prompt('输入密码：', '');
    if (pwd === null) return;
    if (Account.login(name.trim(), pwd)) {
      this.save = Save.load();
      this._toast('登录成功：' + name.trim());
    } else {
      this._toast('登录失败：密码错误');
    }
  }

  // ---------- 战斗入口 ----------
  _startBoss(bossId) {
    const story = getStory(bossId);
    if (story && story.intro) {
      this.story = { lines: story.intro, index: 0, target: bossId, opts: {} };
      this.page = 'story';
      return;
    }
    this._launch(bossId, {});
  }

  _startStage(stageId) {
    const q = getStageQuote(stageId);
    if (q && q.intro) {
      this.story = { lines: [{ who: '对手', text: q.intro }], index: 0, target: stageId, opts: {} };
      this.page = 'story';
      return;
    }
    this._launch(stageId, {});
  }

  // 每日 / 每周挑战：按预设对手 + 难度 + 修饰符直接开战
  _startDaily(key) {
    let list = [];
    try {
      const d = getDailyChallenges();
      const w = getWeeklyChallenge();
      if (Array.isArray(d)) list = list.concat(d);
      if (w) list.push(w);
    } catch (e) { /* ignore */ }
    const ch = list.find(x => x.id === key);
    if (!ch) { this._toast('挑战已过期'); return; }
    const cleared = (this.save.challenges && this.save.challenges.cleared) || {};
    this._launch(ch.bossId, {
      modifierIds: ch.modifiers.slice(),
      difficulty: ch.difficulty,
      challengeId: ch.id,
      challengeReward: ch.reward,
      challengeLabel: ch.label,
      cleared: !!cleared[ch.id],
    });
  }

  _startChallenge(bossId) {
    const ids = Object.keys(this.challengeSel).filter(k => this.challengeSel[k]);
    if (!ids.length) { this._toast('请至少选择一个挑战条件'); return; }
    this._launch(bossId, { modifierIds: ids });
  }

  _launch(target, opts) {
    if (this.onStartBattle) this.onStartBattle(target, opts);
  }

  _advanceStory() {
    if (!this.story) return;
    this.story.index++;
    if (this.story.index >= this.story.lines.length) this._finishStory();
  }

  _finishStory() {
    const s = this.story;
    this.story = null;
    this.page = 'home';
    if (s) this._launch(s.target, s.opts || {});
  }

  // ---------- 渲染 ----------
  render(ctx) {
    this.hits = [];
    this._bg(ctx);

    if (this.page === 'story') { this._renderStory(ctx); this._toastDraw(ctx); return; }

    if (this.page !== 'home') this._topBar(ctx);
    else this._statusBar(ctx);

    const fn = this['_render_' + this.page];
    if (typeof fn === 'function') fn.call(this, ctx);

    this._toastDraw(ctx);
  }

  _bg(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0f1320');
    g.addColorStop(0.55, '#151b2b');
    g.addColorStop(1, '#1d2334');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.028)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // 粉笔尘
    for (let i = 0; i < 30; i++) {
      const px = (i * 173 + this.t * (6 + (i % 5) * 3)) % (W + 60) - 30;
      const py = (i * 227 + Math.sin(this.t * 0.4 + i) * 22) % H;
      ctx.fillStyle = `rgba(255,255,255,${0.035 + (i % 3) * 0.02})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.4 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }

    // 左右光晕
    const rg = ctx.createRadialGradient(W * 0.5, -160, 40, W * 0.5, -160, 720);
    rg.addColorStop(0, 'rgba(255,214,102,0.10)');
    rg.addColorStop(1, 'rgba(255,214,102,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, 620);
  }

  _statusBar(ctx) {
    const s = this.save;
    const bx = W - 690, by = 26, bw = 664, bh = 60;
    rr(ctx, bx, by, bw, bh, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 等级
    ctx.fillStyle = '#FFD666';
    ctx.font = `bold 22px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('Lv.' + s.level, bx + 20, by + 22);
    const need = expForLevel(s.level);
    const ratio = Math.max(0, Math.min(1, s.exp / Math.max(1, need)));
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(bx + 20, by + 38, 150, 8);
    ctx.fillStyle = '#FFD666';
    ctx.fillRect(bx + 20, by + 38, 150 * ratio, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `11px ${FONT}`;
    ctx.fillText(`${s.exp}/${need}`, bx + 178, by + 42);

    const items = [
      ['金币', s.coins, '#FFD666'],
      ['积分', s.exp, '#4ECDC4'],
      ['天赋点', s.talents.points, '#FF6B6B'],
    ];
    let x = bx + 250;
    for (const [label, val, color] of items) {
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.font = `12px ${FONT}`;
      ctx.fillText(label, x, by + 20);
      ctx.fillStyle = color;
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillText(String(val), x, by + 40);
      x += 136;
    }
    ctx.textBaseline = 'alphabetic';
  }

  _topBar(ctx) {
    // 返回
    this._button(ctx, 30, 26, 120, 56, '← 返回', 'home', { size: 20 });
    // 标题
    const titles = {
      bosses: '主线挑战', subjects: '学科线', shop: '商店', talents: '天赋',
      achievements: '成就', challenges: '挑战', settings: '设置',
    };
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 30px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(titles[this.page] || '', W / 2, 64);
    ctx.textAlign = 'left';

    // 资源
    const s = this.save;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFD666';
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText(`金币 ${s.coins}`, W - 40, 46);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `16px ${FONT}`;
    ctx.fillText(`Lv.${s.level} · 积分 ${s.exp} · 天赋点 ${s.talents.points}`, W - 40, 72);
    ctx.textAlign = 'left';
  }

  _toastDraw(ctx) {
    if (!this.toastText) return;
    const a = Math.min(1, this.toastTimer * 2);
    ctx.font = `bold 22px ${FONT}`;
    const tw = ctx.measureText(this.toastText).width + 60;
    const x = W / 2 - tw / 2, y = H - 128;
    ctx.globalAlpha = a;
    rr(ctx, x, y, tw, 54, 27);
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,102,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#FFD666';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.toastText, W / 2, y + 28);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
  }

  // ---------- 通用控件 ----------
  _button(ctx, x, y, w, h, label, action, o = {}) {
    const disabled = !!o.disabled;
    const active = !!o.active;
    const hv = this.hover.x >= x && this.hover.x <= x + w && this.hover.y >= y && this.hover.y <= y + h;
    rr(ctx, x, y, w, h, o.r || 12);
    if (disabled) ctx.fillStyle = 'rgba(255,255,255,0.035)';
    else if (active) ctx.fillStyle = 'rgba(255,214,102,0.20)';
    else if (o.color) ctx.fillStyle = hexA(o.color, hv ? 0.30 : 0.17);
    else ctx.fillStyle = hv ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.075)';
    ctx.fill();

    ctx.strokeStyle = disabled ? 'rgba(255,255,255,0.08)'
      : active ? '#FFD666' : (o.color || 'rgba(255,255,255,0.22)');
    ctx.lineWidth = active ? 3 : 1.5;
    ctx.stroke();

    const size = o.size || 20;
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'middle';
    const tx = o.align === 'left' ? x + 16 : x + w / 2;
    ctx.fillStyle = disabled ? 'rgba(255,255,255,0.26)' : (o.textColor || '#FFFFFF');
    ctx.font = `${o.normal ? '' : 'bold '}${size}px ${FONT}`;
    ctx.fillText(label, tx, y + h / 2 + (o.sub ? -9 : 0));
    if (o.sub) {
      ctx.fillStyle = disabled ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.55)';
      ctx.font = `${o.subSize || 12}px ${FONT}`;
      ctx.fillText(o.sub, tx, y + h / 2 + 13);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    if (!disabled && action) this.hits.push({ x, y, w, h, action, data: o.data });
  }

  _card(ctx, x, y, w, h, o = {}) {
    rr(ctx, x, y, w, h, o.r || 16);
    ctx.fillStyle = o.fill || 'rgba(255,255,255,0.055)';
    ctx.fill();
    ctx.strokeStyle = o.stroke || 'rgba(255,255,255,0.13)';
    ctx.lineWidth = o.lw || 1.5;
    ctx.stroke();
  }

  _chip(ctx, x, y, text, color = '#FFFFFF', size = 13) {
    ctx.font = `${size}px ${FONT}`;
    const w = ctx.measureText(text).width + 18;
    rr(ctx, x, y - size - 2, w, size + 12, (size + 12) / 2);
    ctx.fillStyle = hexA(color, 0.18);
    ctx.fill();
    ctx.strokeStyle = hexA(color, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    return w;
  }

  _icon(ctx, cx, cy, r, text, color) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = hexA(color, 0.22);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.round(r * 0.95)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // ============================================================
  // 首页
  // ============================================================
  _render_home(ctx) {
    const s = this.save;

    // 标题
    ctx.textAlign = 'center';
    const bob = Math.sin(this.t * 1.6) * 4;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.font = `bold 84px ${FONT}`;
    ctx.fillText('班级弹射对战', W / 2 + 4, 168 + bob + 4);
    const tg = ctx.createLinearGradient(W / 2 - 300, 0, W / 2 + 300, 0);
    tg.addColorStop(0, '#FFD666');
    tg.addColorStop(0.5, '#FF8A65');
    tg.addColorStop(1, '#4ECDC4');
    ctx.fillStyle = tg;
    ctx.fillText('班级弹射对战', W / 2, 168 + bob);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `18px ${FONT}`;
    ctx.fillText('拖拽蓄力 · 可破坏地面 · 大招瞄准 · 手动移动', W / 2, 208 + bob);
    ctx.textAlign = 'left';

    // 装饰：漂浮的铅笔和书本
    for (let i = 0; i < 6; i++) {
      const px = (i * 260 + this.t * 20) % (W + 100) - 50;
      const py = 240 + Math.sin(this.t * 0.8 + i * 1.3) * 15 + i * 8;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.sin(this.t * 0.5 + i) * 0.1);
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = ['#FF6B6B','#4ECDC4','#FFD666','#BA68C8','#81C784','#64B5F6'][i];
      ctx.fillRect(-12, -3, 24, 6);
      ctx.beginPath();
      ctx.moveTo(12, -3);
      ctx.lineTo(18, 0);
      ctx.lineTo(12, 3);
      ctx.fill();
      ctx.restore();
    }

    // 主按钮 3×3
    const cw = 400, ch = 148, gx = 40, gy = 30;
    const startX = (W - (cw * 3 + gx * 2)) / 2;
    const startY = 268;

    const cells = [
      { label: '主线挑战', sub: '金 / 韩 / 吴 / 丁 / 黄 五位老师', color: '#FF6B6B', action: 'page:bosses', icon: '主' },
      { label: '学科线', sub: '语文 → 数学 → 英语', color: '#4ECDC4', action: 'page:subjects', icon: '科' },
      { label: '商店', sub: '武器 · 技能 · 道具 · 资源', color: '#FFD666', action: 'page:shop', icon: '商' },
      { label: '天赋', sub: `未分配 ${s.talents.points} 点`, color: '#FF8A65', action: 'page:talents', icon: '天' },
      { label: '成就', sub: `${Object.keys(s.achievements.unlocked || {}).length}/${ACHIEVEMENT_LIST.length}`, color: '#BA68C8', action: 'page:achievements', icon: '成' },
      { label: '挑战', sub: '叠加条件换高额金币', color: '#81C784', action: 'page:challenges', icon: '挑' },
      { label: '设置', sub: '难度 · 大招 · 音效', color: '#90A4AE', action: 'page:settings', icon: '设' },
      { label: '图鉴', sub: '16 技能 / 10 道具 / 6 武器', color: '#64B5F6', action: 'page:shop', icon: '鉴' },
      { label: '开始战斗', sub: allBossesCleared(s) ? '三位老师全部通过' : '从主线开始', color: '#FFFFFF', action: 'page:bosses', icon: '战' },
    ];

    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const col = i % 3, row = Math.floor(i / 3);
      const x = startX + col * (cw + gx);
      const y = startY + row * (ch + gy);
      const hv = this.hover.x >= x && this.hover.x <= x + cw && this.hover.y >= y && this.hover.y <= y + ch;
      this._card(ctx, x, y, cw, ch, {
        fill: hv ? hexA(c.color, 0.14) : 'rgba(255,255,255,0.055)',
        stroke: hv ? c.color : 'rgba(255,255,255,0.13)',
        lw: hv ? 2.5 : 1.5,
      });
      this._icon(ctx, x + 58, y + ch / 2, 30, c.icon, c.color);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold 26px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.label, x + 104, y + ch / 2 - 14);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `14px ${FONT}`;
      ctx.fillText(fit(ctx, c.sub, cw - 130, 14), x + 104, y + ch / 2 + 18);
      ctx.textBaseline = 'alphabetic';
      this.hits.push({ x, y, w: cw, h: ch, action: c.action });
    }

    // 底部条：难度 / 大招 / 音效
    const by = H - 96;
    this._card(ctx, 40, by, W - 80, 72, { fill: 'rgba(0,0,0,0.32)' });

    // 账号显示
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.font = `13px ${FONT}`;
    ctx.textAlign = 'left';
    const acct = (window.__account && window.__account.name) ? window.__account.name : '游客';
    ctx.fillText('账号', 62, by + 28);
    this._button(ctx, 110, by + 14, 120, 44, acct, 'account', { size: 15, color: '#4ECDC4' });

    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.font = `13px ${FONT}`;
    ctx.fillText('难度', 248, by + 28);
    const diffs = ['normal', 'hard', 'nightmare'];
    const names = { normal: '普通', hard: '困难', nightmare: '噩梦' };
    let dx = 296;
    for (const d of diffs) {
      this._button(ctx, dx, by + 14, 96, 44, names[d], 'setDiff:' + d, {
        active: s.settings.difficulty === d, size: 17,
      });
      dx += 106;
    }

    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.font = `13px ${FONT}`;
    ctx.fillText('大招', 452, by + 28);
    let ux = 500;
    for (const uid of ULT_ORDER) {
      const u = ULTIMATES[uid];
      this._button(ctx, ux, by + 14, 108, 44, u.name, 'setUlt:' + uid, {
        active: (s.settings.ultId || 'bomb') === uid, size: 14, color: u.color,
      });
      ux += 116;
    }

    this._button(ctx, W - 340, by + 14, 130, 44,
      s.settings.sound ? '音效 开' : '音效 关', 'toggleSound', { size: 16, active: s.settings.sound });
    this._button(ctx, W - 198, by + 14, 158, 44,
      s.settings.showAimLine ? '预测线 开' : '预测线 关', 'toggleAim', { size: 16, active: s.settings.showAimLine });
  }

  // ============================================================
  // 主线 Boss
  // ============================================================
  _render_bosses(ctx) {
    const s = this.save;
    const ids = ['jin', 'han', 'wu', 'lv', 'ma'];
    const cw = 340, ch = 520, gx = 24;
    const startX = (W - (cw * 5 + gx * 4)) / 2;
    const y = 140;

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const b = BOSSES[id];
      if (!b) continue;
      const x = startX + i * (cw + gx);
      const cleared = s.progress.bosses[id] === 1;
      const nm = s.stats.nightmareWins > 0 && cleared;

      this._card(ctx, x, y, cw, ch, {
        fill: hexA(b.color, 0.10),
        stroke: cleared ? '#FFD666' : hexA(b.color, 0.45),
        lw: cleared ? 2.5 : 1.5,
      });

      // 头像
      const cx = x + cw / 2;
      ctx.beginPath();
      ctx.arc(cx, y + 120, 62, 0, Math.PI * 2);
      ctx.fillStyle = hexA(b.color, 0.28);
      ctx.fill();
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.font = `bold 40px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((b.name || '')[0], cx, y + 122);
      ctx.textBaseline = 'alphabetic';

      // 名字
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold 32px ${FONT}`;
      ctx.fillText(b.name, cx, y + 222);
      ctx.fillStyle = hexA(b.color, 0.95);
      ctx.font = `17px ${FONT}`;
      ctx.fillText(b.title || '', cx, y + 252);
      ctx.textAlign = 'left';

      // 机制标签
      let ty = y + 300;
      const mech = {
        jin: ['点名预警', '拖堂', '狂暴叫家长', '弱点：笔袋 / 英语书'],
        han: ['口答问题', '题海战术', '狂暴状态', '弱点：试卷 / 计时器'],
        wu: ['禁写作业', '纪律检查', '没收作业', '弱点：教鞭 / 作业本'],
      }[id] || [];
      ctx.textAlign = 'center';
      for (const m of mech) {
        ctx.fillStyle = 'rgba(255,255,255,0.62)';
        ctx.font = `14px ${FONT}`;
        ctx.fillText('· ' + m, cx, ty);
        ty += 26;
      }
      ctx.textAlign = 'left';

      // 状态
      ctx.textAlign = 'center';
      ctx.fillStyle = cleared ? '#FFD666' : 'rgba(255,255,255,0.35)';
      ctx.font = `bold 16px ${FONT}`;
      ctx.fillText(cleared ? '已通关' + (nm ? ' · 噩梦已挑战' : '') : '未通关', cx, y + 452);
      ctx.textAlign = 'left';

      // 按钮
      this._button(ctx, x + 60, y + 478, cw - 120, 58, cleared ? '再战一次' : '开始挑战', 'fightBoss:' + id, {
        color: b.color, size: 22,
      });
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `14px ${FONT}`;
    ctx.fillText('三位老师都可以自由选择挑战顺序 · 难度与挑战条件在首页 / 挑战页设置', W / 2, H - 52);
    ctx.textAlign = 'left';
  }

  // ============================================================
  // 学科线
  // ============================================================
  _render_subjects(ctx) {
    const s = this.save;

    // 学科 tab
    let tx = 100;
    for (const sid of SUBJECT_ORDER) {
      const sub = SUBJECTS[sid];
      const done = isSubjectDone(s, sid);
      this._button(ctx, tx, 108, 260, 62, sub.name + (done ? ' ✓' : ''), 'subjectTab:' + sid, {
        active: this.subjectTab === sid, color: sub.color, size: 20,
      });
      tx += 276;
    }

    // 进度
    const sub = SUBJECTS[this.subjectTab];
    const prog = subjectProgress(s, this.subjectTab);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `15px ${FONT}`;
    ctx.fillText(`${sub.desc} · 进度 ${prog.cleared}/${prog.total}`, 100, 200);

    // 关卡卡
    const cw = 340, ch = 400, gx = 26;
    const startX = (W - (cw * 4 + gx * 3)) / 2;
    const y = 232;
    for (let i = 0; i < sub.stages.length; i++) {
      const st = sub.stages[i];
      const x = startX + i * (cw + gx);
      const unlocked = isStageUnlocked(s, this.subjectTab, i);
      const cleared = s.progress.stages[st.id] === 1;

      this._card(ctx, x, y, cw, ch, {
        fill: unlocked ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.025)',
        stroke: cleared ? '#FFD666' : unlocked ? hexA(sub.color, 0.4) : 'rgba(255,255,255,0.08)',
        lw: cleared ? 2.5 : 1.5,
      });

      const cx = x + cw / 2;
      ctx.beginPath();
      ctx.arc(cx, y + 92, 48, 0, Math.PI * 2);
      ctx.fillStyle = unlocked ? hexA(st.color || sub.color, 0.28) : 'rgba(255,255,255,0.05)';
      ctx.fill();
      ctx.strokeStyle = unlocked ? (st.color || sub.color) : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = unlocked ? (st.color || sub.color) : 'rgba(255,255,255,0.25)';
      ctx.font = `bold 32px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(unlocked ? (st.name || '?')[0] : '?', cx, y + 94);
      ctx.textBaseline = 'alphabetic';

      ctx.fillStyle = unlocked ? '#FFFFFF' : 'rgba(255,255,255,0.3)';
      ctx.font = `bold 24px ${FONT}`;
      ctx.fillText(unlocked ? st.name : '未解锁', cx, y + 176);
      ctx.fillStyle = unlocked ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.2)';
      ctx.font = `15px ${FONT}`;
      ctx.fillText(unlocked ? (st.title || '') : '先通过上一关', cx, y + 204);

      // 数值
      if (unlocked) {
        ctx.font = `13px ${FONT}`;
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillText(`HP ${st.hp}${st.isTwin ? ' ×2' : ''}`, cx, y + 240);
        ctx.fillText(`伤害 ${st.shotBaseDamage || 10}`, cx, y + 262);
        const wpn = (st.weakpoints || []).length;
        ctx.fillText(wpn ? `弱点 ${wpn} 处` : '无弱点', cx, y + 284);
        ctx.fillStyle = '#FFD666';
        ctx.fillText(`奖励 ${st.reward?.coins || 0} 金币 / ${st.reward?.exp || 0} 积分`, cx, y + 312);
      }

      ctx.textAlign = 'left';
      if (unlocked) {
        this._button(ctx, x + 60, y + ch - 68, cw - 120, 52, cleared ? '再打一次' : '开打', 'fightStage:' + st.id, {
          color: sub.color, size: 19,
        });
      }
    }

    // 徽章
    ctx.textAlign = 'center';
    ctx.fillStyle = isSubjectDone(s, this.subjectTab) ? '#FFD666' : 'rgba(255,255,255,0.3)';
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText(isSubjectDone(s, this.subjectTab) ? `${sub.badge} 已获得` : `通关全部 ${sub.stages.length} 关获得「${sub.badge}」`, W / 2, H - 60);
    ctx.textAlign = 'left';
  }

  // ============================================================
  // 商店
  // ============================================================
  _render_shop(ctx) {
    const s = this.save;
    const tabs = [
      ['skill', '技能'], ['weapon', '武器'], ['item', '道具'], ['res', '资源'],
    ];
    let tx = 100;
    for (const [id, name] of tabs) {
      this._button(ctx, tx, 106, 180, 56, name, 'shopTab:' + id, {
        active: this.shopTab === id, size: 19,
      });
      tx += 196;
    }

    if (this.shopTab === 'skill') this._shopSkills(ctx);
    else if (this.shopTab === 'weapon') this._shopWeapons(ctx);
    else if (this.shopTab === 'item') this._shopItems(ctx);
    else this._shopRes(ctx);
  }

  _shopSkills(ctx) {
    const s = this.save;
    const ids = Object.keys(SKILLS);
    const cw = 480, ch = 132, gx = 20, gy = 14;
    const startX = (W - (cw * 3 + gx * 2)) / 2;
    const y0 = 186;

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const sk = SKILLS[id];
      const x = startX + (i % 3) * (cw + gx);
      const y = y0 + Math.floor(i / 3) * (ch + gy);
      const unlocked = !!s.skillsUnlocked[id];
      const lv = s.skillLevels[id] || 1;
      const equipped = s.equipped.skills.includes(id);

      this._card(ctx, x, y, cw, ch, {
        fill: unlocked ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.025)',
        stroke: equipped ? '#FFD666' : unlocked ? hexA(sk.color, 0.35) : 'rgba(255,255,255,0.08)',
        lw: equipped ? 2.5 : 1.5,
      });

      this._icon(ctx, x + 42, y + 44, 24, sk.icon, unlocked ? sk.color : '#666');

      ctx.fillStyle = unlocked ? '#FFFFFF' : 'rgba(255,255,255,0.35)';
      ctx.font = `bold 19px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(fit(ctx, sk.name, 260, 19, 'bold'), x + 76, y + 38);

      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = `13px ${FONT}`;
      ctx.fillText(fit(ctx, sk.desc || '', cw - 100, 13), x + 76, y + 62);

      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = `13px ${FONT}`;
      ctx.fillText(`Lv.${lv}/5 · ${sk.ap}AP · CD ${sk.cdMax}`, x + 76, y + 88);

      if (!unlocked) {
        const frag = s.skillFragments[id] || 0;
        const need = sk.fragments || 10;
        const hint = sk.unlock === 'progress' ? (sk.unlockText || '进度解锁') : `碎片 ${frag}/${need}`;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = `12px ${FONT}`;
        ctx.fillText(fit(ctx, hint, 240, 12), x + 76, y + 110);
      }

      // 状态标签
      if (equipped) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#FFD666';
        ctx.font = `bold 13px ${FONT}`;
        ctx.fillText('已装备', x + cw - 18, y + 30);
        ctx.textAlign = 'left';
      }

      // 按钮
      const bw = 130, bh = 34, bx = x + cw - bw - 16, by = y + ch - bh - 14;
      if (unlocked) {
        const maxed = lv >= 5;
        this._button(ctx, bx, by, bw, bh, maxed ? '已满级' : `升级 ${skillUpgradePrice(lv)}`, 'upSkill:' + id, {
          size: 14, disabled: maxed || s.coins < skillUpgradePrice(lv),
        });
        this._button(ctx, bx - bw - 10, by, bw, bh, equipped ? '卸下' : '装备', 'equipSkill:' + id, {
          size: 14, color: equipped ? '#FF6B6B' : '#4ECDC4',
        });
      } else if (sk.unlock === 'fragment') {
        const frag = s.skillFragments[id] || 0;
        const need = sk.fragments || 10;
        this._button(ctx, bx, by, bw, bh, `碎片 ${frag}/${need}`, 'buyFrag:' + id, {
          size: 13, color: '#FFD666', disabled: s.coins < CONFIG.PRICES.skillFragment,
        });
      } else {
        this._button(ctx, bx, by, bw, bh, '进度解锁', 'noop', { size: 13, disabled: true });
      }
    }
  }

  _shopWeapons(ctx) {
    const s = this.save;
    // 抽卡按钮
    this._card(ctx, 100, 180, W - 200, 82, { fill: 'rgba(255,214,102,0.08)', stroke: 'rgba(255,214,102,0.35)' });
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText('武器包', 128, 212);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `13px ${FONT}`;
    ctx.fillText('绿 60% / 蓝 25% / 紫 12% / 金 3% · 重复返还一半金币', 128, 240);
    this._button(ctx, W - 380, 196, 240, 50, `抽一把 ${CONFIG.PRICES.weaponPack} 金币`, 'buyPack', {
      color: '#FFD666', size: 17, disabled: s.coins < CONFIG.PRICES.weaponPack,
    });

    const ids = WEAPON_POOL;
    const cw = 480, ch = 176, gx = 20, gy = 16;
    const startX = (W - (cw * 3 + gx * 2)) / 2;
    const y0 = 286;

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const w = WEAPONS[id];
      const inst = s.weapons.owned[id];
      const x = startX + (i % 3) * (cw + gx);
      const y = y0 + Math.floor(i / 3) * (ch + gy);
      const equipped = s.weapons.equipped === id;
      const q = CONFIG.QUALITY[w.quality] || { name: '?', color: '#888' };

      this._card(ctx, x, y, cw, ch, {
        fill: inst ? hexA(q.color, 0.09) : 'rgba(255,255,255,0.025)',
        stroke: equipped ? '#FFD666' : inst ? hexA(q.color, 0.4) : 'rgba(255,255,255,0.08)',
        lw: equipped ? 2.5 : 1.5,
      });

      this._icon(ctx, x + 42, y + 42, 24, w.icon, inst ? q.color : '#666');
      ctx.fillStyle = inst ? '#FFFFFF' : 'rgba(255,255,255,0.35)';
      ctx.font = `bold 19px ${FONT}`;
      ctx.fillText(w.name, x + 76, y + 36);
      ctx.fillStyle = q.color;
      ctx.font = `bold 13px ${FONT}`;
      ctx.fillText(q.name + '色', x + 76 + ctx.measureText(w.name).width + 40, y + 36);

      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = `12px ${FONT}`;
      ctx.fillText(fit(ctx, w.desc || '', cw - 100, 12), x + 76, y + 58);

      if (inst) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = `13px ${FONT}`;
        ctx.fillText(`Lv.${inst.level}/5`, x + 76, y + 82);
        // 词条
        const affixes = inst.affixes || [];
        if (affixes.length) {
          ctx.font = `12px ${FONT}`;
          for (let k = 0; k < affixes.length; k++) {
            const a = affixes[k];
            ctx.fillStyle = a.negative ? '#FF6B6B' : '#81C784';
            ctx.fillText(fit(ctx, (a.negative ? '− ' : '+ ') + (a.name || a.id) + ' ' + (a.value ?? ''), cw - 120, 12),
              x + 76, y + 104 + k * 17);
          }
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.font = `12px ${FONT}`;
          ctx.fillText('无词条', x + 76, y + 104);
        }

        const bw = 118, bh = 32;
        const bx = x + cw - bw - 14, by = y + ch - bh - 12;
        this._button(ctx, bx, by, bw, bh, equipped ? '使用中' : '装备', 'equipWeapon:' + id, {
          size: 13, color: equipped ? '#FFD666' : '#4ECDC4', disabled: equipped,
        });
        this._button(ctx, bx - bw - 8, by, bw, bh, inst.level >= 5 ? '满级' : `升级 ${weaponUpgradePrice(inst.level)}`, 'upWeapon:' + id, {
          size: 12, disabled: inst.level >= 5 || s.coins < weaponUpgradePrice(inst.level),
        });
        this._button(ctx, bx - bw * 2 - 16, by, bw, bh, `洗练 ${CONFIG.PRICES.rerollCard}`, 'rerollWeapon:' + id, {
          size: 12, color: '#BA68C8', disabled: s.coins < CONFIG.PRICES.rerollCard,
        });
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.font = `13px ${FONT}`;
        ctx.fillText('未拥有 · 通过武器包获取', x + 76, y + 92);
      }
    }
  }

  _shopItems(ctx) {
    const s = this.save;
    const cw = 480, ch = 132, gx = 20, gy = 14;
    const startX = (W - (cw * 3 + gx * 2)) / 2;
    const y0 = 186;

    for (let i = 0; i < ITEM_POOL.length; i++) {
      const id = ITEM_POOL[i];
      const it = ITEMS[id];
      const x = startX + (i % 3) * (cw + gx);
      const y = y0 + Math.floor(i / 3) * (ch + gy);
      const lv = s.itemLevels[id] || 1;
      const maxed = it.upgradable === false || lv >= 5;

      this._card(ctx, x, y, cw, ch, { fill: hexA(it.color, 0.07), stroke: hexA(it.color, 0.3) });
      this._icon(ctx, x + 42, y + 44, 24, it.icon, it.color);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold 19px ${FONT}`;
      ctx.fillText(it.name, x + 76, y + 38);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = `13px ${FONT}`;
      ctx.fillText(fit(ctx, it.desc || '', cw - 100, 13), x + 76, y + 62);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = `13px ${FONT}`;
      ctx.fillText(it.upgradable === false ? `${it.ap}AP · 不可升级` : `${it.ap}AP · Lv.${lv}/5`, x + 76, y + 88);

      const bw = 130, bh = 34, bx = x + cw - bw - 16, by = y + ch - bh - 14;
      if (maxed) {
        this._button(ctx, bx, by, bw, bh, '已满级', 'noop', { size: 14, disabled: true });
      } else {
        this._button(ctx, bx, by, bw, bh, `升级 ${itemUpgradePrice(lv)}`, 'upItem:' + id, {
          size: 14, disabled: s.coins < itemUpgradePrice(lv),
        });
      }
    }
  }

  _shopRes(ctx) {
    const s = this.save;
    const cards = [
      { title: '买积分', desc: `花 ${CONFIG.PRICES.exp100} 金币换 100 积分`, btn: `购买 ${CONFIG.PRICES.exp100}`, action: 'buyExp', color: '#4ECDC4' },
      { title: '技能碎片', desc: `花 ${CONFIG.PRICES.skillFragment} 金币买 1 个碎片（在技能页指定）`, btn: '去技能页', action: 'shopTab:skill', color: '#FFD666' },
      { title: '转班申请单', desc: `花 ${CONFIG.PRICES.respecTicket} 金币重置全部天赋，全额返还天赋点`, btn: `洗点 ${CONFIG.PRICES.respecTicket}`, action: 'respec', color: '#FF6B6B' },
    ];
    const cw = 440, ch = 260, gx = 40;
    const startX = (W - (cw * 3 + gx * 2)) / 2;
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const x = startX + i * (cw + gx), y = 220;
      this._card(ctx, x, y, cw, ch, { fill: hexA(c.color, 0.08), stroke: hexA(c.color, 0.35) });
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold 24px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(c.title, x + cw / 2, y + 62);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `14px ${FONT}`;
      const lines = c.desc.split('，');
      let ly = y + 106;
      for (const ln of lines) {
        ctx.fillText(fit(ctx, ln, cw - 50, 14), x + cw / 2, ly);
        ly += 24;
      }
      ctx.textAlign = 'left';
      this._button(ctx, x + 60, y + ch - 82, cw - 120, 54, c.btn, c.action, { color: c.color, size: 18 });
    }

    // 统计
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `14px ${FONT}`;
    ctx.fillText(`总胜场 ${s.stats.totalWins} · 超暴击 ${s.stats.superCrits} · 最高单发 ${s.stats.maxSingleHit} · 噩梦胜场 ${s.stats.nightmareWins}`, W / 2, 540);
    ctx.textAlign = 'left';
  }

  // ============================================================
  // 天赋
  // ============================================================
  _render_talents(ctx) {
    const s = this.save;
    const cw = 460, gx = 40;
    const startX = (W - (cw * 3 + gx * 2)) / 2;

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `15px ${FONT}`;
    ctx.fillText(`可用天赋点：${s.talents.points} · 每升 1 级得 1 点 · 每系需点满上一层才能继续`, 100, 110);
    this._button(ctx, W - 320, 84, 260, 50, `洗点 ${CONFIG.PRICES.respecTicket} 金币`, 'respec', {
      color: '#FF6B6B', size: 16, disabled: s.coins < CONFIG.PRICES.respecTicket || totalSpentPoints(s) === 0,
    });

    for (let i = 0; i < TALENT_ORDER.length; i++) {
      const tid = TALENT_ORDER[i];
      const tree = TALENT_TREES[tid];
      const x = startX + i * (cw + gx);
      const y = 158;

      this._card(ctx, x, y, cw, 640, { fill: hexA(tree.color, 0.06), stroke: hexA(tree.color, 0.28) });
      this._icon(ctx, x + 46, y + 46, 24, tree.icon, tree.color);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold 24px ${FONT}`;
      ctx.fillText(tree.name, x + 82, y + 44);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = `13px ${FONT}`;
      ctx.fillText(tree.desc || '', x + 82, y + 68);

      for (let k = 0; k < tree.tiers.length; k++) {
        const tier = tree.tiers[k];
        const ty = y + 96 + k * 104;
        const owned = !!s.talents.spent[tier.id];
        const can = canUnlockTier(s, tid, k);
        const hh = 92;

        rr(ctx, x + 16, ty, cw - 32, hh, 12);
        ctx.fillStyle = owned ? hexA(tree.color, 0.20) : can ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)';
        ctx.fill();
        ctx.strokeStyle = owned ? tree.color : can ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)';
        ctx.lineWidth = owned ? 2 : 1.2;
        ctx.stroke();

        ctx.fillStyle = owned ? tree.color : can ? '#FFFFFF' : 'rgba(255,255,255,0.32)';
        ctx.font = `bold 16px ${FONT}`;
        ctx.fillText(`${k + 1}. ${tier.name}`, x + 34, ty + 30);
        ctx.fillStyle = owned ? 'rgba(255,255,255,0.8)' : can ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)';
        ctx.font = `13px ${FONT}`;
        ctx.fillText(fit(ctx, tier.desc, cw - 160, 13), x + 34, ty + 56);

        if (owned) {
          ctx.fillStyle = tree.color;
          ctx.font = `bold 14px ${FONT}`;
          ctx.textAlign = 'right';
          ctx.fillText('已点亮', x + cw - 34, ty + 30);
          ctx.textAlign = 'left';
        } else {
          this._button(ctx, x + cw - 122, ty + 44, 90, 36, '点亮', 'talent:' + tid + ':' + k, {
            size: 14, color: tree.color, disabled: !can,
            data: { tree: tid, tier: k },
          });
        }
      }
    }
  }

  // ============================================================
  // 成就
  // ============================================================
  _render_achievements(ctx) {
    const s = this.save;
    const cw = 480, ch = 74, gx = 20, gy = 12;
    const startX = (W - (cw * 3 + gx * 2)) / 2;
    const y0 = 112;
    const unlocked = s.achievements.unlocked || {};

    for (let i = 0; i < ACHIEVEMENT_LIST.length; i++) {
      const a = ACHIEVEMENT_LIST[i];
      const x = startX + (i % 3) * (cw + gx);
      const y = y0 + Math.floor(i / 3) * (ch + gy);
      const got = !!unlocked[a.id];

      this._card(ctx, x, y, cw, ch, {
        fill: got ? 'rgba(255,214,102,0.10)' : 'rgba(255,255,255,0.03)',
        stroke: got ? 'rgba(255,214,102,0.5)' : 'rgba(255,255,255,0.08)',
      });
      this._icon(ctx, x + 38, y + ch / 2, 20, got ? '✓' : '?', got ? '#FFD666' : '#555');

      ctx.fillStyle = got ? '#FFD666' : 'rgba(255,255,255,0.4)';
      ctx.font = `bold 16px ${FONT}`;
      ctx.fillText(fit(ctx, a.name, 240, 16, 'bold'), x + 68, y + 30);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = `12px ${FONT}`;
      ctx.fillText(fit(ctx, a.desc, cw - 190, 12), x + 68, y + 52);

      ctx.textAlign = 'right';
      ctx.fillStyle = got ? 'rgba(255,214,102,0.8)' : 'rgba(255,255,255,0.25)';
      ctx.font = `bold 14px ${FONT}`;
      ctx.fillText('+' + a.coins, x + cw - 18, y + 34);
      if (a.title) {
        ctx.fillStyle = got ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)';
        ctx.font = `11px ${FONT}`;
        ctx.fillText(a.title, x + cw - 18, y + 54);
      }
      ctx.textAlign = 'left';
    }
  }

  // ============================================================
  // 挑战
  // ============================================================
  _render_challenges(ctx) {
    const s = this.save;
    const cw = 740, ch = 108, gx = 24, gy = 12;
    const startX = (W - (cw * 2 + gx)) / 2;

    const sel = Object.keys(this.challengeSel).filter(k => this.challengeSel[k]).length;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `15px ${FONT}`;
    ctx.fillText(`已选 ${sel} 个条件 · 条件越多金币加成越高 · 通关后记录到挑战进度`, 100, 104);
    this._button(ctx, W - 240, 82, 180, 42, '清空选择', 'clearMods', { size: 15 });

    for (let i = 0; i < MODIFIER_LIST.length; i++) {
      const m = MODIFIER_LIST[i];
      const x = startX + (i % 2) * (cw + gx);
      const y = 126 + Math.floor(i / 2) * (ch + gy);
      const on = !!this.challengeSel[m.id];
      const cleared = s.challenges.cleared[m.id] || 0;

      this._card(ctx, x, y, cw, ch, {
        fill: on ? 'rgba(255,214,102,0.13)' : 'rgba(255,255,255,0.045)',
        stroke: on ? '#FFD666' : 'rgba(255,255,255,0.12)',
        lw: on ? 2.5 : 1.5,
      });
      // 勾选框
      rr(ctx, x + 20, y + ch / 2 - 16, 32, 32, 8);
      ctx.fillStyle = on ? '#FFD666' : 'rgba(255,255,255,0.06)';
      ctx.fill();
      ctx.strokeStyle = on ? '#FFD666' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (on) {
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 28, y + ch / 2);
        ctx.lineTo(x + 34, y + ch / 2 + 7);
        ctx.lineTo(x + 45, y + ch / 2 - 8);
        ctx.stroke();
      }

      ctx.fillStyle = on ? '#FFFFFF' : 'rgba(255,255,255,0.7)';
      ctx.font = `bold 19px ${FONT}`;
      ctx.fillText(m.name, x + 70, y + 40);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = `13px ${FONT}`;
      ctx.fillText(fit(ctx, m.desc, cw - 160, 13), x + 70, y + 66);
      if (cleared) {
        ctx.fillStyle = 'rgba(129,199,132,0.8)';
        ctx.font = `12px ${FONT}`;
        ctx.fillText(`已通过 ${cleared} 次`, x + 70, y + 88);
      }
      this.hits.push({ x, y, w: cw, h: ch, action: 'toggleMod:' + m.id });
    }

    // 选择对手
    const by = 610;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText('选择对手开始挑战', W / 2, by - 14);
    ctx.textAlign = 'left';

    const ids = ['jin', 'han', 'wu'];
    const bw = 320, bg = 30;
    const bsx = (W - (bw * 3 + bg * 2)) / 2;
    for (let i = 0; i < ids.length; i++) {
      const b = BOSSES[ids[i]];
      this._button(ctx, bsx + i * (bw + bg), by, bw, 64, `挑战 ${b.name}`, 'startChallenge:' + ids[i], {
        color: b.color, size: 20, disabled: sel === 0,
      });
    }

    // ---------- 每日 / 每周挑战 ----------
    let daily = null, weekly = null;
    try { daily = getDailyChallenges(); weekly = getWeeklyChallenge(); } catch (e) { /* ignore */ }
    const list = [];
    if (Array.isArray(daily)) for (const d of daily.slice(0, 3)) list.push(d);
    if (weekly) list.push(weekly);
    if (!list.length) return;

    const dcy = 700;
    ctx.fillStyle = '#FFD666';
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText('每日 / 每周挑战（固定对手 + 固定条件，通关有额外奖励）', 100, dcy - 10);

    const n = list.length;
    const gap = 16;
    const dw = Math.floor((W - 200 - gap * (n - 1)) / n);
    const dh = 104;
    const clearedMap = (s.challenges && s.challenges.cleared) || {};

    for (let i = 0; i < n; i++) {
      const c = list[i];
      const x = 100 + i * (dw + gap);
      const y = dcy;
      const isWeekly = c.kind === 'weekly';
      const done = !!clearedMap[c.id];
      const accent = isWeekly ? '#FF8A65' : '#4FC3F7';

      this._card(ctx, x, y, dw, dh, {
        fill: done ? 'rgba(129,199,132,0.10)' : 'rgba(255,255,255,0.045)',
        stroke: done ? 'rgba(129,199,132,0.55)' : hexA(accent, 0.45),
        lw: 1.5,
      });

      ctx.fillStyle = accent;
      ctx.font = `bold 15px ${FONT}`;
      ctx.fillText(c.label || (isWeekly ? '每周挑战' : '每日挑战'), x + 16, y + 26);

      const boss = BOSSES[c.bossId];
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `bold 17px ${FONT}`;
      ctx.fillText(boss ? boss.name : c.bossId, x + 16, y + 50);

      const diffName = { normal: '普通', hard: '困难', nightmare: '噩梦' }[c.difficulty] || c.difficulty;
      const modNames = (c.modifiers || []).map(id => {
        const m = MODIFIER_LIST.find(x2 => x2.id === id);
        return m ? m.name : id;
      }).join(' + ');
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = `12px ${FONT}`;
      ctx.fillText(fit(ctx, `${diffName} · ${modNames}`, dw - 32, 12), x + 16, y + 72);

      ctx.fillStyle = done ? '#81C784' : '#FFD666';
      ctx.font = `bold 13px ${FONT}`;
      ctx.fillText(done ? '已完成 · 可重复挑战' : `+${c.reward.coins} 金币`, x + 16, y + 94);

      this.hits.push({ x, y, w: dw, h: dh, action: 'doChallenge:' + c.id });
    }
  }

  // ============================================================
  // 设置
  // ============================================================
  _render_settings(ctx) {
    const s = this.save;
    const x = 160, w = W - 320;
    let y = 130;

    const section = (title) => {
      ctx.fillStyle = '#FFD666';
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillText(title, x, y);
      y += 22;
    };

    // 难度
    section('难度');
    const diffs = [
      ['normal', '普通', '标准体验'],
      ['hard', '困难', '血量 ×1.3 · 伤害 ×1.2 · 金币 ×1.6'],
      ['nightmare', '噩梦', '血量 ×1.6 · 伤害 ×1.4 · 多一个机制 · 金币 ×2.5'],
    ];
    let dx = x;
    for (const [id, name, desc] of diffs) {
      this._button(ctx, dx, y, 380, 78, name, 'setDiff:' + id, {
        active: s.settings.difficulty === id, sub: desc, size: 20, subSize: 12,
      });
      dx += 400;
    }
    y += 108;

    // 大招
    section('出战大招');
    let ux = x;
    for (const uid of ULT_ORDER) {
      const u = ULTIMATES[uid];
      this._button(ctx, ux, y, 220, 78, u.name, 'setUlt:' + uid, {
        active: (s.settings.ultId || 'bomb') === uid,
        color: u.color, size: 17, sub: u.type === 'heal' ? '治疗 / 净化' : `伤害 ${u.damage || 0}`, subSize: 12,
      });
      ux += 232;
    }
    y += 112;

    // 开关
    section('其他');
    this._button(ctx, x, y, 260, 62, s.settings.sound ? '音效：开' : '音效：关', 'toggleSound', {
      active: s.settings.sound, size: 18,
    });
    this._button(ctx, x + 280, y, 260, 62, s.settings.showAimLine ? '预测线：开' : '预测线：关', 'toggleAim', {
      active: s.settings.showAimLine, size: 18,
    });
    this._button(ctx, W - x - 300, y, 300, 62, this._resetArm ? '再点一次确认重置' : '重置存档', 'resetSave', {
      color: '#FF6B6B', size: 18,
    });
    y += 100;

    // 统计
    section('统计');
    const st = s.stats;
    const rows = [
      ['总胜场', st.totalWins], ['总败场', st.totalLosses], ['总发射', st.totalShots],
      ['超暴击', st.superCrits], ['最高单发', st.maxSingleHit], ['单场最多弱点', st.maxWeakpointsOneBattle],
      ['无伤通关', st.noDamageWins], ['噩梦胜场', st.nightmareWins], ['累计金币', st.totalCoinsEarned],
    ];
    for (let i = 0; i < rows.length; i++) {
      const rx = x + (i % 3) * 400;
      const ry = y + Math.floor(i / 3) * 34;
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = `14px ${FONT}`;
      ctx.fillText(rows[i][0], rx, ry);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold 15px ${FONT}`;
      ctx.fillText(String(rows[i][1] ?? 0), rx + 130, ry);
    }
  }

  // ============================================================
  // 剧情
  // ============================================================
  _renderStory(ctx) {
    const st = this.story;
    if (!st) return;
    const line = st.lines[Math.min(st.index, st.lines.length - 1)];
    if (!line) return;

    // 暗化
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);

    // 说话人立绘位
    const isMe = line.who === '我';
    const px = isMe ? W * 0.28 : W * 0.72;
    const bob = Math.sin(this.t * 2) * 6;

    ctx.beginPath();
    ctx.arc(px, H * 0.42 + bob, 110, 0, Math.PI * 2);
    ctx.fillStyle = isMe ? 'rgba(78,205,196,0.22)' : 'rgba(255,107,107,0.22)';
    ctx.fill();
    ctx.strokeStyle = isMe ? '#4ECDC4' : '#FF6B6B';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = isMe ? '#4ECDC4' : '#FF6B6B';
    ctx.font = `bold 64px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isMe ? '我' : (line.who || '?')[0], px, H * 0.42 + bob + 2);
    ctx.textBaseline = 'alphabetic';

    // 名字
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillText(line.who || '', px, H * 0.42 + 170);

    // 对话框
    const bx = 140, by = H - 300, bw = W - 280, bh = 190;
    rr(ctx, bx, by, bw, bh, 18);
    ctx.fillStyle = 'rgba(12,16,28,0.94)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,102,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `26px ${FONT}`;
    ctx.textAlign = 'left';
    // 自动换行
    const maxW = bw - 80;
    const chars = (line.text || '').split('');
    let lx = bx + 40, ly = by + 66;
    for (const ch of chars) {
      if (ctx.measureText(ch).width + lx - (bx + 40) > maxW) { lx = bx + 40; ly += 42; }
      ctx.fillText(ch, lx, ly);
      lx += ctx.measureText(ch).width;
    }

    // 提示
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${st.index + 1}/${st.lines.length} · 点击继续`, bx + bw - 32, by + bh - 22);
    ctx.textAlign = 'left';

    this._button(ctx, W / 2 - 110, H - 88, 220, 52, '跳过对话', 'storySkip', { size: 17 });
    this.hits.push({ x: 0, y: 0, w: W, h: H - 100, action: 'story' });
  }
}

// ============================================================
// 结算页
// ============================================================
export class ResultScene {
  constructor(save) {
    this.save = save;
    this.t = 0;
    this.hits = [];
    this.info = null;
    this.hover = { x: -1, y: -1 };
    this.achIndex = 0;
  }

  show(info) {
    this.info = info;
    this.t = 0;
    this.hits = [];
    this.achIndex = 0;
    this._achTimer = 0;
  }

  update(dt) { this.t += dt; }
  move(x, y) { this.hover.x = x; this.hover.y = y; }

  click(x, y) {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const b = this.hits[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.action;
    }
    return null;
  }

  _button(ctx, x, y, w, h, label, action, o = {}) {
    const hv = this.hover.x >= x && this.hover.x <= x + w && this.hover.y >= y && this.hover.y <= y + h;
    rr(ctx, x, y, w, h, 14);
    ctx.fillStyle = o.color ? hexA(o.color, hv ? 0.32 : 0.18) : (hv ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)');
    ctx.fill();
    ctx.strokeStyle = o.color || 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${o.size || 22}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    this.hits.push({ x, y, w, h, action });
  }

  render(ctx) {
    this.hits = [];
    const info = this.info || {};
    const win = !!info.victory;

    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (win) { g.addColorStop(0, '#0d1a24'); g.addColorStop(1, '#16232c'); }
    else { g.addColorStop(0, '#1a0f14'); g.addColorStop(1, '#241419'); }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const a = Math.min(1, this.t * 2.2);

    // 标题
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = win ? '#FFD666' : '#FF6B6B';
    ctx.font = `bold 96px ${FONT}`;
    ctx.fillText(win ? '胜利' : '失败', W / 2, 200);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `20px ${FONT}`;
    ctx.fillText(info.title || '', W / 2, 244);
    ctx.textAlign = 'left';

    // 奖励
    const rw = info.reward || {};
    const bx = W / 2 - 340, by = 300, bw = 680;
    rr(ctx, bx, by, bw, 210, 18);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const rows = [
      ['金币', (win ? '+' : '') + (rw.coins || 0), '#FFD666'],
      ['积分', (win ? '+' : '') + (rw.exp || 0), '#4ECDC4'],
      ['弱点破坏', String(info.weakpoints || 0), '#FF8A65'],
      ['最高单发', String(info.maxHit || 0), '#BA68C8'],
    ];
    for (let i = 0; i < rows.length; i++) {
      const cx = bx + 60 + (i % 2) * 330;
      const cy = by + 60 + Math.floor(i / 2) * 86;
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.font = `14px ${FONT}`;
      ctx.fillText(rows[i][0], cx, cy);
      ctx.fillStyle = rows[i][2];
      ctx.font = `bold 34px ${FONT}`;
      ctx.fillText(rows[i][1], cx, cy + 38);
    }

    // 成就
    const achs = info.achievements || [];
    if (achs.length) {
      ctx.fillStyle = '#FFD666';
      ctx.font = `bold 18px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('解锁成就', W / 2, 560);
      let ax = W / 2 - (achs.length * 220) / 2;
      for (const id of achs) {
        const ach = (typeof id === 'string' ? ACHIEVEMENT_LIST.find(x => x.id === id) : id) || { name: String(id), coins: 0 };
        rr(ctx, ax, 576, 210, 68, 12);
        ctx.fillStyle = 'rgba(255,214,102,0.14)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,214,102,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#FFD666';
        ctx.font = `bold 15px ${FONT}`;
        ctx.fillText(fit(ctx, ach.name, 180, 15, 'bold'), ax + 105, 604);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = `12px ${FONT}`;
        ctx.fillText('+' + ach.coins + ' 金币', ax + 105, 626);
        ctx.textAlign = 'left';
        ax += 226;
      }
      ctx.textAlign = 'center';
    }

    ctx.globalAlpha = 1;

    // 按钮
    const by2 = H - 140;
    const bw2 = 260, bg2 = 40;
    const labels = [];
    labels.push({ label: '返回菜单', action: 'menu', color: '#90A4AE' });
    if (info.canRetry !== false) labels.push({ label: '再来一次', action: 'retry', color: '#4ECDC4' });
    if (win && info.nextTarget) labels.push({ label: '下一关', action: 'next', color: '#FFD666' });
    if (!win) labels.push({ label: '调整配置', action: 'menu', color: '#FF6B6B' });

    const total = labels.length * bw2 + (labels.length - 1) * bg2;
    let lx2 = W / 2 - total / 2;
    for (const l of labels) {
      this._button(ctx, lx2, by2, bw2, 66, l.label, l.action, { color: l.color, size: 21 });
      lx2 += bw2 + bg2;
    }
  }
}
