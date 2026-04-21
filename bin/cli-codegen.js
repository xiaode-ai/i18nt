import fs from 'fs';
import { loadTranslationsData, resolveLeafValue } from './cli-utils.js';

/**
 * 运行代码生成
 */
export async function runCodegen(inputPath, outputPath, target = 'python') {
    const data = loadTranslationsData(inputPath);
    if (!data) {
        console.error('❌ No translations found for codegen.');
        return;
    }

    const { allTranslations, globalMainLang, globalLangOrder } = data;
    const modules = Object.values(allTranslations);
    if (modules.length === 0) return;

    const allEntries = modules.flatMap(m => m.entries);
    const { parseICU } = await import('../dist/icu.js');

    let output = '';
    if (target === 'python') {
        output = await generatePython(allEntries, globalMainLang, globalLangOrder, parseICU);
    } else {
        console.error(`❌ Unsupported target: ${target}`);
        return;
    }

    fs.writeFileSync(outputPath, output);
    console.log(`\n✨ CodeGen successful! Output saved to: ${outputPath}`);
}

async function generatePython(entries, mainLang, langOrder, parseICU) {
    let code = `from typing import Any, Dict, Optional, List, Union\n`;
    code += `from datetime import datetime\n\n`;
    code += `class I18nKeys:\n`;
    code += `    def __init__(self, i18n_instance):\n`;
    code += `        self._i18n = i18n_instance\n`;

    function getIcuVarsWithTypes(parts) {
        const vars = {}; // { name: type }
        
        for (const part of parts) {
            if (typeof part === 'string') continue;
            
            if (part.type === 'var') {
                if (part.name !== '#') vars[part.name] = 'Any';
            } else if (part.type === 'plural' || part.type === 'selectordinal') {
                vars[part.name] = 'Union[int, float]';
                // Recursively check options
                for (const opt of Object.values(part.options)) {
                    Object.assign(vars, getIcuVarsWithTypes(opt));
                }
            } else if (part.type === 'select') {
                vars[part.name] = 'str';
                for (const opt of Object.values(part.options)) {
                    Object.assign(vars, getIcuVarsWithTypes(opt));
                }
            } else if (part.type === 'number') {
                vars[part.name] = 'Union[int, float]';
            } else if (part.type === 'date' || part.type === 'time') {
                vars[part.name] = 'Union[datetime, str, int, float]';
            } else if (part.type === 'relative') {
                vars[part.name] = 'Union[int, float]';
            } else if (part.type === 'list') {
                vars[part.name] = 'List[Any]';
            } else if (part.type === 'tag') {
                Object.assign(vars, getIcuVarsWithTypes(part.children));
            }
        }
        return vars;
    }

    function walk(items, indent = '    ', path = '') {
        let content = '';
        for (const item of items) {
            const fullPath = path ? `${path}.${item.key}` : item.key;
            if (item.type === 'namespace') {
                const className = item.key.charAt(0).toUpperCase() + item.key.slice(1);
                content += `\n${indent}class ${className}Proxy:\n`;
                content += `${indent}    def __init__(self, i18n):\n`;
                content += `${indent}        self._i18n = i18n\n`;
                content += walk(item.children, indent + '    ', fullPath);
                content += `\n${indent}@property\n`;
                content += `${indent}def ${item.key}(self) -> '${className}Proxy':\n`;
                content += `${indent}    return self.${className}Proxy(self._i18n)\n`;
            } else {
                const val = resolveLeafValue(item.valueStr, mainLang, langOrder, mainLang);
                let vars = {};
                try {
                    const parts = parseICU(val);
                    vars = getIcuVarsWithTypes(parts);
                } catch (e) {
                    // Fallback to basic extraction if parsing fails
                    console.warn(`⚠️ Failed to parse ICU for ${fullPath}: ${e.message}`);
                }
                
                const varNames = Object.keys(vars);
                const args = varNames.length > 0 
                    ? `, ${varNames.map(v => `${v}: ${vars[v]}`).join(', ')}` 
                    : '';
                const params = varNames.length > 0
                    ? `, {${varNames.map(v => `"${v}": ${v}`).join(', ')}}`
                    : '';

                content += `\n${indent}def ${item.key}(self${args}) -> str:\n`;
                content += `${indent}    return self._i18n.t("${fullPath}"${params})\n`;
            }
        }
        return content;
    }

    code += walk(entries, '    ');
    code += `\ndef get_keys(i18n_instance) -> I18nKeys:\n`;
    code += `    return I18nKeys(i18n_instance)\n`;

    return code;
}
