require 'spec_helper'

RSpec.feature "Editing in different editors", type: :feature, js: true do
  before :each do
    visit '/'
  end

  scenario "using the simple editor" do
    click_on("Config")
    select("Simple")
    click_on("Done")

    fill_in('editor-simple', with: simple_editor_code)

    click_on("Run")

    expect(page).to_not have_css('.output-stderr')

    within('.output-stdout') do
      expect(page).to have_content 'simple editor'
    end
  end

  def simple_editor_code
    <<-EOF
    fn main() {
        println!("Using the simple editor");
    }
    EOF
  end
end
