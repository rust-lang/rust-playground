class Editor
  attr_reader :page
  def initialize(page)
    @page = page
  end

  def set(text)
    page.execute_script "ace.edit('editor').setValue(#{text.to_json})"
  end

  def has_line?(text)
    page.has_css? '.ace_line', text: text
  end
end
