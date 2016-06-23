require 'spec_helper'
require 'support/editor'

RSpec.feature "Compiling to different formats", type: :feature, js: true do
  before :each do
    visit '/'
    editor.set(code)
  end

  scenario "compiling to LLVM IR" do
    click_on("LLVM IR")

    within('.output-code') do
      expect(page).to have_content 'ModuleID'
      expect(page).to have_content 'target datalayout'
      expect(page).to have_content 'target triple'
    end
  end

  def editor
    Editor.new(page)
  end

  def code
    <<-EOF
    fn main() {
        println!("Hello, world!");
    }
    EOF
  end
end
