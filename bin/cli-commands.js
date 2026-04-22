import fs from 'fs';
import path from 'path';
import { 
    findTranslationsFiles, 
    loadTranslationsData, 
    buildOutputDict, 
    parseObject, 
    resolveLeafValue 
} from './cli-utils.js';
import { extractKeys, syncKeysToTranslations } from './cli-extract.js';
import { translateWithAI } from './cli-ai.js';
import { syncTMS } from './cli-tms.js';
import { parseICU, extractVariables } from '../dist/icu.js';

const getComment = (val) => {
    if (typeof val !== 'string') return '';
    try {
        const vars = extractVariables(parseICU(val));
        if (vars.length > 0) return ` // Args: ${vars.join(', ')}`;
    } catch (e) {}
    return '';
};

const formatters = {
  json: (dict, lang) => JSON.stringify({ language: lang, translations: dict }, null, 4),
  py: (dict, lang) => {
    const sobriety = (s) => s.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const toPy = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `"${sobriety(obj)}"${getComment(obj)}`;
      let res = '{\n';
      for (const [k, v] of Object.entries(obj)) {
        res += `${space}    "${k}": ${toPy(v, indent + 4)},\n`;
      }
      return res + space + '}';
    };
    return `# i18nt generated for ${lang}\nTRANSLATIONS = ${toPy(dict)}`;
  },
  php: (dict, lang) => {
    const toPhp = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"${getComment(obj)}`;
      let res = '[\n';
      for (const [k, v] of Object.entries(obj)) {
        res += `${space}    "${k}" => ${toPhp(v, indent + 4)},\n`;
      }
      return res + space + ']';
    };
    return `<?php\n// i18nt generated for ${lang}\nreturn ${toPhp(dict)};`;
  },
  go: (dict, lang) => {
    const toCamel = (s) => s.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    const structs = new Set();
    const toGo = (obj, name = "Translations", indent = 0) => {
      const space = ' '.repeat(indent);
      const typeName = toCamel(name) + "Struct";
      if (typeof obj === 'string') return { type: 'string', value: `"${obj.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"${getComment(obj)}` };
      let structFields = `type ${typeName} struct {\n`;
      let instanceFields = `${typeName}{\n`;
      for (const [k, v] of Object.entries(obj)) {
        const fieldName = toCamel(k);
        const child = toGo(v, k, indent + 4);
        structFields += `    ${fieldName} ${child.type}\n`;
        instanceFields += `${space}    ${fieldName}: ${child.value},\n`;
      }
      structs.add(structFields + "}\n");
      return { type: typeName, value: instanceFields + space + "}" };
    };
    const root = toGo(dict, "Translations", 0);
    return `package i18n\n\n// i18nt generated for ${lang}\n\n${Array.from(structs).join("\n")}\nvar T = ${root.value}`;
  },
  rust: (dict, lang) => {
    const toRust = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      let res = '';
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'object') res += `${space}pub mod ${k.toLowerCase()} {\n${toRust(v, indent + 4)}${space}}\n`;
        else res += `${space}pub const ${k.toUpperCase()}: &str = "${v.replace(/"/g, '\\"').replace(/\n/g, '\\n')}";${getComment(v)}\n`;
      }
      return res;
    };
    return `// i18nt generated for ${lang}\npub mod translations {\n${toRust(dict, 4)}}`;
  },
  kt: (dict, lang) => {
    const toCamel = (s) => s.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    const toKt = (obj, name = "Translations", indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `${space}val ${name}: String = "${obj.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"${getComment(obj)}`;
      const className = toCamel(name);
      let res = `${space}object ${className} {\n`;
      for (const [k, v] of Object.entries(obj)) res += toKt(v, k, indent + 4) + "\n";
      return res + space + "}";
    };
    return `package i18n\n\n/** i18nt generated for ${lang} */\n${toKt(dict)}`;
  },
  java: (dict, lang) => {
    const toJava = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"${getComment(obj)}`;
      let res = 'new HashMap<String, Object>() {{\n';
      for (const [k, v] of Object.entries(obj)) res += `${space}    put("${k}", ${toJava(v, indent + 4)});\n`;
      return res + space + "}}";
    };
    return `package i18n;\n\nimport java.util.HashMap;\nimport java.util.Map;\n\n/** i18nt generated for ${lang} */\npublic class Translations {\n    public static final Map<String, Object> DATA = ${toJava(dict, 4)};\n}`;
  },
  cs: (dict, lang) => {
    const toCamel = (s) => s.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    const toCs = (obj, name = "Translations", indent = 0) => {
      const space = ' '.repeat(indent);
      const className = toCamel(name);
      if (typeof obj === 'string') return `${space}public const string ${className} = "${obj.replace(/"/g, '\\"').replace(/\n/g, '\\n')}";${getComment(obj)}`;
      let res = `${space}public static class ${className} {\n`;
      for (const [k, v] of Object.entries(obj)) res += toCs(v, k, indent + 4) + "\n";
      return res + space + "}";
    };
    return `namespace I18n {\n    /** i18nt generated for ${lang} */\n${toCs(dict, "T", 4)}\n}`;
  },
  cpp: (dict, lang) => {
    const toCpp = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      let res = '';
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'object') res += `${space}namespace ${k} {\n${toCpp(v, indent + 4)}${space}}\n`;
        else res += `${space}inline constexpr const char* ${k} = "${v.replace(/"/g, '\\"').replace(/\n/g, '\\n')}";${getComment(v)}\n`;
      }
      return res;
    };
    return `// i18nt generated for ${lang}\n#pragma once\n\nnamespace i18n {\n${toCpp(dict, 4)}}`;
  },
  rb: (dict, lang) => {
    const toRb = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"${getComment(obj)}`;
      let res = "{\n";
      for (const [k, v] of Object.entries(obj)) res += `${space}  :${k} => ${toRb(v, indent + 2)},\n`;
      return res + space.slice(0, -2) + "}";
    };
    return `# i18nt generated for ${lang}\nTRANSLATIONS = ${toRb(dict, 2)}`;
  },
  lua: (dict, lang) => {
    const toLua = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
      let res = "{\n";
      for (const [k, v] of Object.entries(obj)) res += `${space}  ${k} = ${toLua(v, indent + 2)},\n`;
      return res + space.slice(0, -2) + "}";
    };
    return `-- i18nt generated for ${lang}\nreturn ${toLua(dict, 2)}`;
  },
  c: (dict, lang) => {
    const flatten = (obj, prefix = '') => {
      let res = '';
      for (const [k, v] of Object.entries(obj)) {
        const key = (prefix ? `${prefix}_${k}` : k).toUpperCase();
        if (typeof v === 'object') res += flatten(v, key);
        else res += `#define I18N_${key} "${v.replace(/"/g, '\\"')}"\n`;
      }
      return res;
    };
    return `/* i18nt generated for ${lang} */\n#ifndef I18N_${lang.toUpperCase()}_H\n#define I18N_${lang.toUpperCase()}_H\n\n${flatten(dict)}\n\n#endif`;
  },
  scala: (dict, lang) => {
    const toCamel = (s) => s.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    const toScala = (obj, name = "Translations", indent = 0) => {
      const space = ' '.repeat(indent);
      const className = toCamel(name);
      if (typeof obj === 'string') return `${space}val ${name}: String = "${obj.replace(/"/g, '\\"')}"`;
      let res = `${space}object ${className} {\n`;
      for (const [k, v] of Object.entries(obj)) res += toScala(v, k, indent + 4) + "\n";
      return res + space + "}";
    };
    return `package i18n\n\n/** i18nt generated for ${lang} */\n${toScala(dict)}`;
  },
  js: (dict, lang) => `/** i18nt generated for ${lang} */\nwindow.I18N_DATA = ${JSON.stringify(dict, null, 2)};`,
  ex: (dict, lang) => {
    const toEx = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
      let res = "%{\n";
      for (const [k, v] of Object.entries(obj)) res += `${space}  "${k}" => ${toEx(v, indent + 2)},\n`;
      return res + space.slice(0, -2) + "}";
    };
    return `# i18nt generated for ${lang}\ndefmodule I18nData do\n  def translations, do: ${toEx(dict, 4)}\nend`;
  },
  pl: (dict, lang) => {
    const toPl = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
      let res = "{\n";
      for (const [k, v] of Object.entries(obj)) res += `${space}  '${k}' => ${toPl(v, indent + 2)},\n`;
      return res + space.slice(0, -2) + "}";
    };
    return `# i18nt generated for ${lang}\nour %TRANSLATIONS = %{ ${toPl(dict, 2)} };\n1;`;
  },
  m: (dict, lang) => {
    const toObjc = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `@"${obj.replace(/"/g, '\\"')}"`;
      let res = "@{\n";
      for (const [k, v] of Object.entries(obj)) res += `${space}  @"${k}": ${toObjc(v, indent + 2)},\n`;
      return res + space.slice(0, -2) + "}";
    };
    return `/* i18nt generated for ${lang} */\n#import <Foundation/Foundation.h>\n\nNSDictionary *get_translations() {\n  return ${toObjc(dict, 2)};\n}`;
  },
  hs: (dict, lang) => {
    const toHs = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
      let res = "fromList [\n";
      const entries = Object.entries(obj).map(([k, v]) => `${space}  ("${k}", ${toHs(v, indent + 2)})`);
      return res + entries.join(",\n") + "\n" + space.slice(0, -2) + "]";
    };
    return `-- i18nt generated for ${lang}\nmodule I18nData where\nimport Data.Map (fromList, Map)\ntranslations :: Map String Any\ntranslations = ${toHs(dict, 2)}`;
  },
  xml: (dict, lang) => {
    const escapeXml = (v) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, "\\'").replace(/"/g, '\\"');
    
    const toXml = (obj, prefix = '') => {
      let res = '';
      for (const [k, v] of Object.entries(obj)) {
        const name = prefix ? `${prefix}_${k}` : k;
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            res += toXml(v, name);
        } else if (typeof v === 'string') {
            // 检测 ICU Plural: {count, plural, one{...} other{...}}
            const pluralMatch = v.match(/\{(\w+),\s*plural,\s*([\s\S]+)\}/);
            if (pluralMatch) {
                const varName = pluralMatch[1];
                const rules = pluralMatch[2];
                res += `    <plurals name="${name}">\n`;
                // 解析内部规则 (one{...} other{...})
                const ruleRegex = /(\w+)\s*\{([\s\S]*?)\}/g;
                let rm;
                while ((rm = ruleRegex.exec(rules)) !== null) {
                    const quantity = rm[1];
                    const content = rm[2].replace('#', `%d`); // Android 使用 %d 替换 #
                    res += `        <item quantity="${quantity}">${escapeXml(content)}</item>\n`;
                }
                res += `    </plurals>\n`;
            } else {
                res += `    <string name="${name}">${escapeXml(v)}</string>\n`;
            }
        }
      }
      return res;
    };
    return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${toXml(dict)}</resources>`;
  },
  strings: (dict, lang) => {
    const toStrings = (obj, prefix = '') => {
      let res = '';
      for (const [k, v] of Object.entries(obj)) {
        const name = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            res += toStrings(v, name);
        } else {
            const escaped = String(v).replace(/"/g, '\\"').replace(/\n/g, '\\n');
            res += `"${name}" = "${escaped}";\n`;
        }
      }
      return res;
    };
    return `/* i18nt generated for ${lang} */\n${toStrings(dict)}`;
  },
  po: (dict, lang) => {
    const timestamp = new Date().toISOString();
    let res = `# i18nt generated for ${lang} at ${timestamp}\n`;
    res += `msgid ""\nmsgstr ""\n`;
    res += `"Project-Id-Version: i18nt\\n"\n`;
    res += `"POT-Creation-Date: ${timestamp}\\n"\n`;
    res += `"PO-Revision-Date: ${timestamp}\\n"\n`;
    res += `"Language: ${lang}\\n"\n`;
    res += `"MIME-Version: 1.0\\n"\n`;
    res += `"Content-Type: text/plain; charset=UTF-8\\n"\n`;
    res += `"Content-Transfer-Encoding: 8bit\\n"\n`;
    res += `"X-Generator: i18nt\\n"\n\n`;
    
    const flatten = (obj, prefix = '') => {
      let out = '';
      for (const [k, v] of Object.entries(obj)) {
        const name = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) out += flatten(v, name);
        else out += `msgid "${name}"\nmsgstr "${String(v).replace(/"/g, '\\"')}"\n\n`;
      }
      return out;
    };
    return res + flatten(dict);
  },
  xliff: (dict, lang, options = {}) => {
    const mainLang = options.mainLang || 'en';
    const sourceDict = options.sourceDict || {};
    let res = `<?xml version="1.0" encoding="UTF-8"?>\n<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n`;
    res += `  <file source-language="${mainLang}" target-language="${lang}" datatype="plaintext" original="translations" date="${new Date().toISOString()}" product-name="i18nt">\n    <body>\n`;
    const toXliff = (obj, prefix = '') => {
      let units = '';
      for (const [k, v] of Object.entries(obj)) {
        const name = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            units += toXliff(v, name);
        } else {
            const keys = name.split('.');
            let sourceVal = sourceDict;
            for (const p of keys) sourceVal = sourceVal?.[p];
            const sourceText = (sourceVal !== undefined ? String(sourceVal) : name)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const targetText = String(v)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            units += `      <trans-unit id="${name}" resname="${name}">\n        <source>${sourceText}</source>\n        <target>${targetText}</target>\n      </trans-unit>\n`;
        }
      }
      return units;
    };
    res += toXliff(dict);
    res += `    </body>\n  </file>\n</xliff>`;
    return res;
  },
  arb: (dict, lang) => {
    const res = { "@@locale": lang };
    const flatten = (obj, prefix = '') => {
        for (const [k, v] of Object.entries(obj)) {
            const name = prefix ? `${prefix}_${k}` : k;
            if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                flatten(v, name);
            } else {
                res[name] = v;
                try {
                    const vars = extractVariables(parseICU(v));
                    if (vars.length > 0) {
                        res[`@${name}`] = {
                            placeholders: vars.reduce((acc, cur) => {
                                acc[cur] = { type: "Object" };
                                return acc;
                            }, {})
                        };
                    }
                } catch (e) {}
            }
        }
    };
    flatten(dict);
    return JSON.stringify(res, null, 2);
  },
  ast: (dict, lang, options = {}, i18n) => {
    // 由于 i18n 实例开启了 preParse，addTranslations 会自动对 dict 调用 preCompile (in-place)
    i18n.addTranslations(dict, lang);
    return JSON.stringify({ language: lang, translations: dict }, null, 4);
  }
};

