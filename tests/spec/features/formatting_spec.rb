require 'spec_helper'
require 'support/editor'

RSpec.feature "Multiple Rust versions", type: :feature, js: true do
  # TODO: Automatically start server?

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
