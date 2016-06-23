require 'spec_helper'
require 'support/editor'

RSpec.feature "Formatting source code", type: :feature, js: true do
  before :each do
    visit '/'
  end

  scenario "formatting code" do
    editor.set 'fn main() { [1,2,3,4]; }'
    click_on("Format")

    within('#editor') do
      expect(editor).to have_line '[1, 2, 3, 4];'
    end
  end

  def editor
    Editor.new(page)
  end
end
