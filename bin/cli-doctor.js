import fs from 'fs';
import path from 'path';
import { parseObject, resolveLeafValue, extractIcuVars, findTranslationsFiles } from './cli-utils.js';

/**
 * Doctor 命令：诊断字典健康状况
 */
export async function runDoctor(inputPath, i18n) {
  const ct = i18n.t.cli;
  console.log(ct.info('doctor_start') || '🏥 Running i18nt doctor...');
  let errors = 0;
  let warnings = 0;

  const translationsFiles = findTranslationsFiles(inputPath);
  if (!translationsFiles) {
    console.error(ct.errors.no_file);
    return false;
  }

  // 动态导入 ICU 解析器
  const { parseICU } = await import('../dist/icu.js');

  for (const { fullPath, moduleName } of translationsFiles) {
    console.log(`\n🔍 Checking module: ${moduleName} (${path.relative(process.cwd(), fullPath)})`);
    const content = fs.readFileSync(fullPath, 'utf8');

    // 1. 检查循环引用
    let transStr = '';
    const transStartMatch = content.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*\{/);
    if (transStartMatch) {
      let stack = 0;
      let started = false;
      const startIndex = transStartMatch.index + transStartMatch[0].length - 1;
      for (let i = startIndex; i < content.length; i++) {
          if (content[i] === '{') {
              stack++;
              started = true;
          } else if (content[i] === '}') {
              stack--;
          }
          if (started) transStr += content[i];
          if (started && stack === 0) break;
      }
      const importMap = {};
      const importRegex = /import\s+\{\s*(.*?)\s*\}\s*from\s*['"](.*?)['"]/g;
      let im;
      while ((im = importRegex.exec(content)) !== null) {
        const keys = im[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop());
        const importPath = im[2];
        for (const k of keys) importMap[k] = importPath;
      }

      const entries = parseObject(transStr);
      const visited = new Set();
      const pathStack = [];

      function checkCircular(items, currentFile) {
        for (const item of items) {
          if (item.type === 'reference') {
            const varName = item.valueStr.trim();
            const relPath = importMap[varName];
            if (relPath) {
              let target = path.resolve(path.dirname(currentFile), relPath);
              if (!target.endsWith('.ts')) target += '.ts';

              if (pathStack.includes(target)) {
                console.error(`❌ Circular reference detected: ${pathStack.join(' -> ')} -> ${target}`);
                errors++;
                return;
              }

              if (!visited.has(target) && fs.existsSync(target)) {
                visited.add(target);
                pathStack.push(target);
                const subContent = fs.readFileSync(target, 'utf8');
                const subTrans = subContent.match(/(?:export\s+)?const\s+TRANSLATIONS\s*=\s*(\{[\s\S]*?\})(?:;|$)/);
                if (subTrans) checkCircular(parseObject(subTrans[1]), target);
                pathStack.pop();
              }
            }
          } else if (item.type === 'namespace') {
            checkCircular(item.children, currentFile);
          }
        }
      }

      pathStack.push(path.resolve(fullPath));
      checkCircular(entries, fullPath);
    }

    // 2. 检查 ICU 语法与一致性
    const langOrderMatch = content.match(/(?:export\s+)?const\s+LANG_ORDER\s*=\s*\[(.*?)\]/);
    const langOrder = langOrderMatch ? langOrderMatch[1].split(',').map(s => s.trim().replace(/['"`]/g, '')) : [];
    const mainLang = langOrder[0];

    if (transStr && langOrder.length > 0) {
      const entries = parseObject(transStr);

      function validateICU(items, currentPath = '') {
        for (const item of items) {
          const fullKey = currentPath ? `${currentPath}.${item.key}` : item.key;
          if (item.type === 'namespace') {
            validateICU(item.children, fullKey);
          } else if (item.type === 'leaf') {
            const mainVal = resolveLeafValue(item.valueStr, mainLang, langOrder, mainLang);
            const mainVars = extractIcuVars(mainVal, parseICU);

            for (const lang of langOrder) {
              const val = resolveLeafValue(item.valueStr, lang, langOrder, mainLang);
              if (val) {
                try {
                  parseICU(val);
                } catch (e) {
                  console.error(`❌ [${lang}] ICU Syntax Error in "${fullKey}": ${e.message}`);
                  errors++;
                }

                const currentVars = extractIcuVars(val, parseICU);
                const missingVars = mainVars.filter(v => !currentVars.includes(v));
                const extraVars = currentVars.filter(v => !mainVars.includes(v));

                if (missingVars.length > 0) {
                  console.error(`❌ [${lang}] Missing variables in "${fullKey}": {${missingVars.join('}, {')}}`);
                  errors++;
                }
                if (extraVars.length > 0) {
                  console.warn(`⚠️ [${lang}] Extra variables in "${fullKey}" not present in main language: {${extraVars.join('}, {')}}`);
                  warnings++;
                }

                if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(val)) {
                  console.warn(`⚠️ [${lang}] Hidden control characters detected in "${fullKey}"`);
                  warnings++;
                }
              } else if (lang === mainLang) {
                console.error(`❌ Missing translation for main language [${lang}] in "${fullKey}"`);
                errors++;
              } else {
                console.warn(`⚠️ Missing translation for [${lang}] in "${fullKey}"`);
                warnings++;
              }
            }
          }
        }
      }
      validateICU(entries);
    }
  }

  console.log(`\n✨ Doctor finished with ${errors} errors and ${warnings} warnings.`);
  return errors === 0;
}
