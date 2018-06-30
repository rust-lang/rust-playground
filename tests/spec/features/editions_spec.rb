require 'spec_helper'
require 'support/editor'
require 'support/playground_actions'

RSpec.feature "Multiple Rust editions", type: :feature, js: true do
  include PlaygroundActions

  before do
    visit '/'
    editor.set(rust_2018_code)
  end

  scenario "using the 2015 channel" do
    in_advanced_options_menu { choose '2015' }
    click_on("Run")

    within('.output-stderr') do
      expect(page).to have_content '`crate` in paths is experimental'
    end
  end

  scenario "using the 2018 channel" do
    in_advanced_options_menu { choose '2018' }
    click_on("Run")

    within('.output-stderr') do
      expect(page).to_not have_content '`crate` in paths is experimental'
    end
  end

  def editor
    Editor.new(page)
  end

  def rust_2018_code
    <<~EOF
    mod foo {
        pub fn bar() {}
    }

    fn main() {
        crate::foo::bar();
    }
    EOF
  end
end
