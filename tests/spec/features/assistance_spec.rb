require 'spec_helper'
require 'support/editor'
require 'support/playground_actions'

RSpec.feature "Editor assistance for common code modifications", type: :feature, js: true do
  include PlaygroundActions

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

  scenario "using an unstable feature offers adding the feature flag" do
    in_channel_menu { click_on("Nightly") }
    editor.set <<~EOF
      fn foo<const T: usize>() {}
    EOF
    click_on("Build")

    within('.output-stderr') do
      click_on("add `#![feature(const_generics)]`")
    end

    within('.editor') do
      expect(editor).to have_line '#![feature(const_generics)]'
    end
  end

  private

  def editor
    Editor.new(page)
  end
end