export function exportLanguages(inputPath, outputDir, langFilter, silent = false, format = 'json', i18n, options = {}) {
  const ct = i18n.t.cli;
  const data = loadTranslationsData(inputPath);
  if (!data) {
    if (!silent) console.error(ct.errors.no_file);
    return null;
  }

  const { allTranslations, globalMainLang, globalLangSet } = data;
  if (Object.keys(allTranslations).length === 0) {
      if (!silent) console.error(ct.errors('no_translations'));
      return null;
  }

  const globalLangOrder = Array.from(globalLangSet);
  let targetLangs = langFilter === 'all' ? [...globalLangOrder] 
    : (typeof langFilter === 'string' && langFilter.includes(',') ? langFilter.split(',').map(s => s.trim()).filter(Boolean)
    : (langFilter && langFilter !== true ? [langFilter] : [globalMainLang]));

  if (!silent) {
    console.log(ct.info('dict_order', { langs: globalLangOrder.join(', ') }));
    console.log(ct.info('export_lang', { langs: targetLangs.join(', ') }));
  }

  const resolvedOutputDir = outputDir ? path.resolve(outputDir) : path.resolve(process.cwd(), '.i18nt/locales');
  if (!fs.existsSync(resolvedOutputDir)) fs.mkdirSync(resolvedOutputDir, { recursive: true });
  
  // 预先构建主语言字典（用于 XLIFF 等格式）
  const sourceDict = {};
  for (const [moduleName, moduleData] of Object.entries(allTranslations)) {
      const moduleDict = buildOutputDict(moduleData.entries, globalMainLang, moduleData.langOrder, moduleData.mainLang);
      if (Object.keys(moduleDict).length > 0) {
          if (Object.keys(allTranslations).length === 1 && (moduleName === 'translations' || moduleName === 'index')) {
              Object.assign(sourceDict, moduleDict);
          } else {
              const parts = moduleName.split('.');
              let current = sourceDict;
              for (let i = 0; i < parts.length - 1; i++) {
                  const p = parts[i];
                  if (!current[p]) current[p] = {};
                  current = current[p];
              }
              current[parts[parts.length - 1]] = moduleDict;
          }
      }
  }

  for (const lang of targetLangs) {
    const fullDict = {};
    for (const [moduleName, moduleData] of Object.entries(allTranslations)) {
        const moduleDict = buildOutputDict(moduleData.entries, lang, moduleData.langOrder, moduleData.mainLang);
        if (Object.keys(moduleDict).length > 0) {
            if (Object.keys(allTranslations).length === 1 && (moduleName === 'translations' || moduleName === 'index')) {
                Object.assign(fullDict, moduleDict);
            } else {
                const parts = moduleName.split('.');
                let current = fullDict;
                for (let i = 0; i < parts.length - 1; i++) {
                    const p = parts[i];
                    if (!current[p]) current[p] = {};
                    current = current[p];
                }
                current[parts[parts.length - 1]] = moduleDict;
            }
        }
    }

    const platform = options.platform;
    let currentFormat = format;
    if (platform === 'android') currentFormat = 'xml';
    else if (platform === 'ios') currentFormat = 'strings';
    else if (platform === 'flutter') currentFormat = 'arb';

    const formatter = formatters[currentFormat] || formatters.json;
    const output = formatter(fullDict, lang, { mainLang: globalMainLang, sourceDict }, i18n);
    
    let ext = ['json', 'strings', 'xml', 'xliff', 'xlf', 'po', 'arb'].includes(currentFormat) ? currentFormat : currentFormat;
    let fileName = `${lang}.${ext}`;
    let subDir = '';

    if (platform === 'android') {
        subDir = `values-${lang}`;
        fileName = `strings.xml`;
    } else if (platform === 'ios') {
        subDir = `${lang}.lproj`;
        fileName = `Localizable.strings`;
    }

    const targetDir = subDir ? path.join(resolvedOutputDir, subDir) : resolvedOutputDir;
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    fs.writeFileSync(path.join(targetDir, fileName), output, 'utf8');
    if (!silent) console.log(ct.info('exported', { file: path.join(subDir, fileName), count: Object.keys(fullDict).length }));
  }
  return true;
}

