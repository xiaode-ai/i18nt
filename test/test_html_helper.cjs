// 构造沙箱逻辑
const fs = require('fs');
const code = fs.readFileSync('adapters/html/i18nt-helper.js', 'utf8');

// 直接定义全局变量供 eval 使用
global.window = {};
global.document = {
    addEventListener: () => {},
    querySelectorAll: () => []
};

// 执行代码
eval(code);

const t = global.window.i18nt;
t.init({
  auth: { login: "Login Page" },
  common: { save: "Save Me" }
});

console.log("HTML Helper Path Test (auth.login):", t.get("auth.login"));
if (t.get("auth.login") === "Login Page") {
    console.log("HTML Helper logic passed!");
} else {
    console.log("HTML Helper logic failed!");
    process.exit(1);
}
t.init({
  auth: { login: "Login Page" },
  common: { save: "Save Me" }
});

console.log("HTML Helper Path Test (auth.login):", t.get("auth.login"));
if (t.get("auth.login") === "Login Page") {
    console.log("✅ HTML Helper logic passed!");
} else {
    console.log("❌ HTML Helper logic failed!");
    process.exit(1);
}
