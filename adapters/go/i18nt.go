package i18nt

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
)

type I18nt struct {
	Translations map[string]interface{}
	Locale       string
}

func NewI18nt(filePath string) (*I18nt, error) {
	file, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var data struct {
		Language     string                 `json:"language"`
		Translations map[string]interface{} `json:"translations"`
	}

	if err := json.Unmarshal(file, &data); err != nil {
		return nil, err
	}

	return &I18nt{
		Translations: data.Translations,
		Locale:       data.Language,
	}, nil
}

func (i *I18nt) T(path string, params map[string]interface{}) string {
	keys := strings.Split(path, ".")
	var val interface{} = i.Translations

	for _, k := range keys {
		if m, ok := val.(map[string]interface{}); ok {
			val = m[k]
		} else {
			return path
		}
	}

	strVal, ok := val.(string)
	if !ok {
		return path
	}

	return i.formatICU(strVal, params)
}

func (i *I18nt) formatICU(template string, params map[string]interface{}) string {
	result := template

	// 1. Simple Variables: {name}
	for k, v := range params {
		result = strings.ReplaceAll(result, "{"+k+"}", fmt.Sprintf("%v", v))
	}

	// 2. Basic Plural: {count, plural, =0{...} other{...}}
	pluralRegex := regexp.MustCompile(`\{(\w+),\s*plural,\s*(.*?)\}`)
	result = pluralRegex.ReplaceAllStringFunc(result, func(m string) string {
		match := pluralRegex.FindStringSubmatch(m)
		varName := match[1]
		optionsStr := match[2]
		
		count := 0
		if c, ok := params[varName].(int); ok {
			count = c
		} else if c, ok := params[varName].(float64); ok {
			count = int(c)
		}

		options := parseOptions(optionsStr)
		exactKey := fmt.Sprintf("=%d", count)
		
		res, ok := options[exactKey]
		if !ok {
			res = options["other"]
		}

		return strings.ReplaceAll(res, "#", fmt.Sprintf("%d", count))
	})

	// 3. Select: {gender, select, male{...} female{...} other{...}}
	selectRegex := regexp.MustCompile(`\{(\w+),\s*select,\s*(.*?)\}`)
	result = selectRegex.ReplaceAllStringFunc(result, func(m string) string {
		match := selectRegex.FindStringSubmatch(m)
		varName := match[1]
		optionsStr := match[2]
		
		val := fmt.Sprintf("%v", params[varName])
		options := parseOptions(optionsStr)
		
		res, ok := options[val]
		if !ok {
			res = options["other"]
		}
		return res
	})

	return result
}

func parseOptions(s string) map[string]string {
	options := make(map[string]string)
	optRegex := regexp.MustCompile(`(=?\w+)\s*\{(.*?)\}`)
	matches := optRegex.FindAllStringSubmatch(s, -1)
	for _, m := range matches {
		options[m[1]] = m[2]
	}
	return options
}
