require 'spec_helper'
require 'support/editor'

RSpec.feature "Highlighting the output", type: :feature, js: true do
  before do
    visit '/'
    editor.set(code)
    within('.header') { click_on("Run") }
  end

  scenario "errors are highlighted" do
    within('.output-stderr') do
      expect(page).to have_css '.error', text: 'wrong number of type arguments'
      expect(page).to have_css '.error', text: 'aborting due to 2 previous errors'
      expect(page).to have_css '.error', text: 'Could not compile `playground`'
    end
  end

  scenario "error locations are links" do
    within('.output-stderr') do
      expect(page).to have_link('src/main.rs')
    end
  end

  scenario "github see-issues are links" do
    within('.output-stderr') do
      expect(page).to have_link('see issue #27812', href: 'https://github.com/rust-lang/rust/issues/27812')
    end
  end

  scenario "error codes link to the error page" do
    within('.output-stderr') do
      expect(page).to have_link('E0107', href: /error-index.html#E0107/)
    end
  end

  def editor
    Editor.new(page)
  end

  def code
    <<~EOF
    extern crate syntax;

    fn main() {
        drop::<u8, u8>(1);
    }
    EOF
  end
end
