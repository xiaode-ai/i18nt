import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance, Mock } from 'vitest';

// Mock enquirer — 必须在导入 cli-wizard.js 之前
vi.mock('enquirer', () => {
    const mockSelect = vi.fn();
    const mockConfirm = vi.fn();
    const mockInput = vi.fn();
    return {
        Select: vi.fn().mockImplementation((opts) => ({ run: mockSelect, _opts: opts })),
        Confirm: vi.fn().mockImplementation((opts) => ({ run: mockConfirm, _opts: opts })),
        Input: vi.fn().mockImplementation((opts) => ({ run: mockInput, _opts: opts })),
    };
});

vi.mock('../bin/cli-config.js', () => {
    return {
        runInteractiveConfig: vi.fn(),
        loadConfig: vi.fn(() => ({})),
    };
});

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// 需要在 mock 之后再动态导入
const { runMainWizard } = await import('../bin/cli-wizard.js');
const { runInteractiveConfig, loadConfig } = await import('../bin/cli-config.js');
const enquirer = require('enquirer');

describe('runMainWizard', () => {
    let consoleLogSpy: MockInstance;
    let consoleClearSpy: MockInstance;
    let mockCommands: any;

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleClearSpy = vi.spyOn(console, 'clear').mockImplementation(() => {});

        mockCommands = {
            doExtract: vi.fn(),
            doTranslate: vi.fn().mockResolvedValue(undefined),
            doCheck: vi.fn(),
            runUI: vi.fn(),
            doPruneTranslations: vi.fn().mockResolvedValue(undefined),
            doTMSSync: vi.fn().mockResolvedValue(undefined),
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    /**
     * 辅助函数：配置 Select.run 的返回序列
     * 每次构造 new Select() 时，run() 返回序列中的下一个值
     */
    function mockSelectSequence(values: (string | Error)[]) {
        let idx = 0;
        (enquirer.Select as unknown as Mock).mockImplementation((opts: any) => ({
            run: async () => {
                const val = values[idx++];
                if (val instanceof Error) throw val;
                return val;
            },
            _opts: opts,
        }));
    }

    /**
     * 辅助函数：配置 Input.run（waitForEnter 用到）
     */
    function mockInputAlwaysResolve() {
        (enquirer.Input as unknown as Mock).mockImplementation((opts: any) => ({
            run: async () => '',
            _opts: opts,
        }));
    }

    /**
     * 辅助函数：配置 Confirm.run
     */
    function mockConfirmSequence(values: (boolean | Error)[]) {
        let idx = 0;
        (enquirer.Confirm as unknown as Mock).mockImplementation((opts: any) => ({
            run: async () => {
                const val = values[idx++];
                if (val instanceof Error) throw val;
                return val;
            },
            _opts: opts,
        }));
    }

    it('should exit on "exit" selection', async () => {
        mockSelectSequence(['exit']);
        mockInputAlwaysResolve();

        await runMainWizard({}, mockCommands, null);

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('再见'));
    });

    it('should exit on Ctrl+C (rejected promise)', async () => {
        mockSelectSequence([new Error('cancelled')]);

        await runMainWizard({}, mockCommands, null);

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('再见'));
    });

    it('should switch language and show English text', async () => {
        mockSelectSequence(['lang', 'exit']);
        mockInputAlwaysResolve();

        await runMainWizard({}, mockCommands, null);

        // 第二次菜单应使用英文
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Bye'));
    });

    it('should call runInteractiveConfig on "setup"', async () => {
        mockSelectSequence(['setup', 'exit']);
        mockInputAlwaysResolve();

        await runMainWizard({}, mockCommands, null);

        expect(runInteractiveConfig).toHaveBeenCalledTimes(1);
    });

    it('should call doExtract on "extract"', async () => {
        mockSelectSequence(['extract', 'exit']);
        mockInputAlwaysResolve();
        const mockI18n = {};

        await runMainWizard({ input: 'src_test' }, mockCommands, mockI18n);

        expect(mockCommands.doExtract).toHaveBeenCalledWith('src_test', mockI18n);
    });

    it('should call doTranslate on "translate"', async () => {
        mockSelectSequence(['translate', 'exit']);
        mockInputAlwaysResolve();
        const mockI18n = {};

        await runMainWizard({ input: 'dict_test.ts' }, mockCommands, mockI18n);

        expect(mockCommands.doTranslate).toHaveBeenCalledWith('dict_test.ts', mockI18n);
    });

    it('should call doCheck on "check"', async () => {
        mockSelectSequence(['check', 'exit']);
        mockInputAlwaysResolve();
        const mockI18n = {};

        await runMainWizard({ input: 'dict_test.ts' }, mockCommands, mockI18n);

        expect(mockCommands.doCheck).toHaveBeenCalledWith('dict_test.ts', mockI18n);
    });

    it('should call runUI on "ui" and exit wizard', async () => {
        mockSelectSequence(['ui']);
        mockInputAlwaysResolve();

        await runMainWizard({ port: 4000 }, mockCommands, null);

        expect(mockCommands.runUI).toHaveBeenCalledWith(4000);
    });

    it('should confirm and call doPruneTranslations on "prune"', async () => {
        mockSelectSequence(['prune', 'exit']);
        mockInputAlwaysResolve();
        mockConfirmSequence([true]); // 确认 prune
        const mockI18n = {};

        await runMainWizard({ input: 'dict_test.ts' }, mockCommands, mockI18n);

        expect(mockCommands.doPruneTranslations).toHaveBeenCalledWith('dict_test.ts', mockI18n);
    });

    it('should skip prune when user declines confirmation', async () => {
        mockSelectSequence(['prune', 'exit']);
        mockInputAlwaysResolve();
        mockConfirmSequence([false]); // 拒绝 prune

        await runMainWizard({}, mockCommands, null);

        expect(mockCommands.doPruneTranslations).not.toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('已取消'));
    });

    it('should call doTMSSync on "sync"', async () => {
        mockSelectSequence(['sync', 'exit']);
        mockInputAlwaysResolve();
        const mockArgs = { input: 'dict_test.ts' };
        const mockI18n = {};

        await runMainWizard(mockArgs, mockCommands, mockI18n);

        expect(mockCommands.doTMSSync).toHaveBeenCalledWith('dict_test.ts', mockArgs, mockI18n);
    });

    it('should show AI configured status when config exists', async () => {
        (loadConfig as Mock).mockReturnValue({
            ai_provider: 'openai',
            ai_model: 'gpt-4o',
            ai_api_key: 'sk-test123',
        });
        mockSelectSequence(['exit']);
        mockInputAlwaysResolve();

        await runMainWizard({}, mockCommands, null);

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('已配置'));
    });

    it('should show AI not configured status when no config', async () => {
        (loadConfig as Mock).mockReturnValue({});
        mockSelectSequence(['exit']);
        mockInputAlwaysResolve();

        await runMainWizard({}, mockCommands, null);

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('未配置'));
    });
});
