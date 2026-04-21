#pragma once
#include <string>
#include <map>
#include <vector>
#include <regex>

namespace i18nt {

class I18n {
public:
    struct Node {
        std::string value;
        std::map<std::string, Node> children;
        bool is_leaf = false;
    };

    I18n(Node data) : data_(std::move(data)) {}

    std::string t(const std::string& path, const std::map<std::string, std::string>& params = {}) {
        const Node* current = &data_;
        size_t start = 0, end;
        
        while ((end = path.find('.', start)) != std::string::npos) {
            auto it = current->children.find(path.substr(start, end - start));
            if (it == current->children.end()) return "[" + path + "]";
            current = &it->second;
            start = end + 1;
        }
        
        auto it = current->children.find(path.substr(start));
        if (it == current->children.end() || !it->second.is_leaf) return "[" + path + "]";
        
        std::string result = it->second.value;
        for (const auto& [key, val] : params) {
            std::regex reg("\\{" + key + "\\}");
            result = std::regex_replace(result, reg, val);
        }
        return result;
    }

private:
    Node data_;
};

} // namespace i18nt
