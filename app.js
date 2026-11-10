// ==========================================================================
// Ars Magica 5E Definitive Edition - 中文角色卡主逻辑与自动计算引擎
// ==========================================================================

(function () {
  "use strict";

  const STORAGE_KEY = "ars_magica_5e_zh_sheets_v1";
  let state = {
    activeSlotId: "default",
    autoCalc: true,
    bilingual: false,
    slots: {
      default: {
        name: "默认角色",
        data: {}
      }
    }
  };

  // 八大属性定义
  const CHARACTERISTICS = [
    { key: "int", cn: "智力", en: "Intelligence", abbr: "Int" },
    { key: "per", cn: "感知", en: "Perception", abbr: "Per" },
    { key: "str", cn: "力量", en: "Strength", abbr: "Str" },
    { key: "sta", cn: "耐力", en: "Stamina", abbr: "Sta" },
    { key: "pre", cn: "仪态", en: "Presence", abbr: "Pre" },
    { key: "com", cn: "沟通", en: "Communication", abbr: "Com" },
    { key: "dex", cn: "灵巧", en: "Dexterity", abbr: "Dex" },
    { key: "qik", cn: "机敏", en: "Quickness", abbr: "Qik" }
  ];

  // ==========================================================================
  // 1. 初始化 DOM 结构生成 (动态渲染重复行以保持 HTML 整洁与严格等高对齐)
  // ==========================================================================
  function buildSheetDOM() {
    // 1.1 衰老影响 (7行) & 扭曲影响 (7行)，与右侧9行个人出身资料严格等高对齐
    const agingList = document.getElementById("agingEffectsList");
    const warpingList = document.getElementById("warpingEffectsList");
    for (let i = 1; i <= 7; i++) {
      agingList.insertAdjacentHTML(
        "beforeend",
        `<input type="text" data-field="aging_effect_${i}" />`
      );
      warpingList.insertAdjacentHTML(
        "beforeend",
        `<input type="text" data-field="warping_effect_${i}" />`
      );
    }

    // 1.2 八大属性表
    const charBody = document.getElementById("characteristicsBody");
    CHARACTERISTICS.forEach((c) => {
      charBody.insertAdjacentHTML(
        "beforeend",
        `<tr>
          <td class="char-name">${c.cn}<span class="en-sub">${c.en}</span></td>
          <td class="char-abbr">${c.abbr}</td>
          <td>
            <div class="paren-wrap">
              <input type="text" data-field="char_${c.key}_desc" placeholder="特征描述" />
            </div>
          </td>
          <td>
            <input type="number" data-field="char_${c.key}_score" placeholder="0" />
          </td>
        </tr>`
      );
    });

    // 1.3 优势 (10行) & 劣势 (10行)
    const virtuesList = document.getElementById("virtuesList");
    const flawsList = document.getElementById("flawsList");
    for (let i = 1; i <= 10; i++) {
      virtuesList.insertAdjacentHTML(
        "beforeend",
        `<input type="text" data-field="virtue_${i}" list="datalist-virtues" />`
      );
      flawsList.insertAdjacentHTML(
        "beforeend",
        `<input type="text" data-field="flaw_${i}" list="datalist-virtues" />`
      );
    }

    // 1.4 能力表 (30行，复刻原卡)
    const abilitiesBody = document.getElementById("abilitiesBody");
    for (let i = 1; i <= 30; i++) {
      abilitiesBody.insertAdjacentHTML(
        "beforeend",
        `<tr>
          <td style="text-align:center;">
            <input type="text" class="exp-box" data-field="ab_${i}_exp" />
          </td>
          <td>
            <input type="text" data-field="ab_${i}_name" list="datalist-abilities" />
          </td>
          <td>
            <div class="paren-wrap">
              <input type="text" data-field="ab_${i}_spec" />
            </div>
          </td>
          <td>
            <input type="number" data-field="ab_${i}_score" />
          </td>
        </tr>`
      );
    }

    // 1.5 Page 2: 人格特质 (10行) & 声望 (10行)
    const personalityBody = document.getElementById("personalityBody");
    const reputationsBody = document.getElementById("reputationsBody");
    for (let i = 1; i <= 10; i++) {
      personalityBody.insertAdjacentHTML(
        "beforeend",
        `<tr>
          <td><input type="text" data-field="pt_${i}_name" /></td>
          <td><input type="text" data-field="pt_${i}_score" style="text-align:center;" /></td>
        </tr>`
      );
      reputationsBody.insertAdjacentHTML(
        "beforeend",
        `<tr>
          <td><input type="text" data-field="rep_${i}_name" /></td>
          <td>
            <div class="paren-wrap">
              <input type="text" data-field="rep_${i}_type" placeholder="本地/赫尔墨斯/教会" />
            </div>
          </td>
          <td><input type="number" data-field="rep_${i}_score" /></td>
        </tr>`
      );
    }

    // 1.6 Page 2: 伤势复选框 (轻/中/重各5格，与休克/死亡第1格垂直对齐)
    const lightChecks = document.getElementById("woundLightChecks");
    const mediumChecks = document.getElementById("woundMediumChecks");
    const heavyChecks = document.getElementById("woundHeavyChecks");
    for (let i = 1; i <= 5; i++) {
      lightChecks.insertAdjacentHTML(
        "beforeend",
        `<input type="checkbox" class="check-sq" data-field="wound_light_${i}" />`
      );
      mediumChecks.insertAdjacentHTML(
        "beforeend",
        `<input type="checkbox" class="check-sq" data-field="wound_medium_${i}" />`
      );
      heavyChecks.insertAdjacentHTML(
        "beforeend",
        `<input type="checkbox" class="check-sq" data-field="wound_heavy_${i}" />`
      );
    }

    // 1.7 Page 2: 武器表 (6行，子列与表头 1:1 严格对齐)
    const weaponsBody = document.getElementById("weaponsBody");
    for (let i = 1; i <= 6; i++) {
      weaponsBody.insertAdjacentHTML(
        "beforeend",
        `<tr>
          <td><input type="text" data-field="wp_${i}_name" placeholder="武器 ${i}" /></td>
          <td style="text-align:center;">
            <div class="formula-group">
              <input type="number" data-field="wp_${i}_init_qik" placeholder="Qik" />
              <span class="op">+</span>
              <input type="number" data-field="wp_${i}_init_weap" placeholder="Wp" />
              <span class="op">–</span>
              <input type="number" data-field="wp_${i}_init_enc" placeholder="Enc" />
              <span class="op">=</span>
              <input type="number" data-field="wp_${i}_init_total" class="calc-output" readonly />
            </div>
          </td>
          <td style="text-align:center;">
            <div class="formula-group">
              <input type="number" data-field="wp_${i}_atk_dex" placeholder="Dex" />
              <span class="op">+</span>
              <input type="number" data-field="wp_${i}_atk_ab" placeholder="Ab" />
              <span class="op">+</span>
              <input type="number" data-field="wp_${i}_atk_weap" placeholder="Wp" />
              <span class="op">=</span>
              <input type="number" data-field="wp_${i}_atk_total" class="calc-output" readonly />
            </div>
          </td>
          <td style="text-align:center;">
            <div class="formula-group">
              <input type="number" data-field="wp_${i}_dfn_qik" placeholder="Qik" />
              <span class="op">+</span>
              <input type="number" data-field="wp_${i}_dfn_ab" placeholder="Ab" />
              <span class="op">+</span>
              <input type="number" data-field="wp_${i}_dfn_weap" placeholder="Wp" />
              <span class="op">=</span>
              <input type="number" data-field="wp_${i}_dfn_total" class="calc-output" readonly />
            </div>
          </td>
          <td style="text-align:center;">
            <div class="formula-group">
              <input type="number" data-field="wp_${i}_dam_str" placeholder="Str" />
              <span class="op">+</span>
              <input type="number" data-field="wp_${i}_dam_weap" placeholder="Wp" />
              <span class="op">=</span>
              <input type="number" data-field="wp_${i}_dam_total" class="calc-output" readonly />
            </div>
          </td>
          <td><input type="number" data-field="wp_${i}_load" /></td>
          <td><input type="text" data-field="wp_${i}_range" style="text-align:center;" /></td>
        </tr>`
      );
    }

    // 1.8 Page 2: 装备栏 (18格，双列9行)
    const equipmentGrid = document.getElementById("equipmentGrid");
    for (let i = 1; i <= 18; i++) {
      equipmentGrid.insertAdjacentHTML(
        "beforeend",
        `<input type="text" data-field="equip_${i}" />`
      );
    }

    // 1.9 Page 3: 魔法秘艺 (5 技法 + 10 型式)
    const techBody = document.getElementById("techniquesBody");
    window.ARS_GLOSSARY.techniques.forEach((t) => {
      techBody.insertAdjacentHTML(
        "beforeend",
        `<tr>
          <td style="text-align:center;"><input type="text" class="exp-box" data-field="art_${t.key}_exp" /></td>
          <td style="padding-left:4px;"><strong>${t.cn}</strong><span class="en-sub">${t.en}</span></td>
          <td><input type="number" data-field="art_${t.key}_score" placeholder="0" /></td>
        </tr>`
      );
    });

    const formsCol1 = document.getElementById("formsCol1Body");
    const formsCol2 = document.getElementById("formsCol2Body");
    window.ARS_GLOSSARY.forms.forEach((f, idx) => {
      const targetBody = idx < 5 ? formsCol1 : formsCol2;
      targetBody.insertAdjacentHTML(
        "beforeend",
        `<tr>
          <td style="text-align:center;"><input type="text" class="exp-box" data-field="art_${f.key}_exp" /></td>
          <td style="padding-left:4px;"><strong>${f.cn}</strong><span class="en-sub">${f.en}</span></td>
          <td><input type="number" data-field="art_${f.key}_score" placeholder="0" /></td>
        </tr>`
      );
    });

    // 1.10 Page 3: 黄昏之痕 (4行)、源质 (8行)、魔宠纽带特质 (6行)
    const scarsList = document.getElementById("twilightScarsList");
    for (let i = 1; i <= 4; i++) {
      scarsList.insertAdjacentHTML(
        "beforeend",
        `<input type="text" data-field="twilight_scar_${i}" />`
      );
    }

    const rawVisBody = document.getElementById("rawVisBody");
    for (let i = 1; i <= 8; i++) {
      rawVisBody.insertAdjacentHTML(
        "beforeend",
        `<tr>
          <td><input type="text" data-field="vis_${i}_art" list="datalist-arts" /></td>
          <td><input type="number" data-field="vis_${i}_pawns" /></td>
          <td><input type="text" data-field="vis_${i}_form" /></td>
        </tr>`
      );
    }

    const famBondList = document.getElementById("famBondList");
    for (let i = 1; i <= 6; i++) {
      famBondList.insertAdjacentHTML(
        "beforeend",
        `<input type="text" data-field="fam_bond_${i}" />`
      );
    }

    // 1.11 Page 4: 法术栏 (12个法术区块，双列6行)
    const spellsGrid = document.getElementById("spellsGrid");
    for (let i = 1; i <= 12; i++) {
      spellsGrid.insertAdjacentHTML(
        "beforeend",
        `<div class="spell-card">
          <div class="field-row">
            <label class="field-label"><strong>法术<span class="en-sub">SPELL</span>:</strong></label>
            <input type="text" data-field="spell_${i}_name" list="datalist-spells" />
          </div>
          <div class="spell-row-2col">
            <div class="field-row">
              <label class="field-label">型式<span class="en-sub">Form</span>:</label>
              <input type="text" data-field="spell_${i}_form" list="datalist-forms" />
            </div>
            <div class="field-row">
              <label class="field-label">技法<span class="en-sub">Technique</span>:</label>
              <input type="text" data-field="spell_${i}_tech" list="datalist-techniques" />
            </div>
          </div>
          <div class="spell-row-2col">
            <div class="field-row">
              <label class="field-label">等级<span class="en-sub">Level</span>:</label>
              <input type="number" data-field="spell_${i}_level" />
            </div>
            <div class="field-row">
              <label class="field-label">加值<span class="en-sub">Bonus</span>:</label>
              <input type="text" data-field="spell_${i}_bonus" placeholder="自动或手动" />
            </div>
          </div>
          <div class="spell-row-3col">
            <div class="field-row">
              <label class="field-label">范围<span class="en-sub">Range</span>:</label>
              <input type="text" data-field="spell_${i}_range" list="datalist-ranges" />
            </div>
            <div class="field-row">
              <label class="field-label">持续时间<span class="en-sub">Duration</span>:</label>
              <input type="text" data-field="spell_${i}_duration" list="datalist-durations" />
            </div>
            <div class="field-row">
              <label class="field-label">目标<span class="en-sub">Target</span>:</label>
              <input type="text" data-field="spell_${i}_target" list="datalist-targets" />
            </div>
          </div>
          <div class="spell-row-2col">
            <div class="field-row">
              <label class="field-label">经验<span class="en-sub">Exp</span>:</label>
              <input type="text" data-field="spell_${i}_exp" />
            </div>
            <div class="field-row">
              <label class="field-label">精通<span class="en-sub">Mastery</span>:</label>
              <input type="text" data-field="spell_${i}_mastery" />
            </div>
          </div>
          <div class="field-row">
            <label class="field-label">备注<span class="en-sub">Notes</span>:</label>
            <input type="text" data-field="spell_${i}_notes_1" />
          </div>
          <div class="field-row">
            <input type="text" data-field="spell_${i}_notes_2" />
          </div>
          <div class="field-row" style="margin-bottom:0;">
            <input type="text" data-field="spell_${i}_notes_3" />
          </div>
        </div>`
      );
    }
  }

  // ==========================================================================
  // 2. 填充自动补全 Datalists 与术语速查表
  // ==========================================================================
  function populateDatalists() {
    const dlHouses = document.getElementById("datalist-houses");
    window.ARS_GLOSSARY.houses.forEach((h) => {
      dlHouses.insertAdjacentHTML("beforeend", `<option value="${h.cn}"></option>`);
    });

    const dlAbilities = document.getElementById("datalist-abilities");
    window.ARS_GLOSSARY.abilities.forEach((a) => {
      dlAbilities.insertAdjacentHTML(
        "beforeend",
        `<option value="${a.cn} (${a.en})"></option>`
      );
    });

    const dlVirtues = document.getElementById("datalist-virtues");
    window.ARS_GLOSSARY.entries
      .filter((e) => e.cat === "优势与劣势")
      .forEach((v) => {
        dlVirtues.insertAdjacentHTML(
          "beforeend",
          `<option value="${v.cn} (${v.en})"></option>`
        );
      });

    const dlTechs = document.getElementById("datalist-techniques");
    const dlForms = document.getElementById("datalist-forms");
    const dlArts = document.getElementById("datalist-arts");
    window.ARS_GLOSSARY.techniques.forEach((t) => {
      dlTechs.insertAdjacentHTML("beforeend", `<option value="${t.cn} (${t.en})"></option>`);
      dlArts.insertAdjacentHTML("beforeend", `<option value="${t.cn} (${t.abbr})"></option>`);
    });
    window.ARS_GLOSSARY.forms.forEach((f) => {
      dlForms.insertAdjacentHTML("beforeend", `<option value="${f.cn} (${f.en})"></option>`);
      dlArts.insertAdjacentHTML("beforeend", `<option value="${f.cn} (${f.abbr})"></option>`);
    });

    const dlSpells = document.getElementById("datalist-spells");
    window.ARS_GLOSSARY.entries
      .filter((e) => e.cat === "法术")
      .forEach((s) => {
        dlSpells.insertAdjacentHTML(
          "beforeend",
          `<option value="${s.cn} (${s.en})"></option>`
        );
      });

    const dlRanges = document.getElementById("datalist-ranges");
    window.ARS_GLOSSARY.spellParams.ranges.forEach((r) => {
      dlRanges.insertAdjacentHTML("beforeend", `<option value="${r}"></option>`);
    });

    const dlDurations = document.getElementById("datalist-durations");
    window.ARS_GLOSSARY.spellParams.durations.forEach((d) => {
      dlDurations.insertAdjacentHTML("beforeend", `<option value="${d}"></option>`);
    });

    const dlTargets = document.getElementById("datalist-targets");
    window.ARS_GLOSSARY.spellParams.targets.forEach((t) => {
      dlTargets.insertAdjacentHTML("beforeend", `<option value="${t}"></option>`);
    });
  }

  // ==========================================================================
  // 3. 辅助读取与自动计算引擎
  // ==========================================================================
  function getNum(field) {
    const el = document.querySelector(`[data-field="${field}"]`);
    if (!el || el.value === "") return 0;
    const n = parseFloat(el.value);
    return isNaN(n) ? 0 : n;
  }

  function setValIfAuto(field, val) {
    const el = document.querySelector(`[data-field="${field}"]`);
    if (!el) return;
    el.value = val;
    getActiveData()[field] = val;
  }

  // 从第1页的30行能力列表中查找特定能力的数值
  function findAbilityScore(keywords) {
    for (let i = 1; i <= 30; i++) {
      const nameEl = document.querySelector(`[data-field="ab_${i}_name"]`);
      const scoreEl = document.querySelector(`[data-field="ab_${i}_score"]`);
      if (!nameEl || !nameEl.value) continue;
      const text = nameEl.value.toLowerCase();
      if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
        const val = parseFloat(scoreEl.value);
        return isNaN(val) ? 0 : val;
      }
    }
    return null;
  }

  // 匹配技法或型式名称对应的秘艺分值
  function matchArtScore(inputStr, list) {
    if (!inputStr) return null;
    const clean = inputStr.trim().toLowerCase();
    for (const item of list) {
      if (
        clean.includes(item.cn) ||
        clean.includes(item.en.toLowerCase()) ||
        clean === item.abbr.toLowerCase()
      ) {
        return getNum(`art_${item.key}_score`);
      }
    }
    return null;
  }

  function runAutoCalculations(changedField) {
    if (!state.autoCalc) {
      renderCastingMatrix();
      return;
    }

    // 3.1 同步 P1 与 P3 的学派，并自动带出宗庭与首席（若为空）
    if (changedField === "house" || changedField === "p3_house") {
      const srcVal = document.querySelector(`[data-field="${changedField}"]`).value;
      const otherField = changedField === "house" ? "p3_house" : "house";
      setValIfAuto(otherField, srcVal);

      const matchedHouse = window.ARS_GLOSSARY.houses.find(
        (h) => srcVal.includes(h.cn.split(" ")[0]) || srcVal.toLowerCase().includes(h.en.toLowerCase())
      );
      if (matchedHouse) {
        const domusEl = document.querySelector(`[data-field="domus_magna"]`);
        const primusEl = document.querySelector(`[data-field="primus"]`);
        if (domusEl && !domusEl.value) setValIfAuto("domus_magna", matchedHouse.domus);
        if (primusEl && !primusEl.value) setValIfAuto("primus", matchedHouse.primus);
      }
    }

    // 3.2 根据体型 (Size) 自动计算伤势范围 (Wound Ranges)
    const size = getNum("size");
    const step = Math.max(1, 5 + size);
    setValIfAuto("wound_light_range", `1–${step}`);
    setValIfAuto("wound_medium_range", `${step + 1}–${step * 2}`);
    setValIfAuto("wound_heavy_range", `${step * 2 + 1}–${step * 3}`);
    setValIfAuto("wound_incap_range", `${step * 3 + 1}–${step * 4}`);
    setValIfAuto("wound_dead_range", `${step * 4 + 1}+`);

    // 3.3 读取八大属性
    const intScore = getNum("char_int_score");
    const perScore = getNum("char_per_score");
    const strScore = getNum("char_str_score");
    const staScore = getNum("char_sta_score");
    const dexScore = getNum("char_dex_score");
    const qikScore = getNum("char_qik_score");

    // 3.4 同步能力列表中的精密、察觉、专注、绛咒、魔法理论到第3页
    const finesseFromAb = findAbilityScore(["精密", "finesse"]);
    const awareFromAb = findAbilityScore(["察觉", "awareness"]);
    const concFromAb = findAbilityScore(["专注", "concentration"]);
    const parmaFromAb = findAbilityScore(["绛咒", "parma"]);
    const theoryFromAb = findAbilityScore(["魔法理论", "magic theory"]);

    setValIfAuto("fc_qik", qikScore);
    if (finesseFromAb !== null) {
      setValIfAuto("fc_finesse", finesseFromAb);
      setValIfAuto("bt_finesse", finesseFromAb);
    }
    setValIfAuto("fc_total", getNum("fc_qik") + getNum("fc_finesse"));

    setValIfAuto("de_per", perScore);
    if (awareFromAb !== null) setValIfAuto("de_awareness", awareFromAb);
    setValIfAuto("de_total", getNum("de_per") + getNum("de_awareness"));

    setValIfAuto("bt_per", perScore);
    setValIfAuto("bt_total", getNum("bt_per") + getNum("bt_finesse"));

    setValIfAuto("conc_sta", staScore);
    if (concFromAb !== null) setValIfAuto("conc_skill", concFromAb);
    setValIfAuto("conc_total", getNum("conc_sta") + getNum("conc_skill"));

    if (parmaFromAb !== null) setValIfAuto("mr_parma", parmaFromAb);
    setValIfAuto("mr_total", getNum("mr_parma") * 5);

    // 3.5 基础工坊总值 (Int + Magic Theory + Aura)
    setValIfAuto("lab_int", intScore);
    if (theoryFromAb !== null) setValIfAuto("lab_theory", theoryFromAb);
    const aura = getNum("lab_aura");
    setValIfAuto("lab_total", getNum("lab_int") + getNum("lab_theory") + aura);

    // 3.6 长寿仪式衰老修正建议 (每5点工坊总值 -1)
    const longLab = getNum("longevity_lab_total");
    if (longLab > 0) {
      setValIfAuto("longevity_age_mod", `-${Math.ceil(longLab / 5)}`);
    }

    // 3.7 武器行公式计算 (6行)
    for (let i = 1; i <= 6; i++) {
      const wpName = document.querySelector(`[data-field="wp_${i}_name"]`)?.value;
      if (wpName) {
        const initQikEl = document.querySelector(`[data-field="wp_${i}_init_qik"]`);
        const atkDexEl = document.querySelector(`[data-field="wp_${i}_atk_dex"]`);
        const dfnQikEl = document.querySelector(`[data-field="wp_${i}_dfn_qik"]`);
        const damStrEl = document.querySelector(`[data-field="wp_${i}_dam_str"]`);
        if (initQikEl && initQikEl.value === "") setValIfAuto(`wp_${i}_init_qik`, qikScore);
        if (atkDexEl && atkDexEl.value === "") setValIfAuto(`wp_${i}_atk_dex`, dexScore);
        if (dfnQikEl && dfnQikEl.value === "") setValIfAuto(`wp_${i}_dfn_qik`, qikScore);
        if (damStrEl && damStrEl.value === "") setValIfAuto(`wp_${i}_dam_str`, strScore);
      }

      const hasInit =
        document.querySelector(`[data-field="wp_${i}_init_qik"]`)?.value !== "" ||
        document.querySelector(`[data-field="wp_${i}_init_weap"]`)?.value !== "";
      if (hasInit) {
        setValIfAuto(
          `wp_${i}_init_total`,
          getNum(`wp_${i}_init_qik`) + getNum(`wp_${i}_init_weap`) - getNum(`wp_${i}_init_enc`)
        );
      } else {
        setValIfAuto(`wp_${i}_init_total`, "");
      }

      const hasAtk =
        document.querySelector(`[data-field="wp_${i}_atk_dex"]`)?.value !== "" ||
        document.querySelector(`[data-field="wp_${i}_atk_ab"]`)?.value !== "" ||
        document.querySelector(`[data-field="wp_${i}_atk_weap"]`)?.value !== "";
      if (hasAtk) {
        setValIfAuto(
          `wp_${i}_atk_total`,
          getNum(`wp_${i}_atk_dex`) + getNum(`wp_${i}_atk_ab`) + getNum(`wp_${i}_atk_weap`)
        );
      } else {
        setValIfAuto(`wp_${i}_atk_total`, "");
      }

      const hasDfn =
        document.querySelector(`[data-field="wp_${i}_dfn_qik"]`)?.value !== "" ||
        document.querySelector(`[data-field="wp_${i}_dfn_ab"]`)?.value !== "" ||
        document.querySelector(`[data-field="wp_${i}_dfn_weap"]`)?.value !== "";
      if (hasDfn) {
        setValIfAuto(
          `wp_${i}_dfn_total`,
          getNum(`wp_${i}_dfn_qik`) + getNum(`wp_${i}_dfn_ab`) + getNum(`wp_${i}_dfn_weap`)
        );
      } else {
        setValIfAuto(`wp_${i}_dfn_total`, "");
      }

      const hasDam =
        document.querySelector(`[data-field="wp_${i}_dam_str"]`)?.value !== "" ||
        document.querySelector(`[data-field="wp_${i}_dam_weap"]`)?.value !== "";
      if (hasDam) {
        setValIfAuto(
          `wp_${i}_dam_total`,
          getNum(`wp_${i}_dam_str`) + getNum(`wp_${i}_dam_weap`)
        );
      } else {
        setValIfAuto(`wp_${i}_dam_total`, "");
      }
    }

    // 3.8 Page 4: 法术施法加值自动计算 (技法 + 型式 + 耐力 + 辉环 + 精通等级)
    for (let i = 1; i <= 12; i++) {
      const formStr = document.querySelector(`[data-field="spell_${i}_form"]`)?.value || "";
      const techStr = document.querySelector(`[data-field="spell_${i}_tech"]`)?.value || "";
      const masteryStr = document.querySelector(`[data-field="spell_${i}_mastery"]`)?.value || "";
      const fScore = matchArtScore(formStr, window.ARS_GLOSSARY.forms);
      const tScore = matchArtScore(techStr, window.ARS_GLOSSARY.techniques);
      if (fScore !== null && tScore !== null) {
        const masteryMatch = masteryStr.match(/\d+/);
        const mScore = masteryMatch ? parseInt(masteryMatch[0], 10) : 0;
        const totalBonus = tScore + fScore + staScore + aura + mScore;
        setValIfAuto(`spell_${i}_bonus`, `+${totalBonus}`);
      }
    }

    renderCastingMatrix();
  }

  // 渲染 5×10 技法×型式 施法总值矩阵
  function renderCastingMatrix() {
    const table = document.getElementById("castingMatrixTable");
    if (!table) return;
    const sta = getNum("char_sta_score");
    const aura = getNum("lab_aura");

    let html = `<thead><tr><th>技法 \\ 型式</th>`;
    window.ARS_GLOSSARY.forms.forEach((f) => {
      html += `<th>${f.cn}<br/><span style="font-weight:normal;font-size:10px;">${f.abbr}</span></th>`;
    });
    html += `</tr></thead><tbody>`;

    window.ARS_GLOSSARY.techniques.forEach((t) => {
      const tScore = getNum(`art_${t.key}_score`);
      html += `<tr><th>${t.cn} (${t.abbr})</th>`;
      window.ARS_GLOSSARY.forms.forEach((f) => {
        const fScore = getNum(`art_${f.key}_score`);
        const formulaic = tScore + fScore + sta + aura;
        const spontNoFat = Math.floor(formulaic / 5);
        html += `<td><strong>+${formulaic}</strong> <span style="color:var(--ink-muted);font-size:10px;">(${spontNoFat})</span></td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody>`;
    table.innerHTML = html;
  }

  // ==========================================================================
  // 4. 状态管理、多角色槽位与 LocalStorage 持久化
  // ==========================================================================
  function getActiveData() {
    if (!state.slots[state.activeSlotId]) {
      state.slots[state.activeSlotId] = { name: "默认角色", data: {} };
    }
    return state.slots[state.activeSlotId].data;
  }

  function saveToStorage() {
    try {
      const charName = getActiveData()["character_name"];
      if (charName && charName.trim()) {
        state.slots[state.activeSlotId].name = charName.trim();
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      updateSlotSelector();
      const statusEl = document.getElementById("saveStatus");
      if (statusEl) {
        const now = new Date();
        statusEl.textContent = `已保存 (${now.toTimeString().slice(0, 8)})`;
      }
    } catch (e) {
      console.error("Failed to save character sheet:", e);
    }
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.slots) {
          state = Object.assign(state, parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load storage:", e);
    }
    applyStateToDOM();
  }

  function applyStateToDOM() {
    const data = getActiveData();
    document.querySelectorAll("[data-field]").forEach((el) => {
      const key = el.getAttribute("data-field");
      const val = data[key];
      if (el.type === "checkbox") {
        el.checked = Boolean(val);
      } else {
        el.value = val !== undefined && val !== null ? val : "";
      }
    });

    // 同步双语与自动计算按钮状态
    document.body.classList.toggle("mode-cn-only", !state.bilingual);
    const btnLang = document.getElementById("btnToggleLang");
    if (btnLang) {
      btnLang.classList.toggle("active", state.bilingual);
      btnLang.textContent = state.bilingual ? "文/A 双语标签" : "纯中文标签";
    }

    const btnAuto = document.getElementById("btnToggleAutoCalc");
    if (btnAuto) {
      btnAuto.classList.toggle("active", state.autoCalc);
      btnAuto.textContent = state.autoCalc ? "⚡ 自动计算：开" : "⚡ 自动计算：关";
    }

    document.querySelectorAll(".calc-output").forEach((el) => {
      el.readOnly = state.autoCalc;
    });

    updateSlotSelector();
    runAutoCalculations();
  }

  function updateSlotSelector() {
    const select = document.getElementById("slotSelect");
    if (!select) return;
    select.innerHTML = "";
    Object.keys(state.slots).forEach((id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = `📁 ${state.slots[id].name || "未命名角色"}`;
      if (id === state.activeSlotId) opt.selected = true;
      select.appendChild(opt);
    });
  }

  // ==========================================================================
  // 5. 术语速查表抽屉逻辑
  // ==========================================================================
  function renderGlossaryTable() {
    const query = (document.getElementById("glossarySearchInput")?.value || "")
      .trim()
      .toLowerCase();
    const cat = document.getElementById("glossaryCatFilter")?.value || "ALL";
    const tbody = document.getElementById("glossaryTableBody");
    if (!tbody) return;

    const allItems = [];
    window.ARS_GLOSSARY.techniques.forEach((t) =>
      allItems.push({ cat: "秘艺与型式", en: `${t.en} (${t.abbr})`, cn: t.cn, src: "总表·核心" })
    );
    window.ARS_GLOSSARY.forms.forEach((f) =>
      allItems.push({ cat: "秘艺与型式", en: `${f.en} (${f.abbr})`, cn: f.cn, src: "总表·核心" })
    );
    window.ARS_GLOSSARY.abilities.forEach((a) =>
      allItems.push({ cat: "能力", en: a.en, cn: a.cn, src: a.src })
    );
    window.ARS_GLOSSARY.entries.forEach((e) => allItems.push(e));

    const filtered = allItems.filter((item) => {
      if (cat !== "ALL" && item.cat !== cat) return false;
      if (!query) return true;
      return (
        item.en.toLowerCase().includes(query) ||
        item.cn.toLowerCase().includes(query)
      );
    });

    tbody.innerHTML = filtered
      .map(
        (item) => `<tr>
          <td><span class="badge" style="color:#5a3e12;background:rgba(181,141,61,0.18);padding:1px 6px;border-radius:4px;font-size:11px;">${item.cat}</span></td>
          <td style="font-family:Georgia,serif;">${item.en}</td>
          <td><strong>${item.cn}</strong></td>
          <td style="color:var(--ink-muted);font-size:11.5px;">${item.src}</td>
        </tr>`
      )
      .join("");
  }

  // ==========================================================================
  // 6. 事件绑定
  // ==========================================================================
  function bindEvents() {
    document.addEventListener("input", (e) => {
      const target = e.target;
      const field = target.getAttribute("data-field");
      if (!field) return;

      const data = getActiveData();
      if (target.type === "checkbox") {
        data[field] = target.checked;
      } else {
        data[field] = target.value;
      }

      runAutoCalculations(field);
      saveToStorage();
    });

    document.getElementById("slotSelect")?.addEventListener("change", (e) => {
      state.activeSlotId = e.target.value;
      saveToStorage();
      applyStateToDOM();
    });

    document.getElementById("btnNewSlot")?.addEventListener("click", () => {
      const name = prompt("请输入新角色的名称：", "新法师角色");
      if (!name) return;
      const newId = "char_" + Date.now();
      state.slots[newId] = {
        name: name.trim(),
        data: { character_name: name.trim(), current_year: "1220", size: 0, confidence: "1 (3)" }
      };
      state.activeSlotId = newId;
      saveToStorage();
      applyStateToDOM();
    });

    document.getElementById("btnToggleAutoCalc")?.addEventListener("click", () => {
      state.autoCalc = !state.autoCalc;
      saveToStorage();
      applyStateToDOM();
    });

    document.getElementById("btnToggleLang")?.addEventListener("click", () => {
      state.bilingual = !state.bilingual;
      saveToStorage();
      applyStateToDOM();
    });

    document.getElementById("btnToggleMatrix")?.addEventListener("click", () => {
      const wrap = document.getElementById("castingMatrixWrap");
      if (!wrap) return;
      wrap.style.display = wrap.style.display === "none" ? "block" : "none";
      renderCastingMatrix();
    });

    const drawer = document.getElementById("glossaryDrawer");
    document.getElementById("btnOpenGlossary")?.addEventListener("click", () => {
      drawer?.classList.add("open");
      renderGlossaryTable();
    });
    document.getElementById("btnCloseGlossary")?.addEventListener("click", () => {
      drawer?.classList.remove("open");
    });
    drawer?.addEventListener("click", (e) => {
      if (e.target === drawer) drawer.classList.remove("open");
    });
    document.getElementById("glossarySearchInput")?.addEventListener("input", renderGlossaryTable);
    document.getElementById("glossaryCatFilter")?.addEventListener("change", renderGlossaryTable);

    document.getElementById("btnExportJson")?.addEventListener("click", () => {
      const data = getActiveData();
      const charName = (data.character_name || "ars-magica-character").replace(/\s+/g, "_");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${charName}_角色卡.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById("inputImportJson")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target.result);
          if (imported && typeof imported === "object") {
            const newId = "import_" + Date.now();
            const name = imported.character_name || file.name.replace(/\.json$/i, "");
            state.slots[newId] = { name, data: imported };
            state.activeSlotId = newId;
            saveToStorage();
            applyStateToDOM();
          }
        } catch (err) {
          alert("JSON 文件格式有误，无法导入。");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });

    document.getElementById("btnPrint")?.addEventListener("click", () => {
      window.print();
    });

    document.getElementById("btnReset")?.addEventListener("click", () => {
      if (!confirm("确定要清空当前角色卡的所有填写内容吗？")) return;
      state.slots[state.activeSlotId].data = {};
      saveToStorage();
      applyStateToDOM();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    buildSheetDOM();
    populateDatalists();
    bindEvents();
    loadFromStorage();
  });
})();
