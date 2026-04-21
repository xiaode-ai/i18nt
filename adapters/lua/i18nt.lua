local I18nt = {}
I18nt.__index = function(self, key)
    local val = rawget(self, "_data")[key]
    if type(val) == "table" then
        return setmetatable({ _data = val }, I18nt)
    end
    return val or ("[" .. key .. "]")
end

-- 支持调用进行插值：t.welcome({ name = "Antigravity" })
I18nt.__call = function(self, params)
    local text = rawget(self, "_data")
    if type(text) ~= "string" then return tostring(text) end
    
    if params then
        for k, v in pairs(params) do
            text = text:gsub("{" .. k .. "}", tostring(v))
        end
    end
    return text
end

function I18nt.new(data)
    return setmetatable({ _data = data }, I18nt)
end

return I18nt
