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

const formatters = {
  json: (dict, lang) => JSON.stringify({ language: lang, translations: dict }, null, 4),
  py: (dict, lang) => {
    const toPy = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
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
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
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
      if (typeof obj === 'string') return { type: 'string', value: `"${obj.replace(/"/g, '\\"')}"` };
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
        else res += `${space}pub const ${k.toUpperCase()}: &str = "${v.replace(/"/g, '\\"')}";\n`;
      }
      return res;
    };
    return `// i18nt generated for ${lang}\npub mod translations {\n${toRust(dict, 4)}}`;
  },
  kt: (dict, lang) => {
    const toCamel = (s) => s.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    const toKt = (obj, name = "Translations", indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `${space}val ${name}: String = "${obj.replace(/"/g, '\\"')}"`;
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
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
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
      if (typeof obj === 'string') return `${space}public const string ${className} = "${obj.replace(/"/g, '\\"')}";`;
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
        else res += `${space}inline constexpr const char* ${k} = "${v.replace(/"/g, '\\"')}";\n`;
      }
      return res;
    };
    return `// i18nt generated for ${lang}\n#pragma once\n\nnamespace i18n {\n${toCpp(dict, 4)}}`;
  },
  rb: (dict, lang) => {
    const toRb = (obj, indent = 0) => {
      const space = ' '.repeat(indent);
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
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
    const toXml = (obj, prefix = '') => {
      let res = '';
      for (const [k, v] of Object.entries(obj)) {
        const name = prefix ? `${prefix}_${k}` : k;
        if (typeof v === 'object') res += toXml(v, name);
        else {
            const escaped = v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, "\\'").replace(/"/g, '\\"');
            res += `    <string name="${name}">${escaped}</string>\n`;
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
        if (typeof v === 'object') res += toStrings(v, name);
        else res += `"${name}" = "${v.replace(/"/g, '\\"')}";\n`;
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
  ast: (dict, lang, options = {}, i18n) => {
    // 由于 i18n 实例开启了 preParse，addTranslations 会自动对 dict 调用 preCompile (in-place)
    i18n.addTranslations(dict, lang);
    return JSON.stringify({ language: lang, translations: dict }, null, 4);
  }
};

export function exportLanguages(inputPath, outputDir, langFilter, silent = false, format = 'json', i18n) {
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
    const formatter = formatters[format] || formatters.json;
    const output = formatter(fullDict, lang, { mainLang: globalMainLang, sourceDict }, i18n);
    const ext = ['json', 'strings', 'xml', 'xliff', 'xlf', 'po'].includes(format) ? format : format;
    fs.writeFileSync(path.join(resolvedOutputDir, `${lang}.${ext}`), output, 'utf8');
    if (!silent) console.log(ct.info('exported', { file: `${lang}.${ext}`, count: Object.keys(fullDict).length }));
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

function syncSingleJsonFromObj(tsFilePath, jsonContent, i18n) {
  const ct = i18n.t.cli;
  const targetLang = jsonContent.language;
  const newTranslations = jsonContent.translations;
  let tsContent = fs.readFileSync(tsFilePath, 'utf8');
  const langOrderMatch = tsContent.match(/(?:export\s+)?const\s+LANG_ORDER\s*=\s*\[(.*?)\]/);
  if (!langOrderMatch) return null;
  const langOrder = langOrderMatch[1].split(',').map(s => s.trim().replace(/['"`]/g, '')).filter(Boolean);
  const langIndex = langOrder.indexOf(targetLang);
  if (langIndex === -1) return null;

  const flatten = (obj, prefix = '') => {
    let res = {};
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !('one' in obj[key]) && !('other' in obj[key])) Object.assign(res, flatten(obj[key], fullKey));
      else res[fullKey] = obj[key];
    }
    return res;
  };
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
          const itemRegex = /(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})|(['"`])([\s\S]*?)\2/g;
          let im;
          while ((im = itemRegex.exec(itemsStr)) !== null) rawMatches.push({ matchStr: im[0], start: im.index, end: im.index + im[0].length });
          if (rawMatches[langIndex]) {
              const newValue = typeof val === 'object' ? JSON.stringify(val).replace(/"/g, "'") : `'${val.replace(/'/g, "\\'")}'`;
              tsContent = tsContent.replace(match[0], `${match[1]}${itemsStr.substring(0, rawMatches[langIndex].start)}${newValue}${itemsStr.substring(rawMatches[langIndex].end)}${match[3]}`);
              updatedCount++;
          }
      }
  }
  fs.writeFileSync(tsFilePath, tsContent, 'utf8');
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
  const translationsFiles = findTranslationsFiles(inputPath);
  if (!translationsFiles) return false;

  // 1. 全局路径冲突检测 (Namespace vs Leaf)
  const data = loadTranslationsData(inputPath);
  if (data) {
      const globalPathMap = new Map();
      for (const [moduleName, moduleData] of Object.entries(data.allTranslations)) {
          const isRootModule = moduleName === 'translations' || moduleName === 'index';
          const modulePrefix = isRootModule ? '' : moduleName;
          
          // 标记模块路径的所有父级为 namespace
          if (!isRootModule) {
              const parts = moduleName.split('.');
              let curr = '';
              for (let i = 0; i < parts.length; i++) {
                  curr = curr ? `${curr}.${parts[i]}` : parts[i];
                  const type = (i === parts.length - 1) ? 'namespace' : 'namespace'; // 模块根总是 namespace
                  if (globalPathMap.has(curr) && globalPathMap.get(curr) !== 'namespace') {
                      console.error(`  ❌ ${ct.errors('conflict_path', { path: curr })}`);
                      return false;
                  }
                  globalPathMap.set(curr, 'namespace');
              }
          }

          const checkConflict = (entries, prefix = '') => {
              for (const entry of entries) {
                  const currentPath = prefix ? `${prefix}.${entry.key}` : entry.key;
                  const type = entry.type === 'namespace' ? 'namespace' : 'leaf';
                  if (globalPathMap.has(currentPath) && globalPathMap.get(currentPath) !== type) {
                      console.error(`  ❌ ${ct.errors('conflict_path', { path: currentPath })}`);
                      return false;
                  }
                  globalPathMap.set(currentPath, type);
                  if (entry.type === 'namespace') {
                      if (!checkConflict(entry.children, currentPath)) return false;
                  }
              }
              return true;
          };
          if (!checkConflict(moduleData.entries, modulePrefix)) {
              return false;
          }
      }
  }

  let hasError = false;
  for (const { fullPath, moduleName } of translationsFiles) {
    console.log(`\n🔍 ${ct.info('checking', { file: moduleName })}`);
    const content = fs.readFileSync(fullPath, 'utf8');
    const langOrderMatch = content.match(/(?:export\s+)?const\s+LANG_ORDER\s*=\s*\[(.*?)\]/);
    if (!langOrderMatch) { console.error(`  ❌ ${ct.errors('no_lang_order')}`); hasError = true; continue; }
    const langOrder = langOrderMatch[1].split(',').map(s => s.trim().replace(/['"`]/g, '')).filter(Boolean);
    const transMatch = content.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*(\{[\s\S]*?\});/);
    if (!transMatch) { console.error(`  ❌ ${ct.errors('no_translations')}`); hasError = true; continue; }
    const validateEntries = (entries, path = '') => {
      for (const entry of entries) {
        const currentPath = path ? `${path}.${entry.key}` : entry.key;
        
        // 1. 检查重复 Key
        if (entry.isDuplicate) {
            console.error(`  ❌ ${ct.errors('duplicate_key', { path: path || 'root', key: entry.key })}`);
            hasError = true;
        }

        if (entry.type === 'namespace') validateEntries(entry.children, currentPath);
        else if (entry.type === 'leaf' && entry.valueStr.trim().startsWith('[')) {
            const inner = entry.valueStr.trim().slice(1, -1);
            const items = [];
            const itemRegex = /(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})|(['"`])([\s\S]*?)\2/g;
            let im;
            while ((im = itemRegex.exec(inner)) !== null) {
                items.push(im[1] || im[3]);
            }

            const foundLangs = new Set();
            items.forEach((item, idx) => {
                const match = typeof item === 'string' ? item.match(/^([a-zA-Z0-9-]+):\s*/) : null;
                if (match && langOrder.includes(match[1])) foundLangs.add(match[1]);
            });

            // 如果数组长度等于语言总数，且全都没有显式标记，则视为按顺序排列，不报缺失标记
            const allNoTags = items.every(item => !(typeof item === 'string' && item.match(/^([a-zA-Z0-9-]+):\s*/)));
            if (allNoTags && items.length === langOrder.length) {
                // OK
            } else {
                const missing = langOrder.filter(l => !foundLangs.has(l));
                if (missing.length > 0) console.warn(`  ⚠️  [${currentPath}] ${ct.info('missing_tags', { langs: missing.join(', ') })}`);
            }
        }
      }
    };
    validateEntries(parseObject(transMatch[1]));
    console.log(`  ✅ ${ct.info('check_ok')}`);
  }
  return !hasError;
}

export function fixTranslations(inputPath, i18n) {
  const ct = i18n.t.cli;
  const translationsFiles = findTranslationsFiles(inputPath);
  if (!translationsFiles) return false;
  for (const { fullPath, moduleName } of translationsFiles) {
    console.log(`\n🔧 ${ct.info('fixing', { file: moduleName })}`);
    let content = fs.readFileSync(fullPath, 'utf8');
    const langOrderMatch = content.match(/(?:export\s+)?const\s+LANG_ORDER\s*=\s*\[(.*?)\]/);
    if (!langOrderMatch) continue;
    const langOrder = langOrderMatch[1].split(',').map(s => s.trim().replace(/['"`]/g, '')).filter(Boolean);
    const mainLang = (content.match(/(?:export\s+)?const\s+MAIN_LANG.*=\s*['"](.*?)['"]/) || [])[1] || langOrder[0];
    const transMatch = content.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*(\{[\s\S]*?\});/);
    if (!transMatch) continue;
    let fixedCount = 0;
    // 1. 全局冲突感知
    const globalData = loadTranslationsData(inputPath);
    const globalPathMap = new Map();
    if (globalData) {
        for (const [mName, mData] of Object.entries(globalData.allTranslations)) {
            const prefix = (mName === 'translations' || mName === 'index') ? '' : mName;
            const walk = (entries, p = '') => {
                for (const e of entries) {
                    const full = p ? `${p}.${e.key}` : e.key;
                    const type = e.type === 'namespace' ? 'namespace' : 'leaf';
                    if (!globalPathMap.has(full)) globalPathMap.set(full, { type, files: new Set([e.sourceFile]) });
                    else {
                        globalPathMap.get(full).files.add(e.sourceFile);
                        if (globalPathMap.get(full).type !== type) globalPathMap.get(full).hasConflict = true;
                    }
                    if (e.type === 'namespace') walk(e.children, full);
                }
            };
            walk(mData.entries, prefix);
        }
    }

    const doFixEntries = (entries, prefix = '') => {
      for (const entry of entries) {
        const fullPath = prefix ? `${prefix}.${entry.key}` : entry.key;
        
        // 跨文件类型冲突修复：如果当前是 leaf 但全局有 namespace 冲突
        if (entry.type === 'leaf' && globalPathMap.get(fullPath)?.hasConflict) {
            const newKey = `${entry.key}_val`;
            const oldKeyRegex = new RegExp(`(\\b${entry.key}\\b\\s*:)`);
            content = content.replace(oldKeyRegex, `${newKey}:`);
            console.warn(`  ⚠️  ${ct.info('conflict_fix', { old: entry.key, new: newKey, path: fullPath })}`);
            fixedCount++;
        }

        if (entry.type === 'namespace') doFixEntries(entry.children, fullPath);
        else if (entry.type === 'leaf' && entry.valueStr.trim().startsWith('[')) {
            const inner = entry.valueStr.trim().slice(1, -1);
            const items = [];
            const itemRegex = /(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})|(['"`])([\s\S]*?)\2/g;
            let im;
            while ((im = itemRegex.exec(inner)) !== null) items.push(im[0]);
            const foundLangs = new Set();
            let mainLangValue = '';
            items.forEach((item, idx) => {
                const m = item.match(/^(['"`])([a-zA-Z0-9-]+):\s*(.*)\1$/);
                if (m && langOrder.includes(m[2])) { foundLangs.add(m[2]); if (m[2] === mainLang) mainLangValue = m[3]; }
                else if (langOrder[idx] === mainLang) mainLangValue = item.replace(/['"`]/g, '');
            });
            const allNoTags = items.every(item => !(item.match(/^(['"`])([a-zA-Z0-9-]+):\s*/)));
            const missing = langOrder.filter(l => !foundLangs.has(l));
            if (missing.length > 0 && !(allNoTags && items.length === langOrder.length)) {
                const newItems = [...items, ...missing.map(l => `'${l}: ${mainLangValue || ''}'`)];
                const keyRegex = new RegExp(`(${entry.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*\\[\\s*)([\\s\\S]*?)(\\s*\\],?)`, 'm');
                content = content.replace(keyRegex, `$1\n      ${newItems.join(',\n      ')}\n    $3`);
                fixedCount++;
            }
        }
      }
    };

    const sortEntries = (str) => {
        const transMatch = str.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*(\{[\s\S]*?\});/);
        if (!transMatch) return str;
        
        const sortObject = (objStr) => {
            const entries = parseObject(objStr);
            // 递归排序子节点
            for (const entry of entries) {
                if (entry.type === 'namespace') {
                    // 找到子对象的字符串范围
                    const subObjMatch = objStr.match(new RegExp(`${entry.key}:\\s*(\\{[\\s\\S]*?\\})`));
                    if (subObjMatch) {
                        const sortedSub = sortObject(subObjMatch[1].slice(1, -1));
                        objStr = objStr.replace(subObjMatch[1], `{\n${sortedSub}\n    }`);
                    }
                }
            }
            // 排序当前层级
            entries.sort((a, b) => a.key.localeCompare(b.key));
            
            // 重构字符串比较复杂，简单起见，我们只对顶级 TRANSLATIONS 进行排序
            // 如果要完美修复所有嵌套缩进，建议使用格式化工具。
            // 这里我们仅实现顶级 Key 的排序作为示例。
            return entries;
        };

        // 实际上 parseObject 已经解析了整个树。我们重新构建 TRANSLATIONS 字符串。
        const rebuild = (entries, indent = 2) => {
            // 去重：保留最后一个出现的 Key (模拟 JS 对象行为)
            const uniqueEntries = [];
            const keyMap = new Map();
            for (const entry of entries) {
                keyMap.set(entry.key, entry);
            }
            for (const [key, entry] of keyMap) {
                uniqueEntries.push(entry);
            }

            uniqueEntries.sort((a, b) => a.key.localeCompare(b.key));
            let res = '';
            const space = ' '.repeat(indent);
            for (const entry of uniqueEntries) {
                if (entry.type === 'namespace') {
                    res += `${space}${entry.key}: {\n${rebuild(entry.children, indent + 2)}${space}},\n`;
                } else {
                    res += `${space}${entry.key}: ${entry.valueStr},\n`;
                }
            }
            return res;
        };
        
        const sortedRoot = rebuild(parseObject(transMatch[1].slice(1, -1)));
        return str.replace(transMatch[1], `{\n${sortedRoot}}`);
    };

    doFixEntries(parseObject(transMatch[1]));
    
    // 强制执行排序并写回
    content = sortEntries(content);
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`  ✅ ${ct.info('sorted')}`);
  }
  return true;
}

export async function doTranslate(inputPath, i18n) {
  const ct = i18n.t.cli;
  const translationsFiles = findTranslationsFiles(inputPath);
  if (!translationsFiles) return;
  for (const { fullPath, moduleName } of translationsFiles) {
    console.log(`\n🤖 ${ct.info('checking', { file: moduleName })}...`);
    const content = fs.readFileSync(fullPath, 'utf8');
    const transMatch = content.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*(\{[\s\S]*?\});/);
    if (!transMatch) continue;
    const langOrder = (content.match(/(?:export\s+)?const\s+LANG_ORDER\s*=\s*\[(.*?)\]/) || [])[1]?.split(',').map(s => s.trim().replace(/['"`]/g, '')).filter(Boolean) || ['zh-CN', 'en-US'];
    const mainLang = (content.match(/(?:export\s+)?const\s+MAIN_LANG.*=\s*['"](.*?)['"]/) || [])[1] || langOrder[0];
    const missingMap = {};
    const collectMissing = (entries, path = '') => {
      for (const entry of entries) {
        const currentPath = path ? `${path}.${entry.key}` : entry.key;
        if (entry.type === 'namespace') collectMissing(entry.children, currentPath);
        else if (entry.type === 'leaf' && entry.valueStr.trim().startsWith('[')) {
            const inner = entry.valueStr.trim().slice(1, -1);
            const items = [];
            const itemRegex = /(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})|(['"`])([\s\S]*?)\2/g;
            let im;
            while ((im = itemRegex.exec(inner)) !== null) items.push(im[0]);
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
    };
    collectMissing(parseObject(transMatch[1]));
    for (const lang in missingMap) {
        const translated = await translateWithAI(missingMap[lang], [lang], mainLang);
        if (translated[lang]) for (const [keyPath, value] of Object.entries(translated[lang])) syncSingleJsonFromObj(fullPath, { language: lang, translations: { [keyPath]: value } }, i18n);
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
