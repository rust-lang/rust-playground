require 'spec_helper'
require 'support/editor'

RSpec.feature "Editor assistance for common code modifications", type: :feature, js: true do
  before { visit '/' }

  scenario "building code without a main method offers adding one" do
    editor.set <<~EOF
      fn example() {}
    EOF
    click_on("Build")

    within('.output-warning') do
      click_on("add a main function")
    end

    within('.editor') do
      expect(editor).to have_line 'println!("Hello, world!")'
    end
  end

  private

  def editor
    Editor.new(page)
  end
end