export function importLang(inputPath, jsonPath, i18n) {
  const ct = i18n.t.cli;
  const translationsFiles = findTranslationsFiles(inputPath);
  if (!translationsFiles) { console.error(ct.errors('no_file')); process.exit(1); }
  if (!jsonPath) { console.error(ct.errors('no_json_param')); process.exit(1); }

  const absoluteJsonPath = path.resolve(jsonPath);
  if (!fs.existsSync(absoluteJsonPath)) { console.error(ct.errors('path_not_exist', { path: absoluteJsonPath })); process.exit(1); }

  const stats = fs.statSync(absoluteJsonPath);
  const extensions = ['.json', '.xlf', '.xliff', '.po'];
  const files = stats.isDirectory() ? fs.readdirSync(absoluteJsonPath).filter(f => extensions.includes(path.extname(f))) : [path.basename(jsonPath)];
  const dir = stats.isDirectory() ? absoluteJsonPath : path.dirname(absoluteJsonPath);

  const parsePo = (content) => {
    const trans = {};
    const entries = content.split(/\n\s*\n/);
    for (const entry of entries) {
      const msgid = entry.match(/^msgid\s+"(.*)"$/m)?.[1];
      const msgstr = entry.match(/^msgstr\s+"(.*)"$/m)?.[1];
      if (msgid && msgstr) trans[msgid] = msgstr.replace(/\\"/g, '"');
    }
    return trans;
  };

  const parseXliff = (content) => {
    const trans = {};
    const unitRegex = /<trans-unit id="(.*?)">[\s\S]*?<target>(.*?)<\/target>/g;
    let m;
    while ((m = unitRegex.exec(content)) !== null) trans[m[1]] = m[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    return trans;
  };

  for (const file of files) {
      const ext = path.extname(file);
      const content = fs.readFileSync(path.join(dir, file), 'utf8');
      let targetLang = path.basename(file, ext);
      let translations = {};

      if (ext === '.json') {
          try {
              const json = JSON.parse(content);
              targetLang = json.language || targetLang;
              translations = json.translations || json;
          } catch (e) { console.error(`Error parsing ${file}: ${e.message}`); continue; }
      } else if (ext === '.po') {
          translations = parsePo(content);
      } else if (ext === '.xlf' || ext === '.xliff') {
          translations = parseXliff(content);
          const langMatch = content.match(/target-language="(.*?)"/);
          if (langMatch) targetLang = langMatch[1];
      }

      for (const { fullPath: translationsFile, moduleName } of translationsFiles) {
          let moduleTranslations = translations;
          if (moduleName !== 'translations' && moduleName !== 'index') {
              if (ext === '.json') {
                  for (const p of moduleName.split('.')) moduleTranslations = moduleTranslations?.[p];
              } else {
                  const subset = {};
                  const prefix = `${moduleName}.`;
                  for (const [k, v] of Object.entries(translations)) {
                      if (k.startsWith(prefix)) subset[k.slice(prefix.length)] = v;
                      else if (k === moduleName) subset[k] = v;
                  }
                  if (Object.keys(subset).length > 0) moduleTranslations = subset;
                  else moduleTranslations = null;
              }
          }
          if (moduleTranslations) {
              const result = syncSingleJsonFromObj(translationsFile, { language: targetLang, translations: moduleTranslations }, i18n);
              if (result) console.log(ct.info('sync_done', { lang: result.lang, updated: result.updatedCount, added: result.addedCount }));
          }
      }
  }
}

function syncSingleJsonFromObj(filePath, jsonContent, i18n) {
  const ct = i18n.t.cli;
  const targetLang = jsonContent.language;
  const newTranslations = jsonContent.translations;
  const ext = path.extname(filePath);

  const flatten = (obj, prefix = '') => {
    let res = {};
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !obj[key].hasOwnProperty('one') && !obj[key].hasOwnProperty('other')) Object.assign(res, flatten(obj[key], fullKey));
      else res[fullKey] = obj[key];
    }
    return res;
  };

  if (ext === '.json') {
      let json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      let fileLang = json.language || path.basename(filePath, '.json');
      if (fileLang !== targetLang) return null;

      let trans = json.translations || json;
      let updatedCount = 0;
      const flat = flatten(newTranslations);
      for (const [k, v] of Object.entries(flat)) {
          const parts = k.split('.');
          let curr = trans;
          for (let i = 0; i < parts.length - 1; i++) {
              if (!curr[parts[i]]) curr[parts[i]] = {};
              curr = curr[parts[i]];
          }
          curr[parts[parts.length - 1]] = v;
          updatedCount++;
      }
      fs.writeFileSync(filePath, JSON.stringify(json, null, 4), 'utf8');
      return { updatedCount, lang: targetLang, addedCount: 0 };
  }

  let tsContent = fs.readFileSync(filePath, 'utf8');
  const langOrderMatch = tsContent.match(/(?:export\s+)?const\s+LANG_ORDER\s*=\s*\[(.*?)\]/);
  if (!langOrderMatch) return null;
  const langOrder = langOrderMatch[1].split(',').map(s => s.trim().replace(/['"`]/g, '')).filter(Boolean);
  const langIndex = langOrder.indexOf(targetLang);
  if (langIndex === -1) return null;

  const flatTranslations = flatten(newTranslations);
  let updatedCount = 0;

  for (const [pathKey, val] of Object.entries(flatTranslations)) {
      const key = pathKey.split('.').pop();
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const keyRegex = new RegExp(`(${escapedKey}:\\s*\\[\\s*)([\\s\\S]*?)(\\s*\\],?)`, 'm');
      const match = tsContent.match(keyRegex);
      if (match) {
          const itemsStr = match[2];
          const rawMatches = [];
          const itemRegex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})/g;
          let im;
          while ((im = itemRegex.exec(itemsStr)) !== null) rawMatches.push({ matchStr: im[0], start: im.index, end: im.index + im[0].length });
          if (rawMatches[langIndex]) {
              const newValue = typeof val === 'object' ? JSON.stringify(val).replace(/"/g, "'") : `'${val.replace(/'/g, "\\'")}'`;
              tsContent = tsContent.replace(match[0], `${match[1]}${itemsStr.substring(0, rawMatches[langIndex].start)}${newValue}${itemsStr.substring(rawMatches[langIndex].end)}${match[3]}`);
              updatedCount++;
          }
      }
  }
  fs.writeFileSync(filePath, tsContent, 'utf8');
  return { updatedCount, lang: targetLang, addedCount: 0 };
}

export function startWatch(inputPath, outputDir, lang, format, i18n) {
  const ct = i18n.t.cli;
  const translationsFiles = findTranslationsFiles(inputPath);
  if (!translationsFiles) { console.error(ct.errors.no_file_watch); process.exit(1); }
  console.log(ct.info('watching', { path: inputPath || 'default paths' }));
  let debounceTimer;
  const doSync = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(ct.info('change_detected', { time: new Date().toLocaleTimeString() }));
      exportLanguages(inputPath, outputDir, lang, true, format, i18n);
    }, 100);
  };
  for (const { fullPath: absPath } of translationsFiles) {
    fs.watch(path.dirname(absPath), (eventType, filename) => { if (filename === path.basename(absPath)) doSync(); });
    fs.watchFile(absPath, { interval: 1007 }, (curr, prev) => { if (curr.mtime !== prev.mtime) doSync(); });
  }
}

export function checkTranslations(inputPath, i18n) {
  const ct = i18n.t.cli;
  const data = loadTranslationsData(inputPath);
  if (!data) {
      console.error(ct.errors('no_file'));
      return false;
  }

  const globalPathMap = new Map();
  let hasError = false;

  for (const [moduleName, moduleData] of Object.entries(data.allTranslations)) {
      console.log(`\n🔍 ${ct.info('checking', { file: moduleName })}`);

      const isRootModule = moduleName === 'translations' || moduleName === 'index';
      const modulePrefix = isRootModule ? '' : moduleName;

      const langOrder = moduleData.langOrder.length > 0 ? moduleData.langOrder : data.globalLangOrder;
      if (langOrder.length === 0) {
          console.warn(`  ⚠️  ${ct.errors('no_lang_order')}`);
          hasError = true;
      }

      // 检测非标准格式：如果顶级 Key 包含常见的语言代码，且它们被定义为 namespace
      const commonLangs = ['en', 'zh', 'zh-CN', 'en-US', 'ja', 'ko', 'fr', 'de', 'es'];
      const topLevelKeys = moduleData.entries.map(e => e.key);
      const suspectedLangs = topLevelKeys.filter(k => commonLangs.includes(k));
      if (suspectedLangs.length > 0) {
          const firstSuspect = moduleData.entries.find(e => e.key === suspectedLangs[0]);
          if (firstSuspect && firstSuspect.type === 'namespace') {
              console.error(`  ❌ ${ct.errors('non_standard_format')}`);
              hasError = true;
          }
      }

      // 标记模块路径的所有父级为 namespace
      if (!isRootModule) {
          const parts = moduleName.split('.');
          let curr = '';
          for (let i = 0; i < parts.length; i++) {
              curr = curr ? `${curr}.${parts[i]}` : parts[i];
              if (globalPathMap.has(curr) && globalPathMap.get(curr) !== 'namespace') {
                  console.error(`  ❌ ${ct.errors('conflict_path', { path: curr })}`);
                  hasError = true;
              }
              globalPathMap.set(curr, 'namespace');
          }
      }

      const validateEntries = (entries, prefix = '') => {
          for (const entry of entries) {
              const currentPath = prefix ? `${prefix}.${entry.key}` : entry.key;
              const type = entry.type === 'namespace' ? 'namespace' : 'leaf';
              
              if (globalPathMap.has(currentPath) && globalPathMap.get(currentPath) !== type) {
                  console.error(`  ❌ ${ct.errors('conflict_path', { path: currentPath })}`);
                  hasError = true;
              }
              globalPathMap.set(currentPath, type);

              if (entry.isDuplicate) {
                  console.error(`  ❌ ${ct.errors('duplicate_key', { path: prefix || 'root', key: entry.key })}`);
                  hasError = true;
              }

              if (entry.type === 'namespace') {
                  validateEntries(entry.children, currentPath);
              } else if (entry.type === 'leaf') {
                  const currentLangOrder = moduleData.langOrder.length > 0 ? moduleData.langOrder : data.globalLangOrder;
                  if (entry.values) {
                      // JSON check
                      const missing = currentLangOrder.filter(l => !entry.values[l]);
                      if (missing.length > 0) console.warn(`  ⚠️  [${currentPath}] ${ct.info('missing_tags', { langs: missing.join(', ') })}`);
                  } else if (entry.valueStr.trim().startsWith('[')) {
                      // TS check
                      const inner = entry.valueStr.trim().slice(1, -1);
                      const items = [];
                      const itemRegex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})/g;
                      let im;
                      while ((im = itemRegex.exec(inner)) !== null) {
                        items.push(im[1] ? im[1].slice(1, -1) : im[2]);
                      }

                      const foundLangs = new Set();
                      items.forEach((item, idx) => {
                          const match = typeof item === 'string' ? item.match(/^([a-zA-Z0-9-]+):\s*/) : null;
                          if (match && currentLangOrder.includes(match[1])) foundLangs.add(match[1]);
                      });

                      const allNoTags = items.every(item => !(typeof item === 'string' && item.match(/^([a-zA-Z0-9-]+):\s*/)));
                      if (!(allNoTags && items.length === currentLangOrder.length)) {
                          const missing = currentLangOrder.filter(l => !foundLangs.has(l));
                          if (missing.length > 0) console.warn(`  ⚠️  [${currentPath}] ${ct.info('missing_tags', { langs: missing.join(', ') })}`);
                      }
                  }
              }
          }
      };

      validateEntries(moduleData.entries, modulePrefix);
      if (!hasError) console.log(`  ✅ ${ct.info('check_ok')}`);
  }

  return !hasError;
}

