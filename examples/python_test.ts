export const LANG_ORDER = ['en-US', 'zh-CN'];
export const MAIN_LANG = 'en-US';

export const TRANSLATIONS = {
  greeting: [
    'en-US: Hello, {name}!',
    'zh-CN: 你好, {name}!'
  ],
  cart: {
    items: [
      'en-US: {count, plural, =0{No items} one{1 item} other{# items}}',
      'zh-CN: {count, plural, =0{没有商品} other{# 件商品}}'
    ]
  },
  nested: {
    user: {
      profile: [
        'en-US: {gender, select, male{He} female{She} other{They}} updated their profile.',
        'zh-CN: {gender, select, male{他} female{她} other{他们}}更新了个人资料。'
      ]
    }
  },
  complex: {
    stats: [
        'en-US: You have {points, number} points as of {date, date}.',
        'zh-CN: 截至 {date, date}，您拥有 {points, number} 积分。'
    ]
  }
};
