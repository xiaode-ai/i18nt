import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runMainWizard } from '../bin/cli-wizard.js';
import readline from 'readline';
import * as cliConfig from '../bin/cli-config.js';

vi.mock('readline', () => {
    return {
        default: {
            createInterface: vi.fn()
        }
    };
});

vi.mock('../bin/cli-config.js', () => {
    return {
        runInteractiveConfig: vi.fn()
    };
});

import type { MockInstance, Mock } from 'vitest';

describe('runMainWizard', () => {
    let mockRl: any;
    let mockQuestion: Mock;
    let mockClose: Mock;
    let consoleLogSpy: MockInstance;
    let consoleClearSpy: MockInstance;
    let mockCommands: any;

    beforeEach(() => {
        mockQuestion = vi.fn();
        mockClose = vi.fn();
        mockRl = {
            question: mockQuestion,
            close: mockClose
        };
        (readline.createInterface as Mock).mockReturnValue(mockRl);
        
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleClearSpy = vi.spyOn(console, 'clear').mockImplementation(() => {});

        mockCommands = {
            doExtract: vi.fn(),
            doTranslate: vi.fn(),
            doCheck: vi.fn(),
            runUI: vi.fn(),
            doPruneTranslations: vi.fn(),
            doTMSSync: vi.fn()
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should display welcome message and exit on 0', async () => {
        mockQuestion.mockImplementation((query: string, cb: (answer: string) => void) => {
            cb('0');
        });

        await runMainWizard({}, mockCommands, null);

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('欢迎'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('再见！'));
        expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('should switch language on L', async () => {
        let callCount = 0;
        mockQuestion.mockImplementation((query: string, cb: (answer: string) => void) => {
            if (callCount === 0) {
                callCount++;
                cb('L');
            } else {
                cb('0');
            }
        });

        await runMainWizard({}, mockCommands, null);

        expect(consoleClearSpy).toHaveBeenCalledTimes(1);
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Bye!'));
    });

    it('should call runInteractiveConfig on 1', async () => {
        mockQuestion.mockImplementation((query: string, cb: (answer: string) => void) => cb('1'));

        await runMainWizard({}, mockCommands, null);

        expect(cliConfig.runInteractiveConfig).toHaveBeenCalledTimes(1);
        expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('should call doExtract on 2', async () => {
        mockQuestion.mockImplementation((query: string, cb: (answer: string) => void) => cb('2'));
        const mockI18n = {};

        await runMainWizard({ input: 'src_test' }, mockCommands, mockI18n);

        expect(mockCommands.doExtract).toHaveBeenCalledWith('src_test', mockI18n);
        expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('should call doTranslate on 3', async () => {
        mockQuestion.mockImplementation((query: string, cb: (answer: string) => void) => cb('3'));
        const mockI18n = {};

        await runMainWizard({ input: 'dict_test.ts' }, mockCommands, mockI18n);

        expect(mockCommands.doTranslate).toHaveBeenCalledWith('dict_test.ts', mockI18n);
        expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('should call doCheck on 4', async () => {
        mockQuestion.mockImplementation((query: string, cb: (answer: string) => void) => cb('4'));
        const mockI18n = {};

        await runMainWizard({ input: 'dict_test.ts' }, mockCommands, mockI18n);

        expect(mockCommands.doCheck).toHaveBeenCalledWith('dict_test.ts', mockI18n);
        expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('should call runUI on 5', async () => {
        mockQuestion.mockImplementation((query: string, cb: (answer: string) => void) => cb('5'));

        await runMainWizard({ port: 4000 }, mockCommands, null);

        expect(mockCommands.runUI).toHaveBeenCalledWith(4000);
        expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('should call doPruneTranslations on 6', async () => {
        mockQuestion.mockImplementation((query: string, cb: (answer: string) => void) => cb('6'));
        const mockI18n = {};

        await runMainWizard({ input: 'dict_test.ts' }, mockCommands, mockI18n);

        expect(mockCommands.doPruneTranslations).toHaveBeenCalledWith('dict_test.ts', mockI18n);
        expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('should call doTMSSync on 7', async () => {
        mockQuestion.mockImplementation((query: string, cb: (answer: string) => void) => cb('7'));
        const mockArgs = { input: 'dict_test.ts' };
        const mockI18n = {};

        await runMainWizard(mockArgs, mockCommands, mockI18n);

        expect(mockCommands.doTMSSync).toHaveBeenCalledWith('dict_test.ts', mockArgs, mockI18n);
        expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid input and then exit', async () => {
        mockQuestion.mockImplementation((query: string, cb: (answer: string) => void) => cb('invalid_option'));

        await runMainWizard({}, mockCommands, null);

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('无效的选择。'));
        expect(mockClose).toHaveBeenCalledTimes(1);
    });
});
