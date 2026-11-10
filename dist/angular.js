/**
 * i18nt — Angular 适配层
 * 提供 Service 与 Pipe 支持
 */
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
import { Injectable, Pipe, signal, inject, InjectionToken, PLATFORM_ID } from '@angular/core';
import { createI18n } from './core.js';
export const I18N_CONFIG = new InjectionToken('I18N_CONFIG');
export const I18N_INSTANCE = new InjectionToken('I18N_INSTANCE');
let I18nService = (() => {
    let _classDecorators = [Injectable({ providedIn: 'root' })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var I18nService = _classThis = class {
        constructor() {
            this.platformId = inject(PLATFORM_ID);
            /**
             * 使用 Angular Signal 包装语言状态
             * 确保在语言切换时触发全站变更检测
             */
            this.locale = signal('');
            this.isRTL = signal(false);
            // 优先尝试从注入令牌获取实例，否则创建新实例
            const config = inject(I18N_CONFIG, { optional: true });
            const externalInstance = inject(I18N_INSTANCE, { optional: true });
            if (externalInstance) {
                this._instance = externalInstance;
            }
            else if (config) {
                this._instance = createI18n(config);
            }
            else {
                throw new Error('[i18nt] I18nService requires I18N_CONFIG or I18N_INSTANCE to be provided');
            }
            // 初始化状态
            this.locale.set(this._instance.locale);
            this.isRTL.set(this._instance.isRTL);
            this.t = this._instance.t;
            // 订阅变更
            this._instance.onChange((newLocale) => {
                this.locale.set(newLocale);
                this.isRTL.set(this._instance.isRTL);
            });
        }
        setLocale(lang) {
            this._instance.setLocale(lang);
        }
        get availableLocales() {
            return this._instance.availableLocales;
        }
    };
    __setFunctionName(_classThis, "I18nService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        I18nService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return I18nService = _classThis;
})();
export { I18nService };
/**
 * 翻译 Pipe，用于模板
 * @example {{ 'buttons.save' | t }}
 */
let TranslatePipe = (() => {
    let _classDecorators = [Pipe({
            name: 't',
            pure: false, // 设置为非纯 Pipe 以响应语言切换
            standalone: true
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var TranslatePipe = _classThis = class {
        constructor() {
            this.i18n = inject(I18nService);
        }
        transform(path, params) {
            // 访问一下 signal 确保模板能够追踪变更
            this.i18n.locale();
            return this.i18n.t(path, params);
        }
    };
    __setFunctionName(_classThis, "TranslatePipe");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        TranslatePipe = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return TranslatePipe = _classThis;
})();
export { TranslatePipe };
/**
 * Angular 提供者辅助函数
 */
export function provideI18n(input) {
    const providers = [I18nService];
    if ('t' in input) {
        providers.push({ provide: I18N_INSTANCE, useValue: input });
    }
    else {
        providers.push({ provide: I18N_CONFIG, useValue: input });
    }
    return providers;
}
