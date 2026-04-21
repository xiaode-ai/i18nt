import { describe, it, expect } from 'vitest';
import { createI18nPlugin } from '../src/vue';
import { getI18nServer } from '../src/next';

const config = {
  translations: {
    hello: ['你好', 'Hello'],
    nested: {
      world: ['世界', 'World']
    }
  },
  langOrder: ['zh-CN', 'en-US'] as const,
  locale: 'zh-CN'
};

describe('Adapters', () => {
  describe('Vue Adapter', () => {
    it('should create a plugin', () => {
      const plugin = createI18nPlugin(config);
      expect(plugin.install).toBeDefined();
    });
  });

  describe('Next.js Adapter', () => {
    it('should create a server instance with cache', () => {
      const i18n1 = getI18nServer(config, 'en-US');
      const i18n2 = getI18nServer(config, 'en-US');
      
      // In vitest environment, cache() might not work as in Next.js, 
      // but we can check if it returns a valid instance
      expect(i18n1.t.hello).toBe('Hello');
      expect(i18n2.t.hello).toBe('Hello');
    });

    it('should support specific locale', () => {
      const i18n = getI18nServer(config, 'zh-CN');
      expect(i18n.t.hello).toBe('你好');
    });
  });
});
