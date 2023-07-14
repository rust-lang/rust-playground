require 'spec_helper'
require 'support/editor'
require 'support/playground_actions'

RSpec.feature "Streaming interaction using WebSockets", type: :feature, js: true do
  include PlaygroundActions

  before do
    visit '/?features=true'
    editor.set(slow_output_code)
  end

  scenario "output comes when it is available" do
    click_on("Run")

    within(:output, :stdout) do
      expect(page).to have_content 'First'
      expect(page).to_not have_content 'Second'

      expect(page).to have_content 'Second', wait: 0.8
      expect(page).to_not have_content 'Third'

      expect(page).to have_content 'Third', wait: 0.8
    end
  end

  def editor
    Editor.new(page)
  end

  def slow_output_code
    <<~EOF
    use std::time::Duration;

    fn main() {
        println!("First");
        std::thread::sleep(Duration::from_millis(750));
        println!("Second");
        std::thread::sleep(Duration::from_millis(750));
        println!("Third");
    }
    EOF
  end
end