export function fixTranslations(inputPath, i18n) {
  const ct = i18n.t.cli;
  const data = loadTranslationsData(inputPath);
  if (!data) {
      console.error(ct.errors('no_file'));
      return false;
  }

  const globalPathMap = new Map();
  for (const [mName, mData] of Object.entries(data.allTranslations)) {
      const prefix = (mName === 'translations' || mName === 'index') ? '' : mName;
      const walk = (entries, p = '') => {
          for (const e of entries) {
              const full = p ? `${p}.${e.key}` : e.key;
              const type = e.type === 'namespace' ? 'namespace' : 'leaf';
              if (!globalPathMap.has(full)) globalPathMap.set(full, { type, files: new Set(Array.isArray(e.sourceFile) ? e.sourceFile : [e.sourceFile]) });
              else {
                  const s = globalPathMap.get(full);
                  if (Array.isArray(e.sourceFile)) e.sourceFile.forEach(f => s.files.add(f));
                  else s.files.add(e.sourceFile);
                  if (s.type !== type) s.hasConflict = true;
              }
              if (e.type === 'namespace') walk(e.children, full);
          }
      };
      walk(mData.entries, prefix);
  }

  for (const [moduleName, moduleData] of Object.entries(data.allTranslations)) {
    console.log(`\n🔧 ${ct.info('fixing', { file: moduleName })}`);
    const langOrder = moduleData.langOrder.length > 0 ? moduleData.langOrder : data.globalLangOrder;
    const mainLang = moduleData.mainLang || data.globalMainLang;
    let fixedCount = 0;

    const doFixEntries = (entries, prefix = '') => {
      for (const entry of entries) {
        const fullPath = prefix ? `${prefix}.${entry.key}` : entry.key;
        
        // 冲突修复：如果当前是 leaf 但全局有 namespace 冲突
        if (entry.type === 'leaf' && globalPathMap.get(fullPath)?.hasConflict) {
            entry.key = `${entry.key}_val`;
            console.warn(`  ⚠️  ${ct.info('conflict_fix', { old: entry.key, new: entry.key, path: fullPath })}`);
            fixedCount++;
        }

        if (entry.type === 'namespace') doFixEntries(entry.children, fullPath);
        else if (entry.type === 'leaf') {
            if (entry.values) {
                // JSON Fix: ensure all languages have the key
                for (const l of langOrder) {
                    if (!entry.values[l]) {
                        entry.values[l] = entry.values[mainLang] || "''";
                        fixedCount++;
                    }
                }
            } else if (entry.valueStr.trim().startsWith('[')) {
                // TS Fix logic... (skipped for brevity as it requires complex string manipulation)
                // We'll focus on JSON for now as requested.
            }
        }
      }
    };

    doFixEntries(moduleData.entries);

    if (fixedCount > 0 || true) { // Always sort
        const targetFiles = Array.isArray(moduleData.path) ? moduleData.path : [moduleData.path];
        for (const f of targetFiles) {
            const ext = path.extname(f);
            if (ext === '.json') {
                let json = JSON.parse(fs.readFileSync(f, 'utf8'));
                let lang = json.language || path.basename(f, '.json');
                let newDict = buildOutputDict(moduleData.entries, lang, langOrder, mainLang);
                if (json.translations) json.translations = newDict;
                else json = newDict;
                fs.writeFileSync(f, JSON.stringify(json, null, 4), 'utf8');
            } else {
                // TS Sort & Fix (placeholder)
            }
        }
        console.log(`  ✅ ${ct.info('sorted')}`);
    }
  }
  return true;
}

