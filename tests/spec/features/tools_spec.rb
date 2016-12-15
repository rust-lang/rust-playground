require 'spec_helper'
require 'support/editor'

RSpec.feature "Using third-party Rust tools", type: :feature, js: true do
  before { visit '/' }

  scenario "formatting code" do
    editor.set 'fn main() { [1,2,3,4]; }'
    within('.header') { click_on("Format") }

    within('#editor') do
      expect(editor).to have_line '[1, 2, 3, 4];'
    end
  end

  scenario "linting code with Clippy" do
    editor.set code_with_lint_warnings
    within('.header') { click_on("Clippy") }

    within(".output-stderr") do
      expect(page).to have_content 'warn(eq_op)'
      expect(page).to have_content 'warn(zero_divided_by_zero)'
    end
  end

  def code_with_lint_warnings
    <<~EOF
    fn main() {
        let a = 0.0 / 0.0;
        println!("NaN is {}", a);
    }
    EOF
  end

  def editor
    Editor.new(page)
  end
end
