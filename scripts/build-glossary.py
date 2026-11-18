#!/usr/bin/env python3
"""从本地定本中英文 Markdown 重建角色卡词表；只使用 Python 标准库。"""
import argparse
import csv
import hashlib
import json
import re
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
LIBRARY = PROJECT.parent
EN_PATH = Path("Organized/5e/Definitive Edition/Core Rules/Ars Magica - Definitive Edition [Open License - Reviewed].md")
ZH_PATH = Path("翻译/5E/Definitive Edition/Core Rules/魔法秘艺 - 定本核心规则.md")


def plain(value):
    value = re.sub(r"<a\b[^>]*></a>", "", value)
    value = re.sub(r"\[([^\]]+)\]\([^\n]*?\)", r"\1", value)
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    return value.replace("\\*", "").replace("*", "").strip()


def title(value):
    value = plain(value)
    value = re.sub(r"\s*\(kie-RUHR-gee\)", "", value)
    value = re.sub(r"（Chirurgy，发音为[^）]+）", "", value)
    return value.strip()


def headings(lines):
    result = []
    chapter = ""
    anchors = []
    for i, line in enumerate(lines):
        anchor = re.match(r'<a id="([^"]+)"></a>', line)
        if anchor:
            anchors.append(anchor[1])
        match = re.match(r"^(#+) (.*)$", line)
        if not match:
            continue
        if len(match[1]) == 1:
            chapter = title(match[2])
        result.append(dict(line=i + 1, level=len(match[1]), title=title(match[2]),
                           chapter=chapter, anchor=anchors[-1] if anchors else ""))
        anchors = []
    for i, item in enumerate(result):
        item["end"] = result[i + 1]["line"] - 1 if i + 1 < len(result) else len(lines)
        item["body"] = lines[item["line"]:item["end"]]
    return result


