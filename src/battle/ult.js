// ============================================================
// battle/ult.js — 大招系统
// 怒气条 0~100：打中 +18，弱点 +8，被打中 +12，用"你干嘛" +10
// 释放不消耗行动力，释放后清空怒气
// ============================================================

import { CONFIG } from '../config.js';

export const RAGE_MAX = 100;

export const ULTIMATES = {
  bomb: {
    id: 'bomb',
    name: '粉笔头轰炸',
    desc: '单发重弹，必定暴击，附带 60 范围溅射',
    icon: '💥',
    type: 'shot',
    damage: 8000,
    aoeRadius: 60,
    alwaysCrit: true,
    color: '#FF5252',
  },
  sweep: {
    id: 'sweep',
    name: '黑板擦横扫',
    desc: '范围 160 的大爆炸，清除全场番茄炒蛋汤汁',
    icon: '🧹',
    type: 'shot',
    damage: 6000,
    aoeRadius: 160,
    clearsSauce: true,
    color: '#7E57C2',
  },
  barrage: {
    id: 'barrage',
    name: '弹幕覆盖',
    desc: '8 发扇形弹幕，每发 14 伤害',
    icon: '🎆',
    type: 'volley',
    damage: 1400,
    count: 8,
    spreadDeg: 26,
    color: '#FFB300',
  },
  chase: {
    id: 'chase',
    name: '放学别走',
    desc: '3 发追踪弹，无视风力，每发 30 伤害',
    icon: '🎯',
    type: 'tracking',
    damage: 3000,
    count: 3,
    ignoreWind: true,
    color: '#26C6DA',
  },
  break: {
    id: 'break',
    name: '课间十分钟',
    desc: '回复 30% 生命，净化所有负面状态，1 回合免伤',
    icon: '☕',
    type: 'heal',
    healRatio: 0.30,
    cleanse: true,
    immuneTurns: 1,
    color: '#66BB6A',
  },
};

export const ULT_ORDER = ['bomb', 'sweep', 'barrage', 'chase', 'break'];

export function getUlt(id) {
  return ULTIMATES[id] || ULTIMATES.bomb;
}

export function addRage(unit, amount) {
  unit.rage = Math.min(RAGE_MAX, (unit.rage || 0) + amount);
  return unit.rage;
}

export function canUseUlt(unit) {
  return (unit.rage || 0) >= RAGE_MAX;
}

export function resetRage(unit) {
  unit.rage = 0;
}

// 怒气获取事件
export const RAGE_GAIN = {
  hit: 18,
  weakpoint: 8,
  hurt: 12,
  item: 10,
  ult: 0,
};
