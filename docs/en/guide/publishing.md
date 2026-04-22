---
title: Multi-Language Publishing
description: Sync and publish i18nt translation dictionaries to Python, Go, Rust, and more
---

# 🌍 i18nt Multi-Language Publishing & Integration Guide

This document summarizes the publishing commands, installation methods, and integration code for all programming language adapters supported by `i18nt`.

## 📦 1. Adapter Publishing Commands (Publishing)

Run the following commands in each directory to push the adapters to global package managers:

| Language | Directory | Publishing Command | Package Manager |
| :--- | :--- | :--- | :--- |
| **Python** | `adapters/python` | `python setup.py sdist upload` | PyPI |
| **PHP** | `adapters/php` | `composer publish` | Packagist |
| **Ruby** | `adapters/ruby` | `gem build i18nt.gemspec && gem push` | RubyGems |
| **Dart** | `adapters/dart` | `flutter pub publish` | Pub.dev |
| **Rust** | `(CLI Export)` | `cargo publish` | Crates.io |

---

## 🛠️ 2. Integration Overview (Integration)

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
fmt.Println(i18n.T.Auth.Login) // Static generation, perfect autocomplete
```

### 🦀 Rust
```rust
use translations::auth::LOGIN;
println!("{}", LOGIN); // Compile-time constant
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

## 🚀 3. CLI Export Command Cheat Sheet

| Target Platform | Command |
| :--- | :--- |
| **Universal JSON** | `npx i18nt export --format json` |
| **Python** | `npx i18nt export --format py` |
| **PHP** | `npx i18nt export --format php` |
| **Go (Structs)** | `npx i18nt export --format go` |
| **Rust (Mods)** | `npx i18nt export --format rust` |
| **Android (XML)** | `npx i18nt export --format xml` |
| **iOS (Strings)** | `npx i18nt export --format strings` |
| **Vanilla HTML** | `npx i18nt export --format js` |

---

## 💎 Core Advantages
1. **SSOT (Single Source of Truth)**: All translation logic is defined in TypeScript.
2. **Multi-Modal Export**: Supports "Lightweight SDK", "Static Code Generation", and "Runtime Helper" modes.
3. **Minimal API**: Consistent dot-notation or path access experience across all languages.
