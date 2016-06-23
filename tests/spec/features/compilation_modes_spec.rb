require 'spec_helper'
require 'support/editor'

RSpec.feature "Compiling in different modes", type: :feature, js: true do
  before :each do
    visit '/'
    editor.set(compilation_mode_code)
  end

  scenario "compiling in debug mode" do
    choose("Debug")
    click_on("Run")

    within('.output-stderr') do
      expect(page.text.strip).to be_empty
    end

    within('.output-stdout') do
      expect(page).to have_content 'Compiling in debug mode'
      expect(page).to_not have_content 'Compiling in release mode'
    end
  end

  scenario "compiling in release mode" do
    choose("Release")
    click_on("Run")

    within('.output-stdout') do
      expect(page).to_not have_content 'Compiling in debug mode'
      expect(page).to have_content 'Compiling in release mode'
    end
  end

  def editor
    Editor.new(page)
  end

  def compilation_mode_code
    <<-EOF
    #[cfg(debug_assertions)]
    fn main() {
        println!("Compiling in debug mode");
    }

    #[cfg(not(debug_assertions))]
    fn main() {
        println!("Compiling in release mode");
    }
    EOF
  end
end
