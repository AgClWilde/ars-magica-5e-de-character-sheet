// ==========================================================================
// Ars Magica 5E Definitive Edition - 中文角色卡主逻辑与自动计算引擎
// ==========================================================================

(function () {
  "use strict";

  const STORAGE_KEY = "ars_magica_5e_zh_sheets_v1";
  const DEFAULT_SPELL_COUNT = 12;
  let spellIndices = [];
  let state = {
    activeSlotId: "default",
    autoCalc: true,
    autoFill: true,
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
        `<input type="text" data-field="flaw_${i}" list="datalist-flaws" />`
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

    // 1.6 Page 2: 伤势复选框 (轻/中/重各5格，与失能/死亡第1格垂直对齐)
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
          <td><input type="text" data-field="wp_${i}_name" list="datalist-weapons" placeholder="武器 ${i}" /><input type="text" data-field="wp_${i}_ability" list="datalist-abilities" placeholder="战斗能力" title="填写所用能力；未指定时可手填攻防能力值" /></td>
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
          <td><input type="number" data-field="wp_${i}_load" min="0" /><label class="carried-label"><input type="checkbox" data-field="wp_${i}_carried" />携带</label></td>
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

    // 1.11 Page 4: 默认法术栏
    renderSpellCards({});
  }

  function renderSpellCards(data) {
    const indices = new Set(Array.from({length: DEFAULT_SPELL_COUNT}, (_, i) => i + 1));
    Object.keys(data).forEach((field) => {
      const match = /^spell_([1-9]\d*)_/.exec(field);
      if (match) indices.add(Number(match[1]));
    });
    const nextIndices = [...indices].sort((a, b) => a - b);
    if (nextIndices.length === spellIndices.length && nextIndices.every((index, i) => index === spellIndices[i])) return;
    spellIndices = nextIndices;
    const spellsGrid = document.getElementById("spellsGrid");
    spellsGrid.replaceChildren();
    for (const i of spellIndices) {
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
              <label class="field-label">施法加值<span class="en-sub">Bonus</span>:</label>
              <input type="text" class="calc-output" data-field="spell_${i}_bonus" title="含先决条件、耐力、负荷、施法辉环及精通；仪式另加自由七艺与哲学。不含骰值、伤势及疲劳惩罚。" />
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
          <div class="field-row spell-requisites-row">
            <label class="field-label">先决条件:</label>
            <input type="text" data-field="spell_${i}_requisites" placeholder="秘艺名" />
            <label class="ritual-label"><input type="checkbox" data-field="spell_${i}_ritual" />仪式</label>
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
          <details class="spell-reference no-print" id="spellReference${i}"><summary>规则与出处</summary><div></div></details>
        </div>`
      );
    }
  }

  // 术语名称采用精确匹配；英文缩写和旧译名只作检索别名。
  const G = window.ARS_GLOSSARY;
  const R = window.ARS_RULES;
  const FATIGUE = ["fresh", "winded", "weary", "tired", "dazed", "unconscious"];
  const fieldElement = (name) => document.querySelector(`[data-field="${name}"]`);
  const getVal = (name) => fieldElement(name)?.value ?? "";
  const getNum = (name) => Number.isFinite(Number(getVal(name))) ? Number(getVal(name)) : 0;
  const checked = (name) => !!fieldElement(name)?.checked;
  const signed = (n) => n >= 0 ? `+${n}` : String(n);
  const normalize = (s) => String(s || "").normalize("NFKC").toLowerCase().replace(/[\s·’'’*]/g, "");
  const arts = () => [...G.techniques, ...G.forms];

  function matches(value, item) {
    const names = [item.cn, item.en, item.abbr, item.key, ...(item.aliases || [])].filter(Boolean);
    [item.cn, ...(item.aliases || [])].forEach((name) => {
      if (item.en) names.push(`${name} (${item.en})`);
      if (item.abbr) names.push(`${name} (${item.abbr})`);
    });
    return names.some((name) => normalize(name) === normalize(value));
  }
  function matchEntry(value, list) {
    if (!String(value || "").trim()) return null;
    const candidates = list.filter((item) => matches(value, item));
    return candidates.length === 1 ? candidates[0] : null;
  }
  function setVal(field, value) {
    const el = fieldElement(field);
    if (!el) return;
    if (el.type === "checkbox") el.checked = Boolean(value);
    else el.value = value ?? "";
    getActiveData()[field] = el.type === "checkbox" ? el.checked : el.value;
  }
  function fillManaged(field, value, force = false) {
    const data = getActiveData();
    const previous = data.__autoFilled || (data.__autoFilled = {});
    const el = fieldElement(field);
    if (!el) return;
    const current = el.type === "checkbox" ? el.checked : el.value;
    if (force || current === "" || current === false || String(current) === String(previous[field])) {
      setVal(field, value ?? "");
      previous[field] = el.type === "checkbox" ? el.checked : el.value;
    }
  }
  function clearManaged(fields) {
    const previous = getActiveData().__autoFilled || {};
    fields.forEach((field) => {
      const el = fieldElement(field);
      if (!el || !Object.hasOwn(previous, field)) return;
      const current = el.type === "checkbox" ? el.checked : el.value;
      if (String(current) === String(previous[field])) setVal(field, el.type === "checkbox" ? false : "");
      delete previous[field];
    });
  }
  function addOptions(id, items) {
    const list = document.getElementById(id);
    if (!list) return;
    list.replaceChildren();
    const values = new Set();
    items.forEach((item) => {
      const value = typeof item === "string" ? item : item.cn;
      if (!value || values.has(value)) return;
      values.add(value);
      const option = document.createElement("option");
      option.value = value;
      if (typeof item === "object") option.label = [item.en, item.kind].filter(Boolean).join(" · ");
      list.append(option);
    });
  }
  function populateDatalists() {
    const lists = {
      houses: G.houses, abilities: G.abilities, virtues: G.virtues, flaws: G.flaws,
      techniques: G.techniques, forms: G.forms, arts: arts(), spells: G.spells,
      weapons: G.weapons, armors: G.armors,
      ranges: G.spellParams.ranges, durations: G.spellParams.durations, targets: G.spellParams.targets
    };
    Object.entries(lists).forEach(([name, items]) => addOptions(`datalist-${name}`, items || []));
    const filter = document.getElementById("glossaryCatFilter");
    filter.replaceChildren(new Option("全部分类", "ALL"));
    [...new Set(G.entries.map((item) => item.cat))].forEach((category) => filter.add(new Option(category, category)));
  }
  function findAbilityScore(en) {
    const ability = G.abilities.find((a) => normalize(a.en) === normalize(en));
    if (!ability) return 0;
    const scores = [];
    for (let i = 1; i <= 30; i++) {
      if (matches(getVal(`ab_${i}_name`), ability)) scores.push(getNum(`ab_${i}_score`));
    }
    return scores.length ? Math.max(...scores) : 0;
  }
  function artScore(value, list = arts()) {
    const art = matchEntry(value, list);
    return art ? getNum(`art_${art.key}_score`) : null;
  }
  function refreshSpellReference(i) {
    const spell = matchEntry(getVal(`spell_${i}_name`), G.spells || []);
    const container = document.getElementById(`spellReference${i}`);
    if (!container) return;
    container.hidden = !spell;
    fieldElement(`spell_${i}_level`).placeholder = spell?.general ? "通用：自定等级" : "";
    fieldElement(`spell_${i}_name`).title = spell?.src || "";
    if (spell) {
      container.querySelector("div").textContent = [spell.description, spell.notes, spell.src].filter(Boolean).join("\n\n");
    }
  }
  function runAutoFill(changedField) {
    if (changedField === "house" || changedField === "p3_house") {
      setVal(changedField === "house" ? "p3_house" : "house", getVal(changedField));
    }
    if (!state.autoFill) return;
    if (changedField === "house" || changedField === "p3_house") {
      const house = matchEntry(getVal(changedField), G.houses);
      if (house) {
        fillManaged("domus_magna", house.domus || "");
        fillManaged("primus", house.primus || "");
      } else clearManaged(["domus_magna", "primus"]);
    }
    const spellMatch = /^spell_(\d+)_name$/.exec(changedField || "");
    if (spellMatch) {
      const i = spellMatch[1];
      const spell = matchEntry(getVal(changedField), G.spells || []);
      const fields = ["tech", "form", "level", "range", "duration", "target", "requisites", "ritual"].map((k) => `spell_${i}_${k}`);
      if (spell) {
        const artName = (key) => arts().find((a) => a.key === key)?.cn || key;
        const values = {
          tech: artName(spell.tech), form: artName(spell.form), level: spell.level ?? "",
          range: spell.range, duration: spell.duration, target: spell.target,
          requisites: (spell.requisites || []).map(artName).join("、"), ritual: !!spell.ritual
        };
        Object.entries(values).forEach(([k, value]) => fillManaged(`spell_${i}_${k}`, value, true));
      } else clearManaged(fields);
      refreshSpellReference(i);
    }
    const weaponMatch = /^wp_(\d+)_name$/.exec(changedField || "");
    if (weaponMatch) {
      const i = weaponMatch[1];
      const weapon = matchEntry(getVal(changedField), G.weapons || []);
      const mapping = { init_weap: "init", atk_weap: "atk", dfn_weap: "dfn", dam_weap: "dam", load: "load", range: "range", ability: "ability" };
      if (weapon) {
        Object.entries(mapping).forEach(([field, key]) => {
          let value = weapon[key];
          if (key === "ability") value = G.abilities.find((a) => normalize(a.en) === normalize(value))?.cn || value;
          fillManaged(`wp_${i}_${field}`, value ?? "", true);
        });
        fillManaged(`wp_${i}_carried`, true, true);
      } else clearManaged(Object.keys(mapping).map((key) => `wp_${i}_${key}`).concat(`wp_${i}_carried`));
    }
    if (changedField === "armor_worn_1") {
      const armor = matchEntry(getVal(changedField), G.armors || []);
      if (armor) {
        fillManaged("armor_protection", armor.protection, true);
        fillManaged("armor_load", armor.load, true);
      } else clearManaged(["armor_protection", "armor_load"]);
    }
  }
  function condition() {
    const counts = {light: 0, medium: 0, heavy: 0};
    Object.keys(counts).forEach((kind) => {
      for (let i = 1; i <= 5; i++) counts[kind] += checked(`wound_${kind}_${i}`) ? 1 : 0;
    });
    let level = 0;
    FATIGUE.forEach((name, index) => { if (checked(`fatigue_${name}`)) level = index; });
    const blocked = checked("wound_dead_1") ? "死亡" : checked("wound_incap_1") ? "失能" : level === 5 ? "昏迷" : "";
    return { wound: R.woundPenalty(counts), fatigue: R.fatiguePenalty(level), blocked };
  }
  function equipment() {
    let load = Math.max(0, getNum("armor_load")) + Math.max(0, getNum("equipment_load"));
    for (let i = 1; i <= 6; i++) if (checked(`wp_${i}_carried`)) load += Math.max(0, getNum(`wp_${i}_load`));
    return {load, burden: R.burden(load), encumbrance: R.encumbrance(load, getNum("char_str_score"))};
  }
  function convertExperience() {
    if (!checked("xp_cumulative")) return;
    const convert = (exp, score, kind) => {
      const value = getVal(exp).trim();
      if (/^\d+$/.test(value)) {
        const result = R.advancement(Number(value), kind);
        if (!result) { clearManaged([score]); return; }
        fillManaged(score, result.score, true);
        fieldElement(exp).title = `累计经验 ${value}；本级进度 ${result.progress}；下一级需要 ${result.nextCost}`;
      } else { clearManaged([score]); fieldElement(exp).title = "累计经验必须是非负整数；留空后等级可手填。"; }
    };
    for (let i = 1; i <= 30; i++) convert(`ab_${i}_exp`, `ab_${i}_score`, "ability");
    arts().forEach((art) => convert(`art_${art.key}_exp`, `art_${art.key}_score`, "art"));
    for (const i of spellIndices) convert(`spell_${i}_exp`, `spell_${i}_mastery`, "ability");
  }
  function spellScore(i) {
    const technique = artScore(getVal(`spell_${i}_tech`), G.techniques);
    const form = artScore(getVal(`spell_${i}_form`), G.forms);
    if (technique === null || form === null) return null;
    const reqs = getVal(`spell_${i}_requisites`).trim();
    const techniqueRequisites = [], formRequisites = [];
    if (reqs) {
      for (const name of reqs.split(/[、,，;/；]+/).map((s) => s.trim()).filter(Boolean)) {
        const tech = matchEntry(name, G.techniques), f = matchEntry(name, G.forms);
        if (!tech && !f) return null;
        (tech ? techniqueRequisites : formRequisites).push(getNum(`art_${(tech || f).key}_score`));
      }
    }
    const masteryMatch = getVal(`spell_${i}_mastery`).match(/^\s*(\d+)/);
    const score = R.castingScore({technique, form, techniqueRequisites, formRequisites,
      stamina: getNum("char_sta_score"), aura: getNum("casting_aura"), encumbrance: equipment().encumbrance,
      mastery: masteryMatch ? Number(masteryMatch[1]) : 0});
    return checked(`spell_${i}_ritual`) ? R.castingTotal({score, mode: "ritual", artesLiberales: findAbilityScore("Artes Liberales"), philosophiae: findAbilityScore("Philosophiae")}) : score;
  }
  function runAutoCalculations() {
    if (!state.autoCalc) { renderCastingMatrix(); renderRuleSummary(); return; }
    convertExperience();
    const ranges = R.woundRanges(getNum("size"));
    ["light", "medium", "heavy", "incap", "dead"].forEach((kind) => {
      const range = ranges[kind === "incap" ? "incapacitated" : kind];
      setVal(`wound_${kind}_range`, Array.isArray(range) ? `${range[0]}${range[1] === Infinity ? "+" : `–${range[1]}`}` : range);
    });
    const mappings = {
      fc_qik: getNum("char_qik_score"), fc_finesse: findAbilityScore("Finesse"),
      de_per: getNum("char_per_score"), de_awareness: findAbilityScore("Awareness"),
      bt_per: getNum("char_per_score"), bt_finesse: findAbilityScore("Finesse"),
      conc_sta: getNum("char_sta_score"), conc_skill: findAbilityScore("Concentration"),
      mr_parma: findAbilityScore("Parma Magica"), lab_int: getNum("char_int_score"), lab_theory: findAbilityScore("Magic Theory")
    };
    Object.entries(mappings).forEach(([name, value]) => setVal(name, value));
    setVal("fc_total", getNum("fc_qik") + getNum("fc_finesse"));
    setVal("de_total", getNum("de_per") + getNum("de_awareness"));
    setVal("bt_total", getNum("bt_per") + getNum("bt_finesse"));
    setVal("conc_total", getNum("conc_sta") + getNum("conc_skill"));
    setVal("mr_total", getNum("mr_parma") * 5);
    setVal("lab_total", R.labTotal({intelligence: getNum("lab_int"), magicTheory: getNum("lab_theory"), aura: getNum("lab_aura")}));
    setVal("longevity_age_mod", getVal("longevity_lab_total") === "" ? "" : R.longevityModifier(getNum("longevity_lab_total"), checked("longevity_mundane")));
    const eq = equipment();
    if (getVal("armor_protection") !== "" || getVal("soak_bonus") !== "") {
      fillManaged("soak", getNum("char_sta_score") + getNum("armor_protection") + getNum("soak_bonus"), true);
    } else clearManaged(["soak"]);
    for (let i = 1; i <= 6; i++) {
      const active = getVal(`wp_${i}_name`).trim() !== "";
      const attrs = { init_qik: "qik", atk_dex: "dex", dfn_qik: "qik", dam_str: "str" };
      if (active) {
        Object.entries(attrs).forEach(([field, attr]) => setVal(`wp_${i}_${field}`, getNum(`char_${attr}_score`)));
        setVal(`wp_${i}_init_enc`, eq.encumbrance);
      } else {
        Object.keys(attrs).forEach((field) => setVal(`wp_${i}_${field}`, ""));
        setVal(`wp_${i}_init_enc`, "");
      }
      const ability = matchEntry(getVal(`wp_${i}_ability`), G.abilities);
      ["atk_ab", "dfn_ab"].forEach((field) => { fieldElement(`wp_${i}_${field}`).readOnly = !!ability; });
      if (ability) {
        fillManaged(`wp_${i}_atk_ab`, findAbilityScore(ability.en), true);
        fillManaged(`wp_${i}_dfn_ab`, findAbilityScore(ability.en), true);
      } else clearManaged([`wp_${i}_atk_ab`, `wp_${i}_dfn_ab`]);
      const weapon = matchEntry(getVal(`wp_${i}_name`), G.weapons || []);
      const shield = weapon?.type === "shield";
      if (weapon) fieldElement(`wp_${i}_name`).title = [weapon.notes, weapon.str === null ? "" : `最低力量 ${weapon.str}${getNum("char_str_score") < weapon.str ? "（尚未满足）" : ""}`, weapon.src].filter(Boolean).join("\n");
      if (active) {
        setVal(`wp_${i}_init_total`, shield ? "" : getNum(`wp_${i}_init_qik`) + getNum(`wp_${i}_init_weap`) - eq.encumbrance);
        setVal(`wp_${i}_atk_total`, shield || weapon?.atk === null ? "" : getNum(`wp_${i}_atk_dex`) + getNum(`wp_${i}_atk_ab`) + getNum(`wp_${i}_atk_weap`));
        setVal(`wp_${i}_dfn_total`, shield ? "" : getNum(`wp_${i}_dfn_qik`) + getNum(`wp_${i}_dfn_ab`) + getNum(`wp_${i}_dfn_weap`));
        setVal(`wp_${i}_dam_total`, shield || weapon?.dam === null ? "" : getNum(`wp_${i}_dam_str`) + getNum(`wp_${i}_dam_weap`));
      } else ["init", "atk", "dfn", "dam"].forEach((kind) => setVal(`wp_${i}_${kind}_total`, ""));
    }
    for (const i of spellIndices) {
      const score = spellScore(i);
      setVal(`spell_${i}_bonus`, score === null ? "" : signed(score));
      fieldElement(`spell_${i}_bonus`).title = score === null ? "需填写明确的技法、型式与先决条件才能计算。" : "含先决条件、精通、负荷、施法辉环；仪式含自由七艺与哲学。不含骰、伤势与疲劳。";
    }
    renderCastingMatrix();
    renderRuleSummary();
  }
  function renderRuleSummary() {
    const eq = equipment(), status = condition();
    const out = document.getElementById("ruleSummary");
    const penalty = status.blocked || signed(status.wound + (status.fatigue || 0));
    out.textContent = `总负重 ${eq.load} → 负载 ${eq.burden} → 负荷 ${eq.encumbrance}；伤势 ${signed(status.wound)}；疲劳 ${status.fatigue === null ? "昏迷" : signed(status.fatigue)}；行动修正：${penalty}。`;
    const form = artScore(getVal("resistance_form"), G.forms);
    document.getElementById("resistanceResult").textContent = form === null ? "选择型式后显示抗性" : String(R.magicResistance({parma: findAbilityScore("Parma Magica"), form, aura: getNum("casting_aura")}));
  }
  function renderCastingMatrix() {
    const table = document.getElementById("castingMatrixTable");
    if (!table) return;
    table.replaceChildren();
    const header = table.createTHead().insertRow();
    header.appendChild(document.createElement("th")).textContent = "技法 / 型式";
    G.forms.forEach((form) => { header.appendChild(document.createElement("th")).textContent = `${form.cn} (${form.abbr})`; });
    const body = table.createTBody(), status = condition();
    G.techniques.forEach((tech) => {
      const row = body.insertRow();
      row.appendChild(document.createElement("th")).textContent = `${tech.cn} (${tech.abbr})`;
      G.forms.forEach((form) => {
        const score = R.castingScore({technique: getNum(`art_${tech.key}_score`), form: getNum(`art_${form.key}_score`),
          stamina: getNum("char_sta_score"), aura: getNum("casting_aura"), encumbrance: equipment().encumbrance});
        const cell = row.insertCell();
        const adjusted = score + status.wound + (status.fatigue || 0);
        cell.textContent = `${signed(score)} (${R.castingTotal({score, mode: "nonfatiguing"})})`;
        cell.title = status.blocked ? `当前状态：${status.blocked}，不能正常施法。` : `计入伤疲：${signed(adjusted)}；无疲劳即兴：${R.castingTotal({score: adjusted, mode: "nonfatiguing"})}。疲劳即兴另加压力骰后除以 2。`;
      });
    });
  }

  // 存档沿用 v1 键与原字段名，旧角色无需重新填写。
  function getActiveData() { return state.slots[state.activeSlotId].data; }
  function isRecord(value) { return !!value && typeof value === "object" && !Array.isArray(value); }
  function cleanData(value) {
    if (!isRecord(value)) throw new Error("角色数据必须是对象。");
    const result = {};
    let count = 0;
    const fields = new Map([...document.querySelectorAll("[data-field]")].map((el) => [el.dataset.field, el.type]));
    Object.entries(value).forEach(([field, entry]) => {
      const spell = /^spell_([1-9]\d*)_(.+)$/.exec(field);
      if (spell && !Number.isSafeInteger(Number(spell[1]))) throw new Error("法术栏位编号无效。");
      const schemaField = spell ? `spell_1_${spell[2]}` : field;
      if (!fields.has(schemaField)) return;
      if (fields.get(schemaField) === "checkbox") {
        if (typeof entry !== "boolean" && entry !== 0 && entry !== 1) throw new Error(`勾选项 ${field} 格式不正确。`);
        result[field] = !!entry;
      } else {
        if (entry !== null && !["string", "number"].includes(typeof entry)) throw new Error(`填写项 ${field} 必须是文字或数值。`);
        result[field] = entry == null ? "" : String(entry);
      }
      count++;
    });
    if (Object.keys(value).length && !count) throw new Error("文件中没有可识别的角色卡字段。");
    if (isRecord(value.__autoFilled)) {
      result.__autoFilled = {};
      Object.keys(result).forEach((field) => {
        const entry = value.__autoFilled[field];
        if (["string", "number", "boolean"].includes(typeof entry)) result.__autoFilled[field] = entry;
      });
    }
    return result;
  }
  function saveToStorage() {
    try {
      const name = String(getActiveData().character_name || "").trim();
      if (name) state.slots[state.activeSlotId].name = name;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      updateSlotSelector();
    } catch (error) {
      alert("保存失败，请导出 JSON 备份。");
      console.error("角色卡保存失败", error);
    }
  }
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed) || !isRecord(parsed.slots)) throw new Error("存档结构无效。");
        const slots = {};
        Object.entries(parsed.slots).forEach(([id, slot]) => {
          if (["__proto__", "prototype", "constructor"].includes(id) || !isRecord(slot)) return;
          slots[id] = {name: typeof slot.name === "string" ? slot.name : "未命名角色", data: cleanData(slot.data)};
        });
        if (!Object.keys(slots).length) throw new Error("没有有效角色。");
        state = { slots, activeSlotId: Object.hasOwn(slots, parsed.activeSlotId) ? parsed.activeSlotId : Object.keys(slots)[0],
          autoCalc: parsed.autoCalc !== false, autoFill: parsed.autoFill !== false, bilingual: parsed.bilingual === true };
      }
      applyStateToDOM();
    } catch (error) {
      applyStateToDOM();
      alert("无法读取本地存档，请先导出或检查浏览器存储。");
      console.error("角色卡载入失败", error);
    }
  }
  function applyStateToDOM() {
    const data = getActiveData();
    renderSpellCards(data);
    document.querySelectorAll("[data-field]").forEach((el) => {
      const value = data[el.dataset.field];
      if (el.type === "checkbox") el.checked = value === true;
      else el.value = value ?? "";
    });
    if (!getVal("house") && getVal("p3_house")) setVal("house", getVal("p3_house"));
    else setVal("p3_house", getVal("house"));
    document.body.classList.toggle("mode-cn-only", !state.bilingual);
    const toggles = [
      ["btnToggleLang", state.bilingual, "中英双语", "纯中文标签"],
      ["btnToggleAutoCalc", state.autoCalc, "自动计算：开", "自动计算：关"],
      ["btnToggleAutoFill", state.autoFill, "自动填写：开", "自动填写：关"]
    ];
    toggles.forEach(([id, active, on, off]) => {
      const button = document.getElementById(id);
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      button.textContent = active ? on : off;
    });
    document.querySelectorAll(".calc-output").forEach((el) => { el.readOnly = state.autoCalc; });
    for (let i = 1; i <= 6; i++) {
      ["init_qik", "atk_dex", "dfn_qik", "dam_str", "init_enc"].forEach((field) => {
        fieldElement(`wp_${i}_${field}`).readOnly = state.autoCalc;
      });
      if (!state.autoCalc) ["atk_ab", "dfn_ab"].forEach((field) => { fieldElement(`wp_${i}_${field}`).readOnly = false; });
    }
    ["fc_qik", "fc_finesse", "de_per", "de_awareness", "bt_per", "bt_finesse", "conc_sta", "conc_skill", "mr_parma", "lab_int", "lab_theory"].forEach((field) => {
      fieldElement(field).readOnly = state.autoCalc;
      fieldElement(field).title = "自动计算开启时取自第 1 页属性与能力。";
    });
    for (const i of spellIndices) refreshSpellReference(i);
    updateSlotSelector();
    runAutoCalculations();
  }
  function updateSlotSelector() {
    const select = document.getElementById("slotSelect");
    const options = Object.entries(state.slots).map(([id, slot]) => new Option(slot.name || "未命名角色", id, false, id === state.activeSlotId));
    select.replaceChildren(...options);
  }
  function renderGlossaryTable() {
    const query = normalize(document.getElementById("glossarySearchInput").value);
    const category = document.getElementById("glossaryCatFilter").value;
    const rows = G.entries.filter((item) => (category === "ALL" || category === item.cat) &&
      (!query || [item.en, item.cn, ...(item.aliases || [])].some((text) => normalize(text).includes(query))));
    const body = document.getElementById("glossaryTableBody");
    body.replaceChildren();
    rows.forEach((item) => {
      const row = body.insertRow();
      [item.cat, item.en, item.cn].forEach((value) => { row.insertCell().textContent = value || ""; });
      if (item.notes) row.title = item.notes;
    });
    document.getElementById("glossaryCount").textContent = `${rows.length} / ${G.entries.length} 条`;
    if (!rows.length) { const cell = body.insertRow().insertCell(); cell.colSpan = 3; cell.textContent = "没有匹配的定本词条。"; }
  }
  function uniqueSlotId(prefix) {
    return `${prefix}_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
  }
  function bindEvents() {
    document.getElementById("btnAddSpell").addEventListener("click", () => {
      let index = DEFAULT_SPELL_COUNT + 1;
      while (spellIndices.includes(index)) index++;
      getActiveData()[`spell_${index}_name`] = "";
      applyStateToDOM();
      saveToStorage();
      fieldElement(`spell_${index}_name`).focus();
    });
    document.getElementById("btnFillHouseDefaults").addEventListener("click", () => {
      const house = matchEntry(getVal("house"), G.houses);
      const status = document.getElementById("houseDefaultsStatus");
      if (!house) { status.textContent = "请先选择一个定本学派。"; return; }
      fillManaged("domus_magna", house.domus || "", true);
      fillManaged("primus", house.primus || "", true);
      status.textContent = `已按定本填写${house.cn}的宗庭与首席。`;
      saveToStorage();
    });
    document.addEventListener("input", (event) => {
      const target = event.target, field = target.dataset.field;
      if (!field) return;
      getActiveData()[field] = target.type === "checkbox" ? target.checked : target.value;
      if (getActiveData().__autoFilled) delete getActiveData().__autoFilled[field];
      if (field.startsWith("fatigue_") && target.checked) FATIGUE.forEach((name) => { if (`fatigue_${name}` !== field) setVal(`fatigue_${name}`, false); });
      runAutoFill(field);
      if (/^spell_\d+_name$/.test(field)) refreshSpellReference(field.split("_")[1]);
      runAutoCalculations();
      saveToStorage();
    });
    document.getElementById("slotSelect").addEventListener("change", (event) => {
      state.activeSlotId = event.target.value;
      applyStateToDOM();
      saveToStorage();
    });
    document.getElementById("btnNewSlot").addEventListener("click", () => {
      const name = prompt("新角色名称：", "新法师角色")?.trim();
      if (!name) return;
      const id = uniqueSlotId("char");
      state.slots[id] = {name, data: {character_name: name, current_year: "1220", size: "0", confidence: "1 (3)"}};
      state.activeSlotId = id;
      applyStateToDOM();
      saveToStorage();
    });
    [["btnToggleAutoCalc", "autoCalc"], ["btnToggleAutoFill", "autoFill"], ["btnToggleLang", "bilingual"]].forEach(([id, key]) => {
      document.getElementById(id).addEventListener("click", () => { state[key] = !state[key]; applyStateToDOM(); saveToStorage(); });
    });
    document.getElementById("btnToggleMatrix").addEventListener("click", () => {
      const wrap = document.getElementById("castingMatrixWrap");
      wrap.style.display = wrap.style.display === "none" ? "block" : "none";
      renderCastingMatrix();
    });
    const drawer = document.getElementById("glossaryDrawer");
    const closeDrawer = () => { drawer.classList.remove("open"); document.getElementById("btnOpenGlossary").focus(); };
    document.getElementById("btnOpenGlossary").addEventListener("click", () => {
      drawer.classList.add("open"); renderGlossaryTable(); document.getElementById("glossarySearchInput").focus();
    });
    document.getElementById("btnCloseGlossary").addEventListener("click", closeDrawer);
    drawer.addEventListener("click", (event) => { if (event.target === drawer) closeDrawer(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && drawer.classList.contains("open")) closeDrawer(); });
    document.getElementById("glossarySearchInput").addEventListener("input", renderGlossaryTable);
    document.getElementById("glossaryCatFilter").addEventListener("change", renderGlossaryTable);
    document.getElementById("btnExportJson").addEventListener("click", () => {
      const data = getActiveData();
      const name = (String(data.character_name || "ars-magica-character")).replace(/[\\/:*?"<>|\s]+/g, "_");
      const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `${name}_角色卡.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    document.getElementById("inputImportJson").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const data = cleanData(JSON.parse(await file.text()));
        const id = uniqueSlotId("import"), name = String(data.character_name || file.name.replace(/\.json$/i, ""));
        state.slots[id] = {name, data}; state.activeSlotId = id;
        applyStateToDOM(); saveToStorage();
      } catch (error) { alert(`无法导入：${error.message}`); }
      event.target.value = "";
    });
    document.getElementById("btnPrint").addEventListener("click", () => window.print());
    document.getElementById("btnReset").addEventListener("click", () => {
      if (!confirm("确定清空当前角色卡？其他角色不受影响。")) return;
      state.slots[state.activeSlotId] = {name: "未命名角色", data: {}};
      applyStateToDOM(); saveToStorage();
    });
  }
  document.addEventListener("DOMContentLoaded", () => {
    buildSheetDOM();
    populateDatalists();
    bindEvents();
    loadFromStorage();
  });
})();
