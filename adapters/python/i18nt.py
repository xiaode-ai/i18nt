class I18n:
    def __init__(self, data, path=""):
        self._data = data
        self._path = path

    def __getattr__(self, name):
        sub_data = self._data.get(name)
        if sub_data is None:
            return I18n({}, f"{self._path}.{name}" if self._path else name)
        return I18n(sub_data, f"{self._path}.{name}" if self._path else name)

    def __str__(self):
        return str(self._data) if isinstance(self._data, str) else ""

    def __repr__(self):
        return self.__str__()

    def __eq__(self, other):
        if isinstance(other, str):
            return self.__str__() == other
        return super().__eq__(other)

    def __call__(self, key=None, params=None):
        # 如果直接调用 t("key", params) 或 t.key(params)
        target = self._data.get(key) if key else self._data
        if not isinstance(target, str):
            return str(target)
        
        if params:
            # 简单的 ICU 变量替换 {name}
            for k, v in params.items():
                target = target.replace(f"{{{k}}}", str(v))
            # 处理 plural 逻辑 (简单模拟)
            if "{count, plural," in target:
                # 注意：这里仅做演示，复杂逻辑建议配合 python-babel
                pass
        return target

    @staticmethod
    def load(file_path):
        # 动态加载导出的 .py 字典文件
        namespace = {}
        with open(file_path, "r", encoding="utf-8") as f:
            exec(f.read(), namespace)
        return I18n(namespace.get("TRANSLATIONS", {}))
