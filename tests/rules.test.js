"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../rules.js");

test("负载在三角数门槛增加；负力量不会额外增加负荷", () => {
  assert.deepEqual([0, 1, 2, 3, 5, 6, 9, 10, 14, 15, 55].map(rules.burden), [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 10]);
  assert.equal(rules.encumbrance(9, -3), 3);
  assert.equal(rules.encumbrance(9, 2), 1);
  assert.equal(rules.encumbrance(9, 4), 0);
});

test("体型伤势表覆盖小型下限与标准体型", () => {
  assert.deepEqual(rules.woundRanges(0), { step: 5, light: "1–5", medium: "6–10", heavy: "11–15", incapacitated: "16–20", dead: "21+" });
  assert.equal(rules.woundRanges(-4).light, "1");
  assert.equal(rules.woundRanges(-8).dead, "5+");
  assert.equal(rules.woundRanges(3).incapacitated, "25–32");
});

test("所有伤口累加；昏迷不能表示为可行动的数字罚值", () => {
  assert.equal(rules.woundPenalty({ light: 2, medium: 1 }), -5);
  assert.equal(rules.woundPenalty({ heavy: 2 }), -10);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(rules.fatiguePenalty), [0, 0, -1, -3, -5, null]);
});

test("战斗基础值只对先攻减负荷；吸收型式加值向上取整", () => {
  assert.deepEqual(rules.combat({ qik: 2, dex: 1, str: 3, ability: 4, init: 1, attack: 3, defense: 2, damage: 5, encumbrance: 2 }),
    { initiative: 1, attack: 8, defense: 8, damage: 8 });
  assert.equal(rules.soak({ stamina: 2, armor: 5, form: 6, modifier: 1 }), 10);
  assert.equal(rules.formBonus(5), 1);
  assert.equal(rules.formBonus(6), 2);
});

test("施法分别取技法和型式最低先决分数，并减负荷", () => {
  assert.equal(rules.castingScore({ technique: 12, form: 15, techniqueRequisites: [9, 10], formRequisites: [6, 8], stamina: 2, aura: 3, encumbrance: 2, mastery: 1 }), 19);
  assert.equal(rules.castingScore({ technique: 10, form: 10, formRequisites: [0] }), 10);
  assert.equal(rules.effectiveArt(6, [15]), 6);
});

test("仪式计入自由七艺与哲学；即兴除算前后修正分别处理", () => {
  assert.equal(rules.castingTotal({ score: 19, mode: "ritual", artesLiberales: 3, philosophiae: 2 }), 24);
  assert.equal(rules.castingTotal({ score: 19, mode: "formulaic", die: 6 }), 25);
  assert.equal(rules.castingTotal({ score: 19, mode: "fatiguing", die: 4 }), 11);
  assert.equal(rules.castingTotal({ score: 19, mode: "nonfatiguing", die: 9 }), 3);
  assert.equal(rules.castingTotal({ score: -1, mode: "nonfatiguing" }), -1);
  assert.equal(rules.castingTotal({ score: 19, mode: "fatiguing", die: 4, modifier: 2 }), 13);
});

test("完整工坊总值有技法型式；小计不冒充完整总值", () => {
  assert.equal(rules.labTotal({ technique: 10, form: 8, formRequisites: [5], intelligence: 3, magicTheory: 4, aura: 3 }), 25);
  assert.deepEqual(rules.referenceTotals({ quickness: 2, perception: 1, stamina: 3, finesse: 4, awareness: 5, concentration: 2, parma: 3, intelligence: 2, magicTheory: 4, aura: 3 }),
    { fastCasting: 6, determineEffect: 6, targeting: 5, concentration: 5, parmaResistance: 15, labBase: 9 });
});

test("魔法抗性计入型式和辉环；分享绛咒降低有效等级", () => {
  assert.equal(rules.magicResistance({ parma: 3, form: 8, aura: 2 }), 25);
  assert.equal(rules.magicResistance({ parma: 4, form: 8, aura: 2, sharing: true }), 15);
  assert.equal(rules.magicResistance({ parma: 2, form: 8, sharing: true }), 8);
  assert.equal(rules.magicResistance({ parma: 3, form: 8, parmaActive: false }), 8);
  assert.equal(rules.magicResistance({ parma: 0, form: 0, aura: -3 }), 0);
});

test("赫尔墨斯辉环调整依界域计算", () => {
  assert.equal(rules.hermeticAuraModifier(3, "magic"), 3);
  assert.equal(rules.hermeticAuraModifier(3, "faerie"), 1);
  assert.equal(rules.hermeticAuraModifier(3, "divine"), -9);
  assert.equal(rules.hermeticAuraModifier(3, "infernal"), -3);
});

test("长寿按不足 5 点进位；凡人改为每 10 点", () => {
  assert.equal(rules.longevityModifier(35), -7);
  assert.equal(rules.longevityModifier(36), -8);
  assert.equal(rules.longevityModifier(36, true), -4);
  assert.equal(rules.longevityModifier(0), 0);
});

test("累计经验与下级进度区分，能力与精通使用五倍门槛", () => {
  assert.deepEqual(rules.advancement(56, "art"), { total: 56, score: 10, progress: 1, nextCost: 11, remaining: 10 });
  assert.deepEqual(rules.advancement(74, "ability"), { total: 74, score: 4, progress: 24, nextCost: 25, remaining: 1 });
  assert.equal(rules.advancement(75, "ability").score, 5);
  assert.equal(rules.advancement(15, "mastery").score, 2);
  assert.equal(rules.advancement(0, "art").score, 0);
  assert.equal(rules.advancement(""), null);
  assert.equal(rules.advancement(-1), null);
  assert.equal(rules.advancement("3 points"), null);
  assert.equal(rules.advancement(1.5), null);
});
