package i18n

// i18nt generated for en-US

type CommonStruct struct {
    Save string
    Cancel string
}

type AuthStruct struct {
    Login string
    Register string
}

type CrossPlatformTestStruct struct {
    Common CommonStruct
    Auth AuthStruct
}

type TranslationsStruct struct {
    CrossPlatformTest CrossPlatformTestStruct
}

var T = TranslationsStruct{
    CrossPlatformTest: CrossPlatformTestStruct{
        Common: CommonStruct{
            Save: "Save",
            Cancel: "Cancel",
        },
        Auth: AuthStruct{
            Login: "Login",
            Register: "Register",
        },
    },
}