// ============================================================
// battle/interactables.js — 场景互动物
// 吊扇 → 气流紊乱 / 投影仪 → 视野模糊 / 黑板报 → 粉笔灰
// ============================================================

import { CONFIG } from '../config.js';

const DEFS = [
  {
    id: 'fan', x: 430, y: 152, r: 34,
    label: '吊扇', effect: 'turbulence',
    color: '#90A4AE', glow: '#4FC3F7',
    desc: '打中后全场风向紊乱 2 回合',
  },
  {
    id: 'projector', x: 820, y: 118, r: 30,
    label: '投影仪', effect: 'blur',
    color: '#B0BEC5', glow: '#FFD54F',
    desc: '打中后老师视野模糊，命中率下降 2 回合',
  },
  {
    id: 'board', x: 148, y: 268, r: 46,
    label: '黑板报', effect: 'chalkDust',
    color: '#546E7A', glow: '#ECEFF1',
    desc: '打中后掉落粉笔灰，全场命中下降 2 回合',
  },
];

/**
 * 每关随机生成 1-2 个互动物（按关卡种子，保证同一关重玩一致）
 * @param {string} seed 关卡 id，决定随机结果
 */
export function createInteractables(seed = '') {
  const list = DEFS.map(d => ({ ...d, used: false, hitAnim: 0 }));
  // 无种子时全给（调试/测试用）
  if (!seed) return list;

  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const count = 1 + (h % 2);              // 1 或 2 个
  const start = h % list.length;
  const picked = [];
  for (let i = 0; i < count; i++) picked.push(list[(start + i) % list.length]);
  return picked;
}

/**
 * 检测弹丸是否命中互动物
 * @returns {object|null} 命中的互动物
 */
export function checkInteractableHit(projectiles, interactables) {
  for (const p of projectiles) {
    if (p.dead) continue;
    for (const it of interactables) {
      if (it.used) continue;
      const dx = p.x - it.x;
      const dy = p.y - it.y;
      if (dx * dx + dy * dy <= (it.r + (p.r || 6)) ** 2) {
        it.used = true;
        it.hitAnim = 1.0;
        p.dead = true;
        p.alive = false;   // 弹丸被互动物吃掉，不再继续飞行
        return it;
      }
    }
  }
  return null;
}

export const INTERACTABLE_DEFS = DEFS;
