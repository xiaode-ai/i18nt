const fs = require('fs');
const path = require('path');

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'detect unknown translation keys',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [
      {
        type: 'object',
        properties: {
          dictionaryPath: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] || {};
    const dictPath = options.dictionaryPath || 'src/i18n/dict.ts';
    let dictionary = null;

    function loadDictionary() {
      if (dictionary) return dictionary;
      const fullPath = path.resolve(process.cwd(), dictPath);
      if (!fs.existsSync(fullPath)) return null;
      
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        // 非常简单的解析：匹配 TRANSLATIONS 对象中的所有键
        // 实际开发中应使用更强大的 AST 解析器，这里先用正则模拟逻辑
        const keys = new Set();
        const matches = content.matchAll(/([a-zA-Z0-9_]+)\s*:\s*[[{]/g);
        for (const m of matches) keys.add(m[1]);
        dictionary = keys;
        return dictionary;
      } catch (e) {
        return null;
      }
    }

    return {
      // 匹配 t.some.key
      MemberExpression(node) {
        if (node.object.name === 't') {
          const dict = loadDictionary();
          if (!dict) return;
          
          const key = node.property.name;
          if (!dict.has(key)) {
            context.report({
              node,
              message: `Unknown translation key: "${key}"`,
            });
          }
        }
      },
      // 匹配 t('some.key')
      CallExpression(node) {
        if (node.callee.name === 't' && node.arguments[0] && node.arguments[0].type === 'Literal') {
          const dict = loadDictionary();
          if (!dict) return;

          const key = node.arguments[0].value;
          const firstPart = key.split('.')[0];
          if (!dict.has(firstPart)) {
            context.report({
              node,
              message: `Unknown translation key prefix: "${firstPart}" in "${key}"`,
            });
          }
        }
      }
    };
  },
};
