package i18n

import java.text.MessageFormat

/**
 * i18nt Kotlin Helper Class
 */
class I18nt(private val data: Any?) {

    /**
     * 支持点分路径访问：t("auth.login")
     */
    fun t(path: String, params: Map<String, Any>? = null): String {
        val parts = path.split(".")
        var current: Any? = data
        
        for (part in parts) {
            current = (current as? Map<*, *>)?.get(part)
            if (current == null) return "[$path]"
        }

        return format(current, params) ?: "[$path]"
    }

    /**
     * 支持方括号访问：t["auth"]["login"]
     */
    operator fun get(key: String): I18nt {
        val subData = (data as? Map<*, *>)?.get(key)
        return I18nt(subData)
    }

    /**
     * 直接调用对象获取字符串：t["key"].toString()
     */
    override fun toString(): String {
        return (data as? String) ?: ""
    }

    private fun format(template: Any?, params: Map<String, Any>?): String? {
        if (template !is String) return template?.toString()
        if (params == null) return template

        var result = template
        val values = mutableListOf<Any>()
        params.entries.forEachIndexed { index, entry ->
            result = result.replace("{${entry.key}}", "{$index}")
            values.add(entry.value)
        }
        
        return try {
            MessageFormat.format(result, *values.toTypedArray())
        } catch (e: Exception) {
            result
        }
    }
}

/**
 * 扩展函数：让 Map 直接支持 I18nt 转换
 */
fun Map<String, Any>.asI18n() = I18nt(this)
