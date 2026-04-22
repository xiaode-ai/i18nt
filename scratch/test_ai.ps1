# i18nt AI Translation Test Script (PowerShell Version)
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   i18nt AI Translation Test Tool" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Confirm Provider FIRST
if (-not $env:I18NT_AI_PROVIDER) {
    Write-Host ""
    Write-Host "Please select your AI Provider:"
    Write-Host "[1] OpenAI (Default)"
    Write-Host "[2] Gemini"
    Write-Host "[3] DeepSeek"
    Write-Host "[4] Claude"
    Write-Host "[5] OpenRouter"
    $choice = Read-Host "Enter number [1-5]"
    
    switch ($choice) {
        "2" { 
            $env:I18NT_AI_PROVIDER = "gemini" 
            $env:I18NT_AI_API_HOST = "generativelanguage.googleapis.com"
            $env:I18NT_AI_API_PATH = "/v1beta/models/gemini-1.5-flash:generateContent"
        }
        "3" { 
            $env:I18NT_AI_PROVIDER = "deepseek" 
            $env:I18NT_AI_API_HOST = "api.deepseek.com"
            $env:I18NT_AI_API_PATH = "/v1/chat/completions"
            $env:I18NT_AI_MODEL = "deepseek-chat"
        }
        "4" {
            $env:I18NT_AI_PROVIDER = "claude"
            $env:I18NT_AI_API_HOST = "api.anthropic.com"
            $env:I18NT_AI_API_PATH = "/v1/messages"
            $env:I18NT_AI_MODEL = "claude-3-5-sonnet-20241022"
        }
        "5" {
            $env:I18NT_AI_PROVIDER = "openrouter"
            $env:I18NT_AI_API_HOST = "openrouter.ai"
            $env:I18NT_AI_API_PATH = "/api/v1/chat/completions"
            $env:I18NT_AI_MODEL = "google/gemini-flash-1.5"
        }
        Default { 
            $env:I18NT_AI_PROVIDER = "openai" 
        }
    }
}

# 2. Get API KEY SECOND
if (-not $env:I18NT_AI_API_KEY) {
    Write-Host ""
    Write-Host "[TIP] API Key not found for $($env:I18NT_AI_PROVIDER)." -ForegroundColor Yellow
    $inputKey = Read-Host "Please enter your API Key"
    if (-not $inputKey) {
        Write-Host "[ERROR] API Key cannot be empty." -ForegroundColor Red
        exit 1
    }
    $env:I18NT_AI_API_KEY = $inputKey
}

Write-Host ""
Write-Host "[Ready]" -ForegroundColor Green
Write-Host "- Provider: $($env:I18NT_AI_PROVIDER)"
Write-Host "- Target: examples/comprehensive-test.ts"
Write-Host ""
Write-Host "Translating... Please wait..." -ForegroundColor Cyan

# 3. Execute
bun bin/cli.js translate --input examples/comprehensive-test.ts

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[SUCCESS] Translation completed!" -ForegroundColor Green
    Write-Host "[Result] Check file: examples/comprehensive-test.ts" -ForegroundColor Gray
    
    # 引导保存配置
    Write-Host ""
    $save = Read-Host "Test successful! Do you want to save this config to .i18ntrc for future use? (Y/N)"
    if ($save -eq "Y" -or $save -eq "y") {
        Write-Host "Saving configuration..." -ForegroundColor Cyan
        bun bin/cli.js config set ai_provider $env:I18NT_AI_PROVIDER
        bun bin/cli.js config set ai_api_key $env:I18NT_AI_API_KEY
        if ($env:I18NT_AI_API_HOST) { bun bin/cli.js config set ai_api_host $env:I18NT_AI_API_HOST }
        if ($env:I18NT_AI_API_PATH) { bun bin/cli.js config set ai_api_path $env:I18NT_AI_API_PATH }
        if ($env:I18NT_AI_MODEL) { bun bin/cli.js config set ai_model $env:I18NT_AI_MODEL }
        Write-Host "Configuration saved successfully!" -ForegroundColor Green
    }
} else {
    Write-Host ""
    Write-Host "[FAILED] Something went wrong." -ForegroundColor Red
    Write-Host "Please check your API Key and network connection."
}

Write-Host ""
pause
