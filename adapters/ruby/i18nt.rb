module I18nt
  class I18n
    def initialize(data)
      @data = data
    end

    def method_missing(name, *args, &block)
      key = name.to_sym
      if @data.key?(key)
        value = @data[key]
        if value.is_a?(Hash)
          I18n.new(value)
        else
          # 如果有参数，进行插值
          params = args.first
          if params.is_a?(Hash)
            result = value.to_s
            params.each { |k, v| result.gsub!("{#{k}}", v.to_s) }
            result
          else
            value
          end
        end
      else
        "[#{name}]"
      end
    end

    def respond_to_missing?(name, include_private = false)
      @data.key?(name.to_sym) || super
    end

    def to_s
      @data.is_a?(Hash) ? "" : @data.to_s
    end
  end
end
