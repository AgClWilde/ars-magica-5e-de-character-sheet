"use strict";

// ARS_PLAYWRIGHT_PATH 可指向已有 Playwright 安装；测试只打开本项目的本地页面。
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.ARS_PLAYWRIGHT_PATH || "playwright");

const siteDirectory = process.env.ARS_SITE_DIR || path.resolve(__dirname, "..");
const url = pathToFileURL(path.resolve(siteDirectory, "index.html")).href;
const storageKey = "ars_magica_5e_zh_sheets_v1";
const input = (page, name) => page.locator(`[data-field="${name}"]`);
const fill = (page, name, value) => input(page, name).fill(String(value));
const value = (page, name) => input(page, name).inputValue();
let browser;

before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true
  });
});
after(async () => { await browser?.close(); });

async function withPage(run, savedState) {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (savedState) {
    await page.addInitScript(({ key, state }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    }, { key: storageKey, state: savedState });
  }
  try {
    await page.goto(url);
    await page.waitForFunction(() => document.querySelectorAll("#spellsGrid .spell-card").length === 12);
    await page.locator(".rules-controls summary").click();
    await run(page);
    assert.deepEqual(errors, [], "页面不应产生未捕获错误");
  } finally {
    await context.close();
  }
}

test("页面初始化、术语分类及表单字段完整", async () => withPage(async (page) => {
  assert.equal(await page.locator("#abilitiesBody tr").count(), 30);
  assert.equal(await page.locator("#spellsGrid .spell-card").count(), 12);
  assert.equal(await page.locator("#techniquesBody tr, #formsCol1Body tr, #formsCol2Body tr").count(), 15);
  assert.equal(await page.locator("#datalist-flaws option").count() > 0, true);
  const duplicateFields = await page.locator("[data-field]").evaluateAll((nodes) => {
    const keys = nodes.map((node) => node.dataset.field);
    return keys.filter((key, i) => keys.indexOf(key) !== i);
  });
  assert.deepEqual(duplicateFields, []);
  await page.locator("#btnOpenGlossary").click();
  await page.locator("#glossarySearchInput").fill("Vim");
  assert.match(await page.locator("#glossaryTableBody").innerText(), /原初/);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#glossaryDrawer").evaluate((el) => el.classList.contains("open")), false);
}));

test("学派双向同步、默认人事更新且保留手改资料", async () => withPage(async (page) => {
  await fill(page, "house", "House Bjornaer");
  assert.equal(await value(page, "p3_house"), "House Bjornaer");
  assert.equal(await value(page, "primus"), "法尔克");
  await fill(page, "p3_house", "House Flambeau");
  assert.equal(await value(page, "house"), "House Flambeau");
  assert.equal(await value(page, "domus_magna"), "太阳堡");
  await fill(page, "primus", "本传奇首席");
  await fill(page, "house", "House Bonisagus");
  assert.equal(await value(page, "primus"), "本传奇首席");
  assert.equal(await value(page, "domus_magna"), "杜伦玛");
  await page.locator("#btnFillHouseDefaults").click();
  assert.equal(await value(page, "primus"), "穆里翁");
  await fill(page, "primus", "本传奇首席");
  await fill(page, "house", "");
  assert.equal(await value(page, "domus_magna"), "");
  assert.equal(await value(page, "primus"), "本传奇首席");
}));

test("现行译名自动填写，旧译名存档仍可匹配且说明不附出处", async () => withPage(async (page) => {
  assert.equal(await page.locator('#datalist-spells option[value="守望结界"]').count(), 1);
  assert.equal(await page.locator('#datalist-spells option[value="坚守之眼"]').count(), 0);
  assert.equal(await page.locator('#datalist-abilities option[value="民法与教会法"]').count(), 1);
  await fill(page, "spell_1_name", "守望结界");
  assert.equal(await value(page, "spell_1_tech"), "掌控");
  assert.equal(await value(page, "spell_1_form"), "原初");
  assert.equal(await input(page, "spell_1_ritual").isChecked(), true);
  assert.match(await page.locator("#spellReference1").textContent(), /守望结界会将另一道法术暂存/);
  assert.doesNotMatch(await page.locator("#spellReference1").textContent(), /定本·|中文 L\d+|英文 L\d+/);
  await fill(page, "spell_1_name", "坚守之眼");
  assert.equal(await value(page, "spell_1_duration"), "特殊");
  await fill(page, "wp_1_name", "石头");
  assert.equal(await value(page, "wp_1_ability"), "投掷武器");
  assert.doesNotMatch(await input(page, "wp_1_name").getAttribute("title"), /定本·|中文 L\d+|英文 L\d+/);
  await page.reload();
  assert.equal(await value(page, "spell_1_name"), "坚守之眼");
  assert.match(await page.locator("#spellReference1").textContent(), /守望结界会将另一道法术暂存/);
}));

