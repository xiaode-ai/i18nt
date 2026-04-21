using System;
using System.Collections.Generic;
using System.Dynamic;

namespace I18nt {
    public class I18n : DynamicObject {
        private readonly IDictionary<string, object> _data;

        public I18n(IDictionary<string, object> data) {
            _data = data;
        }

        public override bool TryGetMember(GetMemberBinder binder, out object result) {
            if (_data.TryGetValue(binder.Name, out var value)) {
                if (value is IDictionary<string, object> dict) {
                    result = new I18n(dict);
                    return true;
                }
                result = value.ToString();
                return true;
            }
            result = $"[{binder.Name}]";
            return true;
        }

        public string T(string key, Dictionary<string, string> paramsMap = null) {
            if (!_data.TryGetValue(key, out var value)) return $"[{key}]";
            string template = value.ToString();
            if (paramsMap != null) {
                foreach (var param in paramsMap) {
                    template = template.Replace("{" + param.Key + "}", param.Value);
                }
            }
            return template;
        }
    }
}
