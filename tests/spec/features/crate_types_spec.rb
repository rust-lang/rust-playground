require 'spec_helper'
require 'support/editor'

RSpec.feature "Building ", type: :feature, js: true do
  before :each do
    visit '/'
  end

  scenario "when the crate is a library" do
    editor.set <<~EOF
      #![crate_type="lib"]
      fn main() {
          println!("Hello, world");
      }
    EOF
    click_on("Build")

    within('.output-stderr') do
      expect(page).to have_content 'function is never used: `main`'
    end
  end

  scenario "when the crate is a library with tests" do
    editor.set <<~EOF
      #![crate_type="lib"]
      pub fn add(a: u8, b: u8) -> u8 { a + b }

      #[test]
      fn test() {
          assert_eq!(add(1, 2), 3);
      }
    EOF
    click_on("Test")

    within('.output-stdout') do
      expect(page).to have_content 'running 1 test'
    end
  end

  def editor
    Editor.new(page)
  end
end
