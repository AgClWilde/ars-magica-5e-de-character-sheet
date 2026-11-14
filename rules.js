// Ars Magica Definitive Edition：无状态的角色卡计算。
// 来源行号对应本地英文定本 Markdown；特殊优势、劣势和情境调整由调用者明确传入。
(function (root, factory) {
  "use strict";
  const rules = factory();
  if (typeof module === "object" && module.exports) module.exports = rules;
  if (root) root.ARS_RULES = rules;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";

  const source = "Ars Magica - Definitive Edition [Open License - Reviewed].md";
  const references = Object.freeze({
    rounding: { source, lines: "629–631", section: "Rounding" },
    advancement: { source, lines: "16038–16073", section: "Using Experience Points" },
    experienceNotation: { source, lines: "1261–1263", section: "Format" },
    casting: { source, lines: "9170–9240", section: "Casting Spells" },
    mastery: { source, lines: "9599–9607", section: "Spell Mastery" },
    requisites: { source, lines: "12394–12412", section: "Requisites" },
    laboratory: { source, lines: "10357–10363", section: "Basic Laboratory Activities" },
    longevity: { source, lines: "10747–10757", section: "Longevity Rituals" },
    combat: { source, lines: "16744–16806", section: "Combat Scores / Damage Table" },
    encumbrance: { source, lines: "17193–17213", section: "Encumbrance" },
    fatigue: { source, lines: "17215–17219", section: "Fatigue" },
    wounds: { source, lines: "17247–17293", section: "Wounds" },
    resistance: { source, lines: "9472–9496, 17513", section: "Magic Resistance / Realm Interaction" },
    aura: { source, lines: "17495–17515", section: "Realm Interaction" },
    formBonus: { source, lines: "8922–8926", section: "The Hermetic Arts" },
    fastCasting: { source, lines: "9348–9368", section: "Fast Casting" },
    targeting: { source, lines: "9553", section: "Aiming" },
    concentration: { source, lines: "9258–9290", section: "Concentration" }
  });

  function number(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  }

  function nonnegative(value) {
    return Math.max(0, number(value));
  }

  function xpFactor(kind) {
    if (kind === "art") return 1;
    if (kind === "ability" || kind === "mastery") return 5;
    throw new RangeError("经验类别必须是 art、ability 或 mastery。");
  }

  function xpForScore(score, kind = "ability") {
    const value = Math.floor(nonnegative(score));
    return xpFactor(kind) * value * (value + 1) / 2;
  }

  // 输入是从 0 级起累计投入的经验；progress 才是纸卡原本的升下级进度。
  function advancement(xp, kind = "ability") {
    if (xp === "" || xp === null || xp === undefined) return null;
    const total = Number(xp);
    if (!Number.isSafeInteger(total) || total < 0) return null;
    const factor = xpFactor(kind);
    const score = Math.floor((Math.sqrt(1 + 8 * total / factor) - 1) / 2);
    const progress = total - xpForScore(score, kind);
    const nextCost = factor * (score + 1);
    return { total, score, progress, nextCost, remaining: nextCost - progress };
  }

  function burden(load) {
    return Math.floor((Math.sqrt(1 + 8 * nonnegative(load)) - 1) / 2);
  }

  function encumbrance(load, strength) {
    return Math.max(0, burden(load) - nonnegative(strength));
  }

  function woundRanges(size) {
    const step = Math.max(1, 5 + Math.trunc(number(size)));
    const interval = (low, high) => low === high ? String(low) : `${low}–${high}`;
    return {
      step,
      light: interval(1, step),
      medium: interval(step + 1, step * 2),
      heavy: interval(step * 2 + 1, step * 3),
      incapacitated: interval(step * 3 + 1, step * 4),
      dead: `${step * 4 + 1}+`
    };
  }

  function woundPenalty({ light = 0, medium = 0, heavy = 0 } = {}) {
    return -(Math.floor(nonnegative(light)) + 3 * Math.floor(nonnegative(medium)) + 5 * Math.floor(nonnegative(heavy))) || 0;
  }

  // 0 清爽、1 乏力、2 疲惫、3 力竭、4 眩晕；昏迷返回 null，不能继续行动。
  function fatiguePenalty(level) {
    const value = Math.floor(nonnegative(level));
    return value >= 5 ? null : [0, 0, -1, -3, -5][value];
  }

  function formBonus(score) {
    return Math.ceil(nonnegative(score) / 5);
  }

  // 无论伤势或疲劳如何，吸收本身不承受两者的惩罚。
  function soak({ stamina = 0, armor = 0, form = 0, modifier = 0 } = {}) {
    return number(stamina) + number(armor) + formBonus(form) + number(modifier);
  }

  // 纸卡基础战斗值：不含掷骰、攻击优势、伤势或疲劳的情境惩罚。
  function combat({ qik = 0, dex = 0, str = 0, ability = 0,
    attackAbility = ability, defenseAbility = ability,
    init = 0, attack = 0, defense = 0, damage = 0, encumbrance: loadPenalty = 0 } = {}) {
    return {
      initiative: number(qik) + number(init) - nonnegative(loadPenalty),
      attack: number(dex) + number(attackAbility) + number(attack),
      defense: number(qik) + number(defenseAbility) + number(defense),
      damage: number(str) + number(damage)
    };
  }

  function effectiveArt(primary, requisites = []) {
    return Math.min(nonnegative(primary), ...requisites.map(nonnegative));
  }

  // modifier 是作用于“施法值”的修正，之后会参与即兴魔法的除算。
  function castingScore({ technique = 0, form = 0, techniqueRequisites = [], formRequisites = [],
    stamina = 0, aura = 0, encumbrance: loadPenalty = 0, mastery = 0, modifier = 0 } = {}) {
    return effectiveArt(technique, techniqueRequisites) + effectiveArt(form, formRequisites)
      + number(stamina) + number(aura) - nonnegative(loadPenalty) + nonnegative(mastery) + number(modifier);
  }

  // die 是已掷出的骰值，不模拟掷骰。modifier 只接受明确作用于“施法总值”的修正。
  function castingTotal({ score = 0, mode = "formulaic", artesLiberales = 0, philosophiae = 0,
    die = 0, modifier = 0 } = {}) {
    const base = number(score);
    let result;
    switch (mode) {
      case "formulaic": result = base + number(die); break;
      case "ritual": result = base + nonnegative(artesLiberales) + nonnegative(philosophiae) + number(die); break;
      case "fatiguing": result = Math.floor((base + number(die)) / 2); break;
      case "nonfatiguing": result = Math.floor(base / 5); break;
      default: throw new RangeError("未知的施法方式。");
    }
    return result + number(modifier);
  }

  function labTotal({ technique = 0, form = 0, techniqueRequisites = [], formRequisites = [],
    intelligence = 0, magicTheory = 0, aura = 0, modifier = 0 } = {}) {
    return effectiveArt(technique, techniqueRequisites) + effectiveArt(form, formRequisites)
      + number(intelligence) + nonnegative(magicTheory) + number(aura) + number(modifier);
  }

  function magicResistance({ parma = 0, form = 0, aura = 0, sharing = false, parmaActive = true } = {}) {
    const effectiveParma = parmaActive ? Math.max(0, nonnegative(parma) - (sharing ? 3 : 0)) : 0;
    return Math.max(0, 5 * effectiveParma + nonnegative(form) + number(aura));
  }

  function hermeticAuraModifier(strength, realm = "magic") {
    const value = nonnegative(strength);
    switch (realm) {
      case "mundane": return 0;
      case "magic": return value;
      case "faerie": return Math.floor(value / 2);
      case "divine": return -3 * value;
      case "infernal": return -value;
      default: throw new RangeError("未知的辉环界域。");
    }
  }

  function longevityModifier(labTotal, mundane = false) {
    return -Math.ceil(nonnegative(labTotal) / (mundane ? 10 : 5)) || 0;
  }

  function referenceTotals({ quickness = 0, perception = 0, stamina = 0, finesse = 0,
    awareness = 0, concentration = 0, parma = 0, intelligence = 0, magicTheory = 0, aura = 0 } = {}) {
    return {
      fastCasting: number(quickness) + nonnegative(finesse),
      determineEffect: number(perception) + nonnegative(awareness),
      targeting: number(perception) + nonnegative(finesse),
      concentration: number(stamina) + nonnegative(concentration),
      parmaResistance: 5 * nonnegative(parma),
      labBase: number(intelligence) + nonnegative(magicTheory) + number(aura)
    };
  }

  return Object.freeze({ references, xpForScore, advancement, burden, encumbrance,
    woundRanges, woundPenalty, fatiguePenalty, formBonus, soak, combat, effectiveArt,
    castingScore, castingTotal, labTotal, magicResistance, hermeticAuraModifier,
    longevityModifier, referenceTotals });
});
