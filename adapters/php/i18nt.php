<?php

class I18nt {
    private $data;
    private $path;

    public function __construct($data, $path = "") {
        $this->data = $data;
        $this->path = $path;
    }

    public function __get($name) {
        $subData = $this->data[$name] ?? null;
        return new I18nt($subData, $this->path ? "{$this->path}.$name" : $name);
    }

    public function t($params = []) {
        $target = $this->data;
        if (!is_string($target)) return (string)$target;
        foreach ($params as $k => $v) {
            $result = str_replace("{{$k}}", $v, $result);
        }
        return $result;
    }

    public static function load($filePath) {
        $translations = include($filePath);
        return new I18nt($translations);
    }

    public function __toString() {
        return is_string($this->data) ? $this->data : "";
    }
}