test("能力精确匹配，修改与删除同步清除关联小计", async () => withPage(async (page) => {
  await fill(page, "char_qik_score", 2);
  await fill(page, "ab_1_name", "Finesse");
  await fill(page, "ab_1_score", 4);
  assert.equal(await value(page, "fc_total"), "6");
  await fill(page, "char_qik_score", -1);
  assert.equal(await value(page, "fc_total"), "3");
  await fill(page, "ab_1_name", "Finesse unrelated");
  assert.equal(await value(page, "fc_finesse"), "0");
  await fill(page, "ab_1_name", "精密 (Finesse)");
  assert.equal(await value(page, "fc_total"), "3");
  await fill(page, "ab_1_name", "");
  assert.equal(await value(page, "fc_total"), "-1");
}));

test("法术自动填写、先决秘艺、负荷、仪式和清空联动", async () => withPage(async (page) => {
  await fill(page, "art_muto_score", 8);
  await fill(page, "art_animal_score", 13);
  await fill(page, "art_corpus_score", 6);
  await fill(page, "char_sta_score", 2);
  await fill(page, "casting_aura", 3);
  await fill(page, "equipment_load", 9);
  await fill(page, "spell_1_name", "The Beast Remade");
  assert.equal(await value(page, "spell_1_level"), "25");
  assert.equal(await value(page, "spell_1_requisites"), "肉身");
  assert.equal(await value(page, "spell_1_bonus"), "+16");
  await fill(page, "spell_1_mastery", 2);
  assert.equal(await value(page, "spell_1_bonus"), "+18");
  await fill(page, "spell_1_requisites", "不存在的秘艺");
  assert.equal(await value(page, "spell_1_bonus"), "");
  await fill(page, "spell_1_requisites", "Corpus");
  await fill(page, "ab_1_name", "Artes Liberales");
  await fill(page, "ab_1_score", 3);
  await fill(page, "ab_2_name", "Philosophiae");
  await fill(page, "ab_2_score", 2);
  await input(page, "spell_1_ritual").check();
  assert.equal(await value(page, "spell_1_bonus"), "+23");
  await fill(page, "spell_1_name", "Ward against the Beasts of Legend");
  assert.equal(await value(page, "spell_1_level"), "");
  assert.equal(await input(page, "spell_1_level").getAttribute("placeholder"), "通用：自定等级");
  await fill(page, "spell_1_name", "");
  assert.equal(await value(page, "spell_1_tech"), "");
  assert.equal(await value(page, "spell_1_bonus"), "");
}));

test("武器和护甲自动填写、携带负荷与属性实时更新", async () => withPage(async (page) => {
  await fill(page, "char_str_score", 2);
  await fill(page, "char_qik_score", 1);
  await fill(page, "char_dex_score", 3);
  await fill(page, "char_sta_score", 2);
  await fill(page, "ab_1_name", "Great Weapon");
  await fill(page, "ab_1_score", 4);
  await fill(page, "wp_1_name", "Staff");
  assert.equal(await value(page, "wp_1_atk_total"), "10");
  assert.equal(await value(page, "wp_1_dfn_total"), "8");
  assert.equal(await value(page, "wp_1_dam_total"), "4");
  await fill(page, "armor_worn_1", "Chain Mail (Full)");
  await fill(page, "equipment_load", 2);
  assert.match(await page.locator("#ruleSummary").textContent(), /总负重 10 → 负载 4 → 负荷 2/);
  assert.equal(await value(page, "wp_1_init_total"), "1");
  assert.equal(await value(page, "soak"), "11");
  await fill(page, "char_dex_score", 5);
  assert.equal(await value(page, "wp_1_atk_total"), "12");
  await input(page, "wp_1_carried").uncheck();
  assert.match(await page.locator("#ruleSummary").textContent(), /总负重 8 → 负载 3 → 负荷 1/);
  await fill(page, "armor_worn_1", "");
  assert.equal(await value(page, "armor_load"), "");
  assert.equal(await value(page, "soak"), "");
}));

test("闪避、盾牌和投射武器按各自规则计算", async () => withPage(async (page) => {
  await fill(page, "char_qik_score", 2);
  await fill(page, "char_dex_score", 3);
  await fill(page, "char_str_score", 1);
  await fill(page, "wp_1_name", "Dodge");
  assert.equal(await value(page, "wp_1_atk_total"), "");
  assert.equal(await value(page, "wp_1_dam_total"), "");
  assert.equal(await value(page, "wp_1_dfn_total"), "2");
  await fill(page, "wp_2_name", "Shield, Round");
  assert.equal(await value(page, "wp_2_atk_total"), "");
  assert.equal(await value(page, "wp_2_dam_total"), "");
  await fill(page, "ab_1_name", "Bows");
  await fill(page, "ab_1_score", 4);
  await fill(page, "wp_3_name", "Bow, Long");
  assert.equal(await value(page, "wp_3_dfn_weap"), "0");
  assert.equal(await value(page, "wp_3_dfn_total"), "6");
  assert.equal(await value(page, "wp_3_dam_total"), "9");
}));

