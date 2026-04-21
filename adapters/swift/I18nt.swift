import Foundation

@dynamicMemberLookup
public class I18nt {
    private let data: [String: Any]
    
    public init(data: [String: Any]) {
        self.data = data
    }
    
    public subscript(dynamicMember member: String) -> I18nt {
        let subData = (data as? [String: Any])?[member]
        return I18nt(data: subData ?? [:])
    }
    
    public var value: String {
        return (data as? String) ?? ""
    }
    
    public func t(_ params: [String: Any] = [:]) -> String {
        guard let text = data as? String else { return "" }
        var result = text
        for (key, val) in params {
            result = result.replacingOccurrences(of: "{\(key)}", with: "\(val)")
        }
        return result
    }
    
    public static func load(jsonPath: String) -> I18nt? {
        guard let data = try? Data(contentsOf: URL(fileURLWithPath: jsonPath)),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let translations = json["translations"] as? [String: Any] else {
            return nil
        }
        return I18nt(data: translations)
    }
}
