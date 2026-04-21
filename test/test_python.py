import sys
import os

# 将 adapters 目录加入路径
sys.path.append(os.path.abspath("adapters/python"))

from i18nt import I18n

def test_python_adapter():
    # 路径根据之前导出的位置
    test_file = "test/output/py/en-US.py"
    if not os.path.exists(test_file):
        print(f"Error: {test_file} not found")
        return

    t = I18n.load(test_file)
    
    # 测试嵌套访问
    save_text = t.cross_platform_test.common.save
    print(f"Nested Access (save): {save_text}")
    assert save_text == "Save"

    # 测试参数插值
    welcome_text = t.cross_platform_test.welcome(params={"name": "Antigravity"})
    print(f"Interpolation (welcome): {welcome_text}")
    assert welcome_text == "Welcome, Antigravity"

    print("✅ Python Adapter Test Passed!")

if __name__ == "__main__":
    test_python_adapter()
