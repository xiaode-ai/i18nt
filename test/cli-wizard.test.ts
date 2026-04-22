import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance, Mock } from 'vitest';

// Mock enquirer — 必须在导入 cli-wizard.js 之前
vi.mock('enquirer', () => {
    const Confirm = vi.fn();
    const Select = vi.fn();
    const Input = vi.fn();
    return {
        Confirm,
        Select,
        Input,
        default: { Confirm, Select, Input }
    };
});

vi.mock('../bin/cli-config.js', () => {
    return {
        runInteractiveConfig: vi.fn(),
        loadConfig: vi.fn(() => ({})),
    };
});

vi.mock('../bin/cli-tui.js', () => {
    return {
        invokeMenu: vi.fn(),
        waitForKey: vi.fn().mockResolvedValue(undefined),
    };
});

import { runMainWizard } from '../bin/cli-wizard.js';
import { runInteractiveConfig, loadConfig } from '../bin/cli-config.js';
import { invokeMenu, waitForKey } from '../bin/cli-tui.js';
import enquirer from 'enquirer';

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
            doFix: vi.fn(),
            runUI: vi.fn(),
            doPruneTranslations: vi.fn().mockResolvedValue(undefined),
            doTMSSync: vi.fn().mockResolvedValue(undefined),
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    /**
     * 辅助函数：配置 invokeMenu 的返回序列
     */
    function mockSelectSequence(values: (string | Error)[]) {
        let idx = 0;
        (invokeMenu as Mock).mockImplementation(async () => {
            const val = values[idx++];
            if (val instanceof Error) throw val;
            return val;
        });
    }

    /**
     * 辅助函数：配置 Input.run（waitForEnter 用到 — 旧版逻辑，现在用 waitForKey）
     */
    function mockInputAlwaysResolve() {
        (waitForKey as Mock).mockResolvedValue(undefined);
    }

    /**
     * 辅助函数：配置 Confirm.run
     */
    function mockConfirmSequence(values: (boolean | Error)[]) {
        let idx = 0;
        (enquirer.Confirm as unknown as Mock).mockImplementation(function(opts: any) {
            return {
                run: async () => {
                    const val = values[idx++];
                    if (val instanceof Error) throw val;
                    return val;
                },
                _opts: opts,
            };
        });
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

        expect(mockCommands.runUI).toHaveBeenCalledWith(4000, null);
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

        expect(invokeMenu).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.stringContaining('已配置'), expect.anything());
    });

    it('should show AI not configured status when no config', async () => {
        (loadConfig as Mock).mockReturnValue({});
        mockSelectSequence(['exit']);
        mockInputAlwaysResolve();

        await runMainWizard({}, mockCommands, null);

        expect(invokeMenu).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.stringContaining('未配置'), expect.anything());
    });
});
