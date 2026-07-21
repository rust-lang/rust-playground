class FileTree
  attr_reader :page
  def initialize(page)
    @page = page
  end

  def create_file(name)
    page.within(:filetree) do
      page.click_on 'Create file'
      page.fill_in 'pathname', with: name
      page.click_on 'Create new file'
    end
  end

  def select(name)
    page.within(:filetree) do
      page.click_on name
    end
  end
end
