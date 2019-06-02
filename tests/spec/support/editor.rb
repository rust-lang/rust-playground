class Editor
  attr_reader :page
  def initialize(page)
    @page = page
  end

  def set(text)
    page.within('.editor .ace_text-input', visible: :any) do
      page.execute_script <<~JS
        window.rustPlayground.setCode(#{text.to_json});
      JS
    end
  end

  def has_line?(text)
    page.has_css? '.ace_line', text: text
  end
end
