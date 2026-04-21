package i18n;

import java.text.MessageFormat;
import java.util.Map;
import java.util.HashMap;

/**
 * i18nt Java Helper Class
 */
public class I18nt {
    private final Map<String, Object> data;

    public I18nt(Map<String, Object> data) {
        this.data = data;
    }

    /**
     * 获取翻译文本
     * @param path 点分路径，如 "auth.login.title"
     */
    public String t(String path) {
        return t(path, null);
    }

    /**
     * 获取翻译文本并进行插值
     * @param path 点分路径
     * @param params 插值参数
     */
    @SuppressWarnings("unchecked")
    public String t(String path, Map<String, Object> params) {
        String[] parts = path.split("\\.");
        Object current = data;
        
        for (String part : parts) {
            if (current instanceof Map) {
                current = ((Map<String, Object>) current).get(part);
            } else {
                return "[" + path + "]";
            }
        }

        if (current instanceof String) {
            String template = (String) current;
            if (params != null) {
                // 将 {name} 转换为 MessageFormat 兼容的 {0} 格式
                int i = 0;
                Object[] values = new Object[params.size()];
                for (Map.Entry<String, Object> entry : params.entrySet()) {
                    template = template.replace("{" + entry.getKey() + "}", "{" + i + "}");
                    values[i++] = entry.getValue();
                }
                return MessageFormat.format(template, values);
            }
            return template;
        }
        
        return current != null ? current.toString() : "[" + path + "]";
    }
}