test("伤疲状态互斥与失能边界，不污染吸收和抗性", async () => withPage(async (page) => {
  await fill(page, "char_sta_score", 2);
  await fill(page, "armor_protection", 5);
  await fill(page, "ab_1_name", "Parma Magica");
  await fill(page, "ab_1_score", 3);
  await fill(page, "art_ignem_score", 8);
  await fill(page, "casting_aura", 2);
  await fill(page, "resistance_form", "Ignem");
  assert.equal(await page.locator("#resistanceResult").textContent(), "25");
  await input(page, "wound_light_1").check();
  await input(page, "wound_medium_1").check();
  await input(page, "fatigue_weary").check();
  assert.match(await page.locator("#ruleSummary").textContent(), /行动修正：-5/);
  assert.equal(await value(page, "soak"), "7");
  assert.equal(await page.locator("#resistanceResult").textContent(), "25");
  await input(page, "fatigue_unconscious").check();
  assert.equal(await input(page, "fatigue_weary").isChecked(), false);
  assert.match(await page.locator("#ruleSummary").textContent(), /行动修正：昏迷/);
  assert.match(await page.locator("#castingMatrixTable td").first().getAttribute("title"), /昏迷/);
  await input(page, "wound_incap_1").check();
  assert.match(await page.locator("#ruleSummary").textContent(), /行动修正：失能/);
}));

test("自动填写与计算分别关闭，手填输出可保存", async () => withPage(async (page) => {
  await page.locator("#btnToggleAutoCalc").click();
  assert.equal(await input(page, "spell_1_bonus").getAttribute("readonly"), null);
  await fill(page, "spell_1_bonus", "+77");
  await fill(page, "char_sta_score", 5);
  assert.equal(await value(page, "spell_1_bonus"), "+77");
  await page.locator("#btnToggleAutoFill").click();
  await fill(page, "spell_1_name", "The Beast Remade");
  assert.equal(await value(page, "spell_1_form"), "");
  await fill(page, "house", "House Bjornaer");
  assert.equal(await value(page, "p3_house"), "House Bjornaer");
  assert.equal(await value(page, "primus"), "");
  await page.reload();
  assert.equal(await value(page, "spell_1_bonus"), "+77");
  await page.locator("#btnToggleAutoCalc").click();
  assert.equal(await value(page, "spell_1_bonus"), "");
}));

test("经验默认按进度手填，累计模式换算且清除自动结果", async () => withPage(async (page) => {
  await fill(page, "ab_1_exp", 14);
  await fill(page, "ab_1_score", 7);
  assert.equal(await value(page, "ab_1_score"), "7");
  await input(page, "xp_cumulative").check();
  assert.equal(await value(page, "ab_1_score"), "1");
  await fill(page, "ab_1_exp", 15);
  assert.equal(await value(page, "ab_1_score"), "2");
  await fill(page, "art_creo_exp", 55);
  assert.equal(await value(page, "art_creo_score"), "10");
  await fill(page, "spell_1_exp", 15);
  assert.equal(await value(page, "spell_1_mastery"), "2");
  await fill(page, "ab_1_exp", "");
  assert.equal(await value(page, "ab_1_score"), "");
  await input(page, "xp_cumulative").uncheck();
  await fill(page, "art_creo_exp", 1);
  assert.equal(await value(page, "art_creo_score"), "10");
}));

test("旧版存档、多角色切换及刷新保留各自资料", async () => withPage(async (page) => {
  assert.equal(await value(page, "character_name"), "甲角色");
  assert.equal(await value(page, "spell_1_bonus"), "+31");
  await page.locator("#slotSelect").selectOption("beta");
  assert.equal(await value(page, "character_name"), "乙角色");
  assert.equal(await value(page, "char_sta_score"), "4");
  await fill(page, "player_name", "玩家乙");
  await page.locator("#slotSelect").selectOption("default");
  assert.equal(await value(page, "player_name"), "");
  assert.equal(await value(page, "spell_1_bonus"), "+31");
  await page.reload();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
  assert.equal(saved.slots.beta.data.player_name, "玩家乙");
  assert.equal(saved.slots.default.name, "甲角色");
}, { activeSlotId: "default", autoCalc: false, bilingual: true, slots: {
  default: { name: "甲角色", data: { character_name: "甲角色", char_sta_score: 2, spell_1_bonus: "+31", house: "比约奈尔 (House Bjornaer)" } },
  beta: { name: "乙角色", data: { character_name: "乙角色", char_sta_score: 4 } }
} }));

