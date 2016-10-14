require 'spec_helper'
require 'support/editor'

RSpec.feature "Highlighting the output", type: :feature, js: true do
  before :each do
    visit '/'
    editor.set(code)
    within('.header') { click_on("Run") }
  end

  scenario "errors are highlighted" do
    within('.output-stderr') do
      expect(page).to have_css '.error', text: 'unresolved name `println`'
      expect(page).to have_css '.error', text: 'aborting due to previous error'
      expect(page).to have_css '.error', text: 'Could not compile `playground`'
    end
  end

  scenario "error locations are links" do
    within('.output-stderr') do
      expect(page).to have_link('src/main.rs')
    end
  end

  scenario "error codes link to the error page" do
    within('.output-stderr') do
      expect(page).to have_link('E0425', href: /error-index.html#E0425/)
    end
  end

  def editor
    Editor.new(page)
  end

  def code
    <<-EOF
    fn main() {
        println("Hello, world!");
    }
    EOF
  end
end
