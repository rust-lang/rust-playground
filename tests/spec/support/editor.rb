class Editor
  attr_reader :page
  def initialize(page)
    @page = page
  end

  def set(text)
    page.within("#editor") do
      page.find('.ace_text-input', visible: false).set(text)
    end
  end

  def has_line?(text)
    page.has_css? '.ace_line', text: text
  end
end
