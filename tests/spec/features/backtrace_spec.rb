require 'spec_helper'
require 'support/editor'

RSpec.feature "A backtrace is shown for certain errors", type: :feature, js: true do
  before { pending "Backtracing has a large performance penalty" }

  before do
    visit '/'
    editor.set(code)
    within('.header') { click_on("Run") }
  end

  scenario "a stack trace is shown" do
    within('.output-stderr') do
      expect(page).to have_content 'stack backtrace:'
      expect(page).to have_content 'rust_begin_unwind'
    end
  end

  scenario "filenames link to that line of code" do
    within('.output-stderr') do
      expect(page).to have_link('main.rs:2')
      expect(page).to have_link('main.rs:6')
    end
  end

  def editor
    Editor.new(page)
  end

  def code
    <<~EOF
    fn trigger_the_problem() {
        None::<u8>.unwrap();
    }

    fn main() {
        trigger_the_problem()
    }
    EOF
  end
end
