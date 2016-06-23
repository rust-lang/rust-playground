require 'spec_helper'
require 'support/editor'

RSpec.feature "Running tests", type: :feature, js: true do
  before :each do
    visit '/'
  end

  scenario "when tests are present" do
    editor.set <<-EOF
      #[test]
      fn awesome() {}
    EOF
    click_on("Test")

    within('.output-stdout') do
      expect(page).to have_content 'running 1 test'
      expect(page).to have_content 'test awesome ... ok'
      expect(page).to have_content 'test result: ok'
      expect(page).to have_content '1 passed'
      expect(page).to have_content '0 failed'
    end
  end

  scenario "when tests and a main method are present" do
    editor.set <<-EOF
      #[test]
      fn awesome() {}

      fn main() {
          println!("Running in main");
      }
    EOF
    click_on("Build")

    within('.output-stdout') do
      expect(page).to_not have_content 'running 1 test'
      expect(page).to have_content 'Running in main'
    end
  end

  def editor
    Editor.new(page)
  end
end