def build(library):
    en_data = (library / EN_PATH).read_bytes()
    zh_data = (library / ZH_PATH).read_bytes()
    en_lines, zh_lines = en_data.decode().splitlines(), zh_data.decode().splitlines()
    en_heads, zh_heads = headings(en_lines), headings(zh_lines)
    assert len(en_heads) == len(zh_heads), "中英文标题数不同，须重新审查对齐。"
    pairs = list(zip(en_heads, zh_heads))
    # 正文各章保持同序；附录参考指南有已知重排，不用位置对齐抽取附录。
    for en, zh in pairs:
        if en["chapter"].startswith("Chapter "):
            assert en["level"] == zh["level"], (en["title"], zh["title"])
    by_en = {}
    for pair in pairs:
        by_en.setdefault(pair[0]["title"], []).append(pair)

    def at(name, chapter=None):
        matches = by_en[name]
        if chapter:
            matches = [p for p in matches if p[0]["chapter"].startswith(f"Chapter {chapter}:")]
        assert len(matches) == 1, (name, len(matches))
        return matches[0]

    def record(pair, cat, en=None, cn=None, en_line=None, zh_line=None):
        a, b = pair
        el, zl = en_line or a["line"], zh_line or b["line"]
        chapter = b["chapter"].split("：", 1)[0]
        return {"cat": cat, "en": en or a["title"], "cn": cn or b["title"],
                "src": f"定本·{chapter}·中文 L{zl} / 英文 L{el}",
                "source": {"enFile": "../" + str(EN_PATH), "enLine": el,
                           "zhFile": "../" + str(ZH_PATH), "zhLine": zl,
                           "anchor": b["anchor"], "chapter": b["chapter"]}}

    out = {"meta": {"edition": "Ars Magica Definitive Edition", "translation": "本地定本中文译稿",
                    "sources": [{"file": "../" + str(path), "sha256": hashlib.sha256(data).hexdigest()}
                                for path, data in [(EN_PATH, en_data), (ZH_PATH, zh_data)]]},
           "houses": [], "techniques": [], "forms": [], "abilities": [], "virtues": [],
           "flaws": [], "spells": [], "weapons": [], "armors": [],
           "spellParams": {"ranges": [], "durations": [], "targets": []}, "entries": []}

    # 首席与宗庭以第 2 章明确陈述为准。泰塔罗斯保留两位竞争者。
    house_defaults = [
        ("Bjornaer", "克林特拉", "Crintera", "法尔克", "Falke"),
        ("Bonisagus", "杜伦玛", "Durenmar", "穆里翁", "Murion"),
        ("Criamon", "扭影洞窟", "Cave of Twisting Shadows", "穆斯卡里娅", "Muscaria"),
        ("Ex Miscellanea", "卡德·加杜", "Cad Gadu", "埃布罗因", "Ebroin"),
        ("Flambeau", "太阳堡", "Castra Solis", "加鲁斯", "Garus"),
        ("Guernicus", "马格维卢斯", "Magvillus", "碧勒拉", "Bilera"),
        ("Jerbiton", "瓦尔纳斯提乌姆", "Valnastium", "安德鲁", "Andru"),
        ("Mercere", "哈尔科", "Harco", "英萨泰拉", "Insatella"),
        ("Merinita", "伊伦西利亚", "Irencillia", "汉德里", "Handri"),
        ("Tremere", "科埃里斯", "Coeris", "波埃娜", "Poena"),
        ("Tytalus", "富达鲁斯", "Fudarus", "布利斯特／哈帕克斯（争位）", "Buliste / Harpax"),
        ("Verditius", "维尔迪", "Verdi", "斯托里图斯", "Stouritus"),
    ]
    for name, domus, domus_en, primus, primus_en in house_defaults:
        pair = at("House " + name, 2)
        en_body, zh_body = "\n".join(pair[0]["body"]), "\n".join(pair[1]["body"])
        assert domus in zh_body and domus_en in en_body, name
        for word in primus_en.split(" / "):
            assert word in en_body, (name, word)
        if name != "Tytalus":
            assert primus in zh_body, (name, primus)
        item = record(pair, "学派", cn=pair[1]["title"].removesuffix("学派"))
        item.update(key=name.lower().replace(" ", "-"), aliases=[name, item["cn"] + "学派"],
                    domus=domus, domusEn=domus_en, primus=primus, primusEn=primus_en,
                    notes="定本神话欧洲背景的默认资料；传奇中的人事与地点可自行修改。")
        out["houses"].append(item)

    arts = [("Creo", "Cr", "创生"), ("Intellego", "In", "全视"), ("Muto", "Mu", "万变"),
            ("Perdo", "Pe", "湮灭"), ("Rego", "Re", "掌控"), ("Animal", "An", "动物"),
            ("Aquam", "Aq", "水"), ("Auram", "Au", "风"), ("Corpus", "Co", "肉身"),
            ("Herbam", "He", "植物"), ("Ignem", "Ig", "火"), ("Imaginem", "Im", "意象"),
            ("Mentem", "Me", "心灵"), ("Terram", "Te", "地"), ("Vim", "Vi", "原初")]
    for i, (name, abbr, cn) in enumerate(arts):
        pair = next(p for p in pairs if p[0]["chapter"].startswith("Chapter 7:") and p[0]["title"].startswith(name + " ("))
        assert cn in "\n".join(pair[1]["body"]), (name, cn)
        item = record(pair, "技法" if i < 5 else "型式", en=name, cn=cn)
        item.update(key=name.lower(), abbr=abbr, aliases=[abbr])
        out["techniques" if i < 5 else "forms"].append(item)

    section = ""
    for pair in pairs:
        en, zh = pair
        if en["level"] == 2:
            section = en["title"]
        if en["level"] != 4:
            continue
        if en["chapter"].startswith("Chapter 4:") and section in ("Virtues", "Flaws"):
            key = "virtues" if section == "Virtues" else "flaws"
            item = record(pair, "优势" if key == "virtues" else "劣势")
            first = next(x for x in zh["body"] if x.strip() and not x.startswith("<a "))
            item["kind"] = plain(first)
            item["description"] = plain("\n".join(zh["body"]))
            out[key].append(item)
        elif en["chapter"].startswith("Chapter 5:") and section == "Ability List":
            if en["title"] in ("Hex Delay Modifiers", "Hex Effects"):
                continue
            item = record(pair, "能力")
            item["key"] = re.sub(r"[^a-z0-9]+", "_", item["en"].lower()).strip("_")
            item["description"] = plain("\n".join(zh["body"]))
            specialty = re.search(r"\*专精：\*(.*)", "\n".join(zh["body"]))
            item["specialties"] = plain(specialty[1]) if specialty else ""
            out["abilities"].append(item)

    # 法术标题、所属秘艺、等级、参数与前提逐项对照两种语言。
    tech = form = None
    level = None
    general = False
    art_keys = {a[0]: a[0].lower() for a in arts}
    range_map = {"Per": "自身", "Touch": "触碰", "Eye": "目视", "Eve": "目视", "Voice": "语声", "Sight": "视程", "Arc": "奥法联系"}
    duration_map = {"Mom": "瞬间", "Momentary": "瞬间", "Conc": "专注", "Diam": "直径", "Diameter": "直径", "Sun": "日", "Ring": "持环", "Moon": "月", "Year": "年", "Spec": "特殊", "Special": "特殊", "Sun & Year": "日与年"}
    target_map = {"Ind": "个体", "Individual": "个体", "Part": "部分", "Group": "群体", "Room": "房间", "Str": "建筑", "Bound": "疆界", "Circle": "环", "Taste": "味觉", "Touch": "触觉", "Smell": "嗅觉", "Hearing": "听觉", "Vision": "视觉", "Special": "特殊"}
    for pair in pairs:
        en, zh = pair
        if not en["chapter"].startswith("Chapter 9:"):
            continue
        match = re.match(r"^(Creo|Intellego|Muto|Perdo|Rego) (Animal|Aquam|Auram|Corpus|Herbam|Ignem|Imaginem|Mentem|Terram|Vim) Spells$", en["title"])
        if match:
            tech, form = match[1].lower(), match[2].lower()
        if en["level"] == 4 and (en["title"].startswith("LEVEL ") or en["title"] == "GENERAL"):
            general = en["title"] == "GENERAL"
            level = None if general else int(en["title"].split()[-1])
        if en["level"] != 5 or not tech:
            continue
        body, zh_body = "\n".join(en["body"]), "\n".join(zh["body"])
        stats = re.search(r"^R:\s*(.*?)\s*D:\s*(.*?)\s*T:\s*(.*?)(?:<br>|$)", body, re.M)
        zh_stats = re.search(r"^范围：([^，]+)，持续：([^，]+)，目标：([^，<]+)(.*)", zh_body, re.M)
        assert stats and zh_stats, en["title"]
        r, d, t = [x.rstrip(" ,. ") for x in stats.groups()]
        ritual = ", Ritual" in t
        t = t.replace(", Ritual", "").rstrip(".")
        assert [range_map[r], duration_map[d], target_map[t]] == list(zh_stats.groups()[:3]), (en["title"], stats.groups(), zh_stats.groups())
        assert ritual == ("仪式" in zh_stats[4]), en["title"]
        req = re.search(r"^Req:\s*(.*?)(?:<br>|$)", body, re.M)
        requisites = [] if not req else [art_keys[x.strip()] for x in req[1].split(",")]
        # 该法术把必需前提写在设计式中，参数行没有单列 Req。
        if en["title"] == "Tangle of Wood and Thorns":
            assert "+1 Muto requisite" in body and "+1 万变前提" in zh_body
            requisites = ["muto"]
        conditional_requisites = en["title"] in (
            "Parching Wind", "Circle of Encompassing Flames", "Conjuration of the Indubitable Cold")
        item = record(pair, "法术")
        item.update(key=zh["anchor"], tech=tech, form=form, level=level, general=general,
                    range=zh_stats[1], duration=zh_stats[2], target=zh_stats[3],
                    requisites=requisites, ritual=ritual,
                    castingRequisites=conditional_requisites or bool(re.search(r"casting requisites?", body, re.I)),
                    description=plain(zh_body))
        notes = []
        if ritual:
            notes.append("仪式法术")
        if general:
            notes.append("通用等级：填写已学版本的实际等级")
        if requisites:
            notes.append("前提：" + "、".join(next(a[2] for a in arts if a[0].lower() == key) for key in requisites))
        if item["castingRequisites"]:
            notes.append("含按施法对象确定的施法前提，须按法术说明设置")
        if item["duration"] in ("特殊", "日与年") or item["target"] == "特殊":
            notes.append("特殊参数见法术说明")
        item["notes"] = "；".join(notes)
        out["spells"].append(item)

    # 基础范围、持续时间、目标及魔法感官：使用原文定义，不混入扩展版参数。
    for heading, key in [("Ranges", "ranges"), ("Durations", "durations"), ("Target", "targets"), ("Magical Senses", "targets")]:
        pair = at(heading, 9)
        values = []
        for source in pair:
            found = []
            for offset, line in enumerate(source["body"], source["line"] + 1):
                match = re.match(r"\*\*([^*]+)\*\*[:：]?", line)
                if match:
                    found.append((match[1].rstrip(":："), offset))
            values.append(found)
        assert len(values[0]) == len(values[1]), heading
        for (en, el), (cn, zl) in zip(*values):
            out["spellParams"][key].append(f"{cn} ({en})")
            out["entries"].append(record(pair, {"ranges": "法术范围", "durations": "法术持续", "targets": "法术目标"}[key], en=en, cn=cn, en_line=el, zh_line=zl))

    # 武器与盔甲的每个数字均要求与中文表相同。
    def table_rows(pair):
        rows = []
        for source in pair:
            data = []
            for offset, line in enumerate(source["body"], source["line"] + 1):
                if line.startswith("|"):
                    data.append(([plain(x) for x in line.strip().strip("|").split("|")], offset))
            rows.append(data[2:])
        assert len(rows[0]) == len(rows[1]), pair[0]["title"]
        return zip(*rows)

    def number(value):
        return None if value in ("n/a", "不适用") else int(value.replace("−", "-").replace("–", "-"))

    for heading, weapon_type in [("Melee Weapon Statistics", "melee"), ("Missile Weapon Statistics", "missile")]:
        pair = at(heading, 11)
        for (en, el), (cn, zl) in table_rows(pair):
            item = record(pair, "武器", en=en[0], cn=cn[0], en_line=el, zh_line=zl)
            if item["en"] == "Knife":
                item["en"] += " (Thrown)" if weapon_type == "missile" else " (Melee)"
                item["cn"] += "（投掷）" if weapon_type == "missile" else "（近战）"
            keys = ["init", "atk", "dfn", "dam"] + (["range"] if weapon_type == "missile" else []) + ["str", "load"]
            for offset, key in enumerate(keys, 2):
                assert number(en[offset]) == number(cn[offset]), (item["en"], key)
                item[key] = number(en[offset])
            item.update(type=weapon_type, ability=cn[1],
                        abilityKey={"Brawl": "brawl", "Braw1": "brawl", "Single": "single_weapon", "Great": "great_weapon", "Thrown": "thrown_weapon", "Bow": "bows"}[en[1]],
                        range=item.get("range"), strengthDamage=True, notes="射程单位为步。" if weapon_type == "missile" else "")
            if item["en"].startswith("Shield,"):
                item.update(type="shield", notes="盾牌数值加在所用武器上；盾与武器的最低力量须分别满足。")
            if item["en"] == "Dodge":
                item["notes"] = "仅用于防御，不产生攻击与伤害总值。"
            if item["en"] == "Lance":
                item["notes"] = "仅限骑乘时作为单手武器；下马后按双手长矛使用。"
            out["weapons"].append(item)
    pair = at("Armor Table", 11)
    for (en, el), (cn, zl) in table_rows(pair):
        for offset, name, name_en in [(1, "局部甲", "Partial"), (3, "全身甲", "Full")]:
            protection, load = number(en[offset]), number(en[offset + 1])
            assert [protection, load] == [number(cn[offset]), number(cn[offset + 1])]
            if protection is None:
                continue
            item = record(pair, "护甲", en=f"{en[0]} ({name_en})", cn=f"{cn[0]}（{name}）", en_line=el, zh_line=zl)
            item.update(protection=protection, load=load)
            out["armors"].append(item)

    # 导言中的术语表逐项对应。
    pair = at("Glossary", 1)
    lists = []
    for source in pair:
        values = []
        for offset, line in enumerate(source["body"], source["line"] + 1):
            match = re.match(r"\*\*([^*]+)\*\*[:：]?(.*)", line)
            if match:
                values.append((match[1].rstrip(":："), offset, plain(match[2])))
        lists.append(values)
    assert len(lists[0]) == len(lists[1])
    for (en, el, _), (cn, zl, description) in zip(*lists):
        item = record(pair, "核心术语", en=en, cn=cn, en_line=el, zh_line=zl)
        item["description"] = description
        out["entries"].append(item)

    categories = {3: "人物规则", 7: "魔法规则", 8: "工坊规则", 10: "成长规则", 11: "战斗与障碍", 12: "界域"}
    for pair in pairs:
        en, zh = pair
        chapter = re.match(r"Chapter (\d+):", en["chapter"])
        if not chapter or int(chapter[1]) not in categories or en["level"] not in (2, 3):
            continue
        if any(word in en["title"] for word in ("Example", "Table", "Chart", "Recommended", "Statistics", "Descriptions")):
            continue
        out["entries"].append(record(pair, categories[int(chapter[1])]))

    # 主表只提供旧存档检索别名，定译始终来自当前定本。避免别名占用同类的另一现行名称。
    alias_path = library / "翻译/术语对照总表.csv"
    if alias_path.exists():
        alias_data = alias_path.read_bytes()
        out["meta"]["compatibilityAliasSource"] = {"file": "../翻译/术语对照总表.csv", "sha256": hashlib.sha256(alias_data).hexdigest()}
        aliases = {}
        for row in csv.DictReader(alias_data.decode("utf-8-sig").splitlines()):
            aliases.setdefault((row["类别"], row["英文"].casefold().strip()), []).append(row["中文"].strip())
        for key in ("houses", "techniques", "forms", "abilities", "virtues", "flaws", "spells"):
            canonical = {item["cn"] for item in out[key]}
            alias_category = {"houses": "学派", "techniques": "秘艺与型式", "forms": "秘艺与型式",
                              "abilities": "能力", "virtues": "优势与劣势", "flaws": "优势与劣势", "spells": "法术"}[key]
            for item in out[key]:
                values = item.get("aliases", []) + aliases.get((alias_category, item["en"].casefold()), [])
                item["aliases"] = list(dict.fromkeys(value for value in values if value != item["cn"] and (value not in canonical or value == item["cn"])))
    for key in ("houses", "techniques", "forms", "abilities", "virtues", "flaws", "spells", "weapons", "armors"):
        out["entries"].extend(out[key])
    # 已保存角色使用过的译名继续用于匹配；选项和检索结果仍显示现行定译。
    compatibility_path = PROJECT / "scripts/compatibility-aliases.json"
    compatibility_data = compatibility_path.read_bytes()
    compatibility = json.loads(compatibility_data)
    out["meta"]["compatibilityNames"] = {
        "file": "scripts/compatibility-aliases.json",
        "sha256": hashlib.sha256(compatibility_data).hexdigest(),
    }
    canonical_by_category = {}
    for item in out["entries"]:
        canonical_by_category.setdefault(item["cat"], set()).add(item["cn"])
    for item in out["entries"]:
        previous = compatibility.get(item["cat"], {}).get(item["en"], [])
        if previous:
            values = item.get("aliases", []) + previous
            item["aliases"] = list(dict.fromkeys(
                value for value in values
                if value != item["cn"] and value not in canonical_by_category[item["cat"]]
            ))
    unique = {}
    for item in out["entries"]:
        unique.setdefault((item["cat"], item["en"], item["cn"]), item)
    out["entries"] = list(unique.values())
    counts = {key: len(out[key]) for key in ("houses", "techniques", "forms", "abilities", "virtues", "flaws", "spells", "weapons", "armors", "entries")}
    assert [counts[k] for k in ("houses", "techniques", "forms", "abilities", "virtues", "flaws", "spells", "weapons", "armors")] == [12, 5, 10, 78, 318, 308, 360, 35, 10], counts
    assert len({s["key"] for s in out["spells"]}) == 360
    out["meta"]["counts"] = counts
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library", type=Path, default=LIBRARY)
    parser.add_argument("--check", action="store_true", help="验证现有输出与来源一致，不写入")
    args = parser.parse_args()
    data = build(args.library)
    contents = "// 本文件由 scripts/build-glossary.py 从定本中英文正文生成。\n// 来源章节、原文行号与输入 SHA-256 保存在数据内。\nwindow.ARS_GLOSSARY = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n"
    output = PROJECT / "glossary-data.js"
    if args.check:
        assert output.read_text() == contents, "词表与底本不同，请重新生成并审查。"
    else:
        output.write_text(contents)
    print(json.dumps(data["meta"]["counts"], ensure_ascii=False))


if __name__ == "__main__":
    main()
