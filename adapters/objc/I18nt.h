#import <Foundation/Foundation.h>

@interface I18nt : NSObject

@property (nonatomic, strong) NSDictionary *data;

- (instancetype)initWithData:(NSDictionary *)data;
- (NSString *)t:(NSString *)path params:(NSDictionary *)params;

@end

@implementation I18nt

- (instancetype)initWithData:(NSDictionary *)data {
    self = [super init];
    if (self) {
        _data = data;
    }
    return self;
}

- (NSString *)t:(NSString *)path params:(NSDictionary *)params {
    NSArray *keys = [path componentsSeparatedByString:@"."];
    id current = self.data;
    
    for (NSString *key in keys) {
        if ([current isKindOfClass:[NSDictionary class]]) {
            current = current[key];
        } else {
            return [NSString stringWithFormat:@"[%@]", path];
        }
    }
    
    if ([current isKindOfClass:[NSString class]]) {
        NSMutableString *res = [current mutableCopy];
        if (params) {
            for (NSString *key in params) {
                [res replaceOccurrencesOfString:[NSString stringWithFormat:@"{%@}", key]
                                     withString:[params[key] description]
                                        options:0
                                          range:NSMakeRange(0, res.length)];
            }
        }
        return res;
    }
    
    return [current description];
}

@end
