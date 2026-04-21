module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'validate ICU message syntax',
      category: 'Possible Errors',
      recommended: true,
    },
  },
  create(context) {
    return {
      // 检查字典文件中的字符串
      Literal(node) {
        if (typeof node.value !== 'string') return;
        
        // 如果字符串包含 {，则进行 ICU 基础校验
        if (node.value.includes('{')) {
          const openBraces = (node.value.match(/\{/g) || []).length;
          const closeBraces = (node.value.match(/\}/g) || []).length;
          
          if (openBraces !== closeBraces) {
            context.report({
              node,
              message: `Potentially invalid ICU message: unmatched braces (${openBraces} open vs ${closeBraces} close)`,
            });
          }
          
          // 检查常见的 plural/select 语法错误
          if (node.value.includes('plural') || node.value.includes('select')) {
             if (!node.value.includes('other')) {
               context.report({
                 node,
                 message: 'ICU plural/select messages must include an "other" case.',
               });
             }
          }
        }
      }
    };
  },
};
