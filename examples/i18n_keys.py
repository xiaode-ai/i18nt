from typing import Any, Dict, Optional

class I18nKeys:
    def __init__(self, i18n_instance):
        self._i18n = i18n_instance
    class CommonProxy:
        def __init__(self, i18n):
            self._i18n = i18n
        def login(self) -> str:
            return self._i18n.t("common.login")

        def logout(self) -> str:
            return self._i18n.t("common.logout")

        def save(self) -> str:
            return self._i18n.t("common.save")

        def cancel(self) -> str:
            return self._i18n.t("common.cancel")


    @property
    def common(self) -> 'CommonProxy':
        return self.CommonProxy(self._i18n)

    def count(self) -> str:
        return self._i18n.t("count")

    def notifications(self, count: Any) -> str:
        return self._i18n.t("notifications", {"count": count})

    def gender(self) -> str:
        return self._i18n.t("gender")

    def name(self) -> str:
        return self._i18n.t("name")

    def gender_greeting(self, gender: Any, name: Any) -> str:
        return self._i18n.t("gender_greeting", {"gender": gender, "name": name})

    def n(self) -> str:
        return self._i18n.t("n")

    def rank(self, n: Any) -> str:
        return self._i18n.t("rank", {"n": n})

    def var(self) -> str:
        return self._i18n.t("var")

    def welcome(self, name: Any) -> str:
        return self._i18n.t("welcome", {"name": name})

    def legal(self) -> str:
        return self._i18n.t("legal")

    def rtl_test(self) -> str:
        return self._i18n.t("rtl_test")


def get_keys(i18n_instance) -> I18nKeys:
    return I18nKeys(i18n_instance)