export async function doTranslate(inputPath, i18n) {
  const ct = i18n.t.cli;
  const data = loadTranslationsData(inputPath);
  if (!data) {
      console.error(ct.errors('no_file'));
      return;
  }

  const { allTranslations, globalMainLang, globalLangOrder } = data;
  for (const [moduleName, moduleData] of Object.entries(allTranslations)) {
    console.log(`\n🤖 ${ct.info('checking', { file: moduleName })}...`);
    const langOrder = moduleData.langOrder.length > 0 ? moduleData.langOrder : globalLangOrder;
    const mainLang = moduleData.mainLang || globalMainLang;
    
    const missingMap = {};
    const collectMissing = (entries, path = '') => {
      for (const entry of entries) {
        const currentPath = path ? `${path}.${entry.key}` : entry.key;
        if (entry.type === 'namespace') collectMissing(entry.children, currentPath);
        else if (entry.type === 'leaf') {
            if (entry.values) {
                // JSON-based source
                const mainValue = entry.values[mainLang];
                if (mainValue) {
                    langOrder.forEach(l => {
                        if (!entry.values[l] && l !== mainLang) {
                            if (!missingMap[l]) missingMap[l] = {};
                            missingMap[l][currentPath] = mainValue.startsWith("'") ? mainValue.slice(1, -1) : mainValue;
                        }
                    });
                }
            } else if (entry.valueStr.trim().startsWith('[')) {
                // TS-based source
                const inner = entry.valueStr.trim().slice(1, -1);
                const items = [];
                const itemRegex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})/g;
                let im;
                while ((im = itemRegex.exec(inner)) !== null) items.push(im[1] || im[2]);
                const foundLangs = new Set();
                let mainValue = '';
                items.forEach((item, idx) => {
                    const m = item.match(/^(['"`])([a-zA-Z0-9-]+):\s*(.*)\1$/);
                    if (m && langOrder.includes(m[2])) { foundLangs.add(m[2]); if (m[2] === mainLang) mainValue = m[3]; }
                    else if (langOrder[idx] === mainLang) mainValue = item.replace(/['"`]/g, '');
                });
                langOrder.filter(l => !foundLangs.has(l) && l !== mainLang).forEach(l => { if (!missingMap[l]) missingMap[l] = {}; missingMap[l][currentPath] = mainValue; });
            }
        }
      }
    };
    collectMissing(moduleData.entries);

    let hasMissing = false;
    const isZh = i18n.locale === 'zh-CN';

    for (const lang in missingMap) {
        const count = Object.keys(missingMap[lang]).length;
        if (count > 0) {
            hasMissing = true;
            console.log(`  🤖 ${ct.info('ai_translating', { count })} [${lang}]...`);
            const translated = await translateWithAI(missingMap[lang], [lang], mainLang);
            if (translated[lang]) {
                let updatedCount = 0;
                for (const [keyPath, value] of Object.entries(translated[lang])) {
                    // Sync back to the correct file
                    const targetFiles = Array.isArray(moduleData.path) ? moduleData.path : [moduleData.path];
                    for (const f of targetFiles) {
                        syncSingleJsonFromObj(f, { language: lang, translations: { [keyPath]: value } }, i18n);
                    }
                    updatedCount++;
                }
                console.log(`  ✅ ${ct.info('ai_done')} [${lang}]: ${updatedCount} ${isZh ? '个项' : 'items'}`);
            }
        }
    }

    if (!hasMissing) {
        console.log(`  ✅ ${ct.info('no_fix_needed')}`);
    }
  }
}

export function doExtractKeys(inputPath, i18n) {
    const ct = i18n.t.cli;
    const scanDir = inputPath || 'src';
    console.log(ct.info('extract_start', { path: scanDir }));
    const keys = extractKeys(scanDir);
    const transFiles = findTranslationsFiles(inputPath);
    if (transFiles) for (const f of transFiles) {
        const result = syncKeysToTranslations(f.fullPath, keys);
        if (result.added > 0) console.log(ct.info('extract_sync', { file: f.moduleName, count: result.added }));
    }
}

export async function doPruneTranslations(inputPath, i18n) {
    const ct = i18n.t.cli;
    const scanDir = inputPath || 'src';
    console.log(ct.info('prune_start', { path: scanDir }));

    const extractedMap = extractKeys(scanDir);
    const usedKeys = new Set(Object.keys(extractedMap));
    
    const data = loadTranslationsData(inputPath);
    if (!data) {
        console.error(ct.errors('no_file'));
        return;
    }

    for (const [moduleName, moduleData] of Object.entries(data.allTranslations)) {
        console.log(`\n🧹 ${ct.info('pruning', { file: moduleName })}`);
        
        let prunedCount = 0;
        const pruneEntries = (list, prefix = '') => {
            for (let i = list.length - 1; i >= 0; i--) {
                const entry = list[i];
                const fullKey = prefix ? `${prefix}.${entry.key}` : entry.key;
                const absoluteKey = (moduleName === 'translations' || moduleName === 'index') ? fullKey : `${moduleName}.${fullKey}`;

                const isUsed = usedKeys.has(absoluteKey) || 
                               Array.from(usedKeys).some(k => k.startsWith(`${absoluteKey}.`));

                if (!isUsed) {
                    list.splice(i, 1);
                    prunedCount++;
                } else if (entry.type === 'namespace') {
                    pruneEntries(entry.children, fullKey);
                    if (entry.children.length === 0) {
                        list.splice(i, 1);
                        prunedCount++;
                    }
                }
            }
        };

        pruneEntries(moduleData.entries);

        if (prunedCount > 0) {
            const targetFiles = Array.isArray(moduleData.path) ? moduleData.path : [moduleData.path];
            for (const f of targetFiles) {
                const ext = path.extname(f);
                if (ext === '.json') {
                    let json = JSON.parse(fs.readFileSync(f, 'utf8'));
                    let lang = json.language || path.basename(f, '.json');
                    let newDict = buildOutputDict(moduleData.entries, lang, moduleData.langOrder, moduleData.mainLang);
                    if (json.translations) json.translations = newDict;
                    else json = newDict;
                    fs.writeFileSync(f, JSON.stringify(json, null, 4), 'utf8');
                } else {
                    // TS Logic (placeholder)
                }
            }
            console.log(`  ✅ ${ct.info('prune_done', { count: prunedCount })}`);
        } else {
            console.log(`  ✅ ${ct.info('prune_nothing')}`);
        }
    }
}

export async function doTMSSync(inputPath, options, i18n) {
    const ct = i18n.t.cli;
    const provider = options.provider || process.env.I18NT_TMS_PROVIDER || 'lokalise';
    console.log(ct.info('tms_sync_start', { provider }));
    
    const data = loadTranslationsData(inputPath);
    if (!data) {
        console.error(ct.errors('no_file'));
        return;
    }

    await syncTMS(data.allTranslations, provider, options, i18n);
}

export async function doInit(i18n) {
    const ct = i18n.t.cli;
    console.log(ct.info('init_start'));

    try {
        const configPath = path.resolve(process.cwd(), '.i18ntrc');
        const defaultInput = 'src/i18n/index.ts';
        const defaultOutput = '.i18nt/locales';

        const config = {
            input: defaultInput,
            output: defaultOutput
        };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

        const i18nDir = path.resolve(process.cwd(), 'src/i18n');
        if (!fs.existsSync(i18nDir)) fs.mkdirSync(i18nDir, { recursive: true });

        const indexPath = path.join(i18nDir, 'index.ts');
        if (!fs.existsSync(indexPath)) {
            const template = `import { createI18n } from '@xiaode-ai/i18nt';

export const LANG_ORDER = ['zh-CN', 'en-US'] as const;
export const MAIN_LANG = 'zh-CN';

export const TRANSLATIONS = {
    "welcome": ["欢迎使用 OneFile", "Welcome to OneFile"],
    "settings": ["设置", "Settings"]
} as const;

export const i18n = createI18n({
    translations: TRANSLATIONS,
    langOrder: LANG_ORDER,
    locale: 'zh-CN',
});

export const { t } = i18n;
export default i18n;
`;
            fs.writeFileSync(indexPath, template, 'utf8');
            console.log(ct.info('init_success', { files: '.i18ntrc, src/i18n/index.ts' }));
        } else {
            console.log(ct.info('init_success', { files: '.i18ntrc' }));
        }
    } catch (e) {
        console.error(ct.info('init_fail', { message: e.message }));
    }
}
