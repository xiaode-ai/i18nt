import 'dart:convert';
import 'package:flutter/services.dart';

class I18nt {
  final Map<String, dynamic> _data;

  I18nt(this._data);

  /// 静态加载方法，支持从 assets 加载 JSON
  static Future<I18nt> load(String path) async {
    final String content = await rootBundle.loadString(path);
    final data = json.decode(content);
    return I18nt(data['translations'] ?? {});
  }

  /// 使用点语法路径获取翻译
  String t(String path, [Map<String, dynamic>? params]) {
    List<String> parts = path.split('.');
    dynamic current = _data;

    for (var part in parts) {
      if (current is Map && current.containsKey(part)) {
        current = current[part];
      } else {
        return '[$path]';
      }
    }

    if (current is String) {
      String result = current;
      if (params != null) {
        params.forEach((key, value) {
          result = result.replaceAll('{$key}', value.toString());
        });
      }
      return result;
    }

    return current?.toString() ?? '[$path]';
  }

  /// 支持方括号语法：t['common']['save']
  dynamic operator [](String key) {
    var val = _data[key];
    if (val is Map<String, dynamic>) {
      return I18nt(val);
    }
    return val;
  }

  @override
  String toString() => _data.toString();
}
