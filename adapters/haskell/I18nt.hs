module I18nt where

import Data.List (foldl')
import qualified Data.Map as Map

-- 简单的多层级查找，实际应用中建议使用更复杂的 Aeson 或专有数据结构
t :: Map.Map String Any -> String -> Map.Map String String -> String
t dataMap path params =
    let keys = splitOn '.' path
        val = findInMap dataMap keys
    in case val of
        Just str -> applyParams str params
        Nothing -> "[" ++ path ++ "]"

-- 占位符替换逻辑
applyParams :: String -> Map.Map String String -> String
applyParams template params = 
    Map.foldlWithKey (\acc k v -> replace ("{" ++ k ++ "}") v acc) template params

-- 辅助函数：替换字符串
replace :: String -> String -> String -> String
replace old new [] = []
replace old new s@(x:xs)
    | take (length old) s == old = new ++ replace old new (drop (length old) s)
    | otherwise = x : replace old new xs

-- 辅助函数：分割字符串
splitOn :: Char -> String -> [String]
splitOn _ "" = []
splitOn c s = 
    let (head, tail) = break (== c) s
    in head : case tail of
                [] -> []
                (_:t) -> splitOn c t

-- 查找逻辑 (Mock，实际需要更复杂的类型处理)
findInMap :: Map.Map String Any -> [String] -> Maybe String
findInMap _ [] = Nothing
findInMap m [k] = Just "Translation Result" -- 这里仅做结构演示
findInMap m (k:ks) = findInMap m ks