test("JSON 导入导出往返及无效对象拒绝", async () => withPage(async (page) => {
  const imported = { character_name: "测试法师", player_name: "测试玩家", char_sta_score: "3", size: "1", fatigue_tired: true };
  await page.locator("#inputImportJson").setInputFiles({ name: "角色.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(imported)) });
  await page.waitForFunction(() => document.querySelector('[data-field="character_name"]').value === "测试法师");
  assert.equal(await value(page, "wound_light_range"), "1–6");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#btnExportJson").click();
  const download = await downloadPromise;
  const exported = JSON.parse(await fs.readFile(await download.path(), "utf8"));
  assert.equal(exported.character_name, imported.character_name);
  assert.equal(exported.fatigue_tired, true);
  const count = await page.locator("#slotSelect option").count();
  const dialogPromise = page.waitForEvent("dialog");
  await page.locator("#inputImportJson").setInputFiles({ name: "无效.json", mimeType: "application/json", buffer: Buffer.from("[]") });
  const dialog = await dialogPromise;
  assert.match(dialog.message(), /无法导入/);
  await dialog.dismiss();
  assert.equal(await page.locator("#slotSelect option").count(), count);
  assert.equal(await value(page, "character_name"), imported.character_name);
}));


test("新增法术支持自动填写、计算、存档、切槽与 JSON 往返", async () => withPage(async (page) => {
  await page.locator("#btnAddSpell").click();
  await page.locator("#btnAddSpell").click();
  assert.equal(await page.locator("#spellsGrid .spell-card").count(), 14);
  await fill(page, "art_muto_score", 8);
  await fill(page, "art_animal_score", 13);
  await fill(page, "art_corpus_score", 6);
  await fill(page, "char_sta_score", 2);
  await fill(page, "spell_13_name", "The Beast Remade");
  assert.equal(await value(page, "spell_13_level"), "25");
  assert.equal(await value(page, "spell_13_requisites"), "肉身");
  assert.equal(await value(page, "spell_13_bonus"), "+16");
  await input(page, "xp_cumulative").check();
  await fill(page, "spell_13_exp", 15);
  assert.equal(await value(page, "spell_13_mastery"), "2");
  assert.equal(await value(page, "spell_13_bonus"), "+18");
  await fill(page, "spell_13_notes_1", "新增法术的备注");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#btnExportJson").click();
  const download = await downloadPromise;
  const exported = JSON.parse(await fs.readFile(await download.path(), "utf8"));
  assert.equal(exported.spell_13_notes_1, "新增法术的备注");
  assert.equal(exported.spell_14_name, "");
  await page.reload();
  assert.equal(await page.locator("#spellsGrid .spell-card").count(), 14);
  assert.equal(await value(page, "spell_13_notes_1"), "新增法术的备注");
  assert.equal(await value(page, "spell_13_bonus"), "+18");
  assert.equal(await input(page, "spell_13_bonus").isEditable(), false);
  assert.equal(await page.locator("#spellReference13").isVisible(), true);
  page.once("dialog", (dialog) => dialog.accept("第二个角色"));
  await page.locator("#btnNewSlot").click();
  assert.equal(await page.locator("#spellsGrid .spell-card").count(), 12);
  await page.locator("#slotSelect").selectOption("default");
  assert.equal(await page.locator("#spellsGrid .spell-card").count(), 14);
  assert.equal(await value(page, "spell_13_name"), "The Beast Remade");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#btnReset").click();
  assert.equal(await page.locator("#spellsGrid .spell-card").count(), 12);
  await page.locator("#inputImportJson").setInputFiles({ name: "扩展法术.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(exported)) });
  await page.waitForFunction(() => document.querySelectorAll("#spellsGrid .spell-card").length === 14);
  assert.equal(await value(page, "spell_13_notes_1"), "新增法术的备注");
  assert.equal(await value(page, "spell_13_bonus"), "+18");
  assert.equal(await value(page, "spell_14_name"), "");
}));

test("关闭自动计算后新增空白法术仍保存，手填加值可恢复", async () => withPage(async (page) => {
  await page.locator("#btnToggleAutoCalc").click();
  await page.locator("#btnAddSpell").click();
  await page.reload();
  assert.equal(await page.locator("#spellsGrid .spell-card").count(), 13);
  assert.equal(await input(page, "spell_13_bonus").isEditable(), true);
  await fill(page, "spell_13_bonus", "+27");
  await fill(page, "spell_13_name", "The Beast Remade");
  assert.equal(await value(page, "spell_13_level"), "25");
  await page.reload();
  assert.equal(await value(page, "spell_13_bonus"), "+27");
  await page.locator("#btnToggleAutoCalc").click();
  assert.equal(await input(page, "spell_13_bonus").isEditable(), false);
  assert.equal(await value(page, "spell_13_bonus"), "+0");
}));
