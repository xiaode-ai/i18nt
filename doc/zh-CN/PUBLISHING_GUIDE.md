# 🌍 i18nt 全语种发布与集成指南

本文档汇总了 `i18nt` 支持的所有编程语言适配器的发布命令、安装方式及集成代码。

## 📦 1. 适配器发布命令 (Publishing)

在各目录下运行以下命令即可将适配器推送到全球包管理器：

| 语言 | 目录 | 发布命令 | 包管理器 |
| :--- | :--- | :--- | :--- |
| **Python** | `adapters/python` | `python setup.py sdist upload` | PyPI |
| **PHP** | `adapters/php` | `composer publish` | Packagist |
| **Ruby** | `adapters/ruby` | `gem build i18nt.gemspec && gem push` | RubyGems |
| **Dart** | `adapters/dart` | `flutter pub publish` | Pub.dev |
| **Rust** | `(CLI Export)` | `cargo publish` | Crates.io |

---

## 🛠️ 2. 各语言集成概览 (Integration)

### 🐍 Python
```python
from i18nt import I18n
t = I18n.load("en-US.py")
print(t.auth.login)
```

### 🐘 PHP
```php
$t = I18nt::load('en-US.php');
echo $t->auth->login;
```

### 💎 Ruby
```ruby
t = I18nt::I18n.new(TRANSLATIONS)
puts t.auth.login
```

### 🐹 Go
```go
import "your-project/i18n"
fmt.Println(i18n.T.Auth.Login) // 静态生成，极致补全
```

### 🦀 Rust
```rust
use translations::auth::LOGIN;
println!("{}", LOGIN); // 编译时常量
```

### 🎯 Dart / Flutter
```dart
var t = await I18nt.load("assets/en-US.json");
Text(t("auth.login"))
```

### 🍎 Swift / iOS
```swift
let t = I18nt.load(jsonPath: "en-US.json")
print(t.auth.login.value)
```

### ☕ Java / Android
```java
I18nt i18n = new I18nt(Translations.DATA);
System.out.println(i18n.t("auth.login"));
```

---

## 🚀 3. CLI 导出命令速查

| 目标平台 | 命令 |
| :--- | :--- |
| **通用 JSON** | `npx i18nt export --format json` |
| **Python** | `npx i18nt export --format py` |
| **PHP** | `npx i18nt export --format php` |
| **Go (Structs)** | `npx i18nt export --format go` |
| **Rust (Mods)** | `npx i18nt export --format rust` |
| **Android (XML)** | `npx i18nt export --format xml` |
| **iOS (Strings)** | `npx i18nt export --format strings` |
| **Vanilla HTML** | `npx i18nt export --format js` |

---

## 💎 核心优势
1. **SSOT (唯一事实来源)**: 所有的翻译逻辑都在 TypeScript 中定义。
2. **多模态导出**: 支持“轻量级 SDK”、“静态代码生成”和“运行时辅助类”三种模式。
3. **极简 API**: 全语种保持一致的点语法或路径访问体验。
