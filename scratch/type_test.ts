import { createI18n } from './src/core.js';

const TRANSLATIONS = {
    welcome: 'Hello {name}',
    cart: '{count, plural, one{# item} other{# items}}',
    today: 'Today is {val, date, full}',
    simple: 'Just a string',
};

const i18n = createI18n({
    translations: TRANSLATIONS,
    langOrder: ['en-US'],
    locale: 'en-US'
});

const { t } = i18n;

// 这些应该通过类型检查 (IDE 层面，这里我们模拟调用)
t.welcome({ name: 'Alice' });
t.cart({ count: 3 });
t.today({ val: new Date() });

// 这是一个特殊的检查：如果没有参数，它应该是一个字符串或者是一个函数
// t.simple -> "Just a string"
console.log('t.simple:', t.simple);

// 如果我们传错了参数类型，TypeScript 应该报错（在 IDE 中）
// @ts-expect-error
t.cart({ count: 'not a number' }); 

// @ts-expect-error
t.today({ val: 'not a date' });

console.log('Type safety smoke test done.');
