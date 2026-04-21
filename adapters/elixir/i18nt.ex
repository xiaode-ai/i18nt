defmodule I18nt do
  @doc """
  获取翻译文本并进行插值
  """
  def t(data, path, params \\ %{}) do
    keys = String.split(path, ".")
    val = get_in(data, keys)

    case val do
      nil -> "[#{path}]"
      str when is_binary(str) ->
        Enum.reduce(params, str, fn {k, v}, acc ->
          String.replace(acc, "{#{k}}", to_string(v))
        end)
      _ -> val
    end
  end
end
