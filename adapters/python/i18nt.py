import json
import re
from datetime import datetime

class I18nt:
    """
    i18nt Python SDK - Minimal SSOT Runtime
    """
    def __init__(self, file_path_or_dict):
        if isinstance(file_path_or_dict, str):
            with open(file_path_or_dict, 'r', encoding='utf-8') as f:
                data = json.load(f)
        else:
            data = file_path_or_dict
            
        self.translations = data.get('translations', {})
        self.locale = data.get('language', 'en-US')

    def t(self, path, params=None):
        keys = path.split('.')
        val = self.translations
        for k in keys:
            if isinstance(val, dict) and k in val:
                val = val[k]
            else:
                return path
        
        if not isinstance(val, str):
            return path
            
        if params is None:
            params = {}

        return self._format_icu(val, params)

    def _format_icu(self, template, params):
        result = ""
        i = 0
        while i < len(template):
            if template[i] == '{':
                # Find matching }
                stack = 1
                j = i + 1
                while j < len(template) and stack > 0:
                    if template[j] == '{':
                        stack += 1
                    elif template[j] == '}':
                        stack -= 1
                    j += 1
                
                if stack == 0:
                    tag_content = template[i+1:j-1]
                    result += self._process_tag(tag_content, params)
                    i = j
                    continue
            
            result += template[i]
            i += 1
        return result

    def _process_tag(self, content, params):
        parts = [p.strip() for p in content.split(',', 2)]
        var_name = parts[0]
        
        if len(parts) == 1:
            return str(params.get(var_name, '{' + var_name + '}'))
        
        icu_type = parts[1]
        if icu_type in ('plural', 'selectordinal'):
            options_str = parts[2]
            count = float(params.get(var_name, 0))
            offset = 0
            # Simple offset extraction
            if 'offset:' in options_str:
                m = re.search(r'offset:\s*(\d+)', options_str)
                if m:
                    offset = int(m.group(1))
                    options_str = options_str.replace(m.group(0), '')
            
            val = count - offset
            options = self._parse_options(options_str)
            
            exact_key = '=' + str(int(count))
            res = options.get(exact_key)
            if res is None:
                # Basic cardinal rules
                rule = 'other'
                if icu_type == 'plural':
                    if count == 0:
                        rule = 'zero'
                    elif count == 1:
                        rule = 'one'
                res = options.get(rule, options.get('other', ''))
            
            return self._format_icu(res.replace('#', str(int(val))), params)
            
        elif icu_type == 'select':
            options_str = parts[2]
            val = str(params.get(var_name, 'other'))
            options = self._parse_options(options_str)
            res = options.get(val, options.get('other', ''))
            return self._format_icu(res, params)
            
        elif icu_type == 'number':
            val = params.get(var_name, 0)
            style = parts[2] if len(parts) > 2 else None
            if style == 'percent':
                return f"{float(val)*100:.0f}%"
            if style == 'currency':
                return f"${float(val):,.2f}"
            return f"{val:,}" if isinstance(val, (int, float)) else str(val)
            
        elif icu_type in ('date', 'time'):
            val = params.get(var_name)
            if not isinstance(val, datetime):
                try:
                    val = datetime.fromisoformat(str(val))
                except Exception:
                    val = datetime.now()
            style = parts[2] if len(parts) > 2 else 'short'
            if style == 'short':
                return val.strftime('%x')
            if style == 'long':
                return val.strftime('%B %d, %Y')
            return val.strftime('%Y-%m-%d %H:%M:%S')
            
        return '{' + content + '}'

    def _parse_options(self, options_str):
        options = {}
        i = 0
        while i < len(options_str):
            # Find key
            match = re.search(r'([^\s{]+)\s*\{', options_str[i:])
            if not match:
                break
            
            key = match.group(1)
            i += match.end()
            
            # Find matching }
            stack = 1
            start = i
            while i < len(options_str) and stack > 0:
                if options_str[i] == '{':
                    stack += 1
                elif options_str[i] == '}':
                    stack -= 1
                i += 1
            
            options[key] = options_str[start:i-1]
        return options

# Usage Example:
# i18n = I18nt('en-US.json')
# print(i18n.t('cart', {'count': 5}))
