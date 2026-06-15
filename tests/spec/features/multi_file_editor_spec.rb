require 'spec_helper'
require 'support/editor'
require 'support/file_tree'
require 'support/matchers/editor'
require 'support/playground_actions'

RSpec.feature "Multi-file editor interaction", type: :feature, js: true do
  include PlaygroundActions

  before do
    visit '/'
  end

  scenario "editing and running multiple files" do
    in_config_menu { choose('multiple') }

    filetree.select 'src/main.rs'
    editor.set(<<~CODE)
      mod utils;

      fn main() {
          println!("Hello to the whole {}", utils::greeting());
      }
    CODE

    filetree.create_file 'src/utils.rs'
    editor.set(<<~CODE)
      pub fn greeting() -> &'static str {
          "world"
      }
    CODE

    # Verify both files retain their content
    filetree.select 'src/main.rs'
    expect(editor).to have_line 'mod utils;'
    expect(editor).to_not have_line 'pub fn greeting()'

    filetree.select 'src/utils.rs'
    expect(editor).to have_line 'pub fn greeting()'
    expect(editor).to_not have_line 'mod utils;'

    # And that the files are transferred to the server
    click_on "Run"

    within(:output, :stdout) do
      expect(page).to have_content 'Hello to the whole world'
    end
  end

  scenario "toggling from single to multi-file view preserves contents" do
    editor.set(<<~CODE)
      fn main() {
          println!("From a single file");
      }
    CODE

    in_config_menu { choose('multiple') }

    # The original code had a `main` function, so should be in main.rs
    filetree.select 'src/main.rs'

    expect(editor).to have_line 'println!("From a single file")'
  end

  scenario "toggling from multi-file to single view preserves contents" do
    in_config_menu { choose('multiple') }

    filetree.select 'src/main.rs'
    editor.set('// Main file content')

    filetree.create_file 'src/helper.rs'
    editor.set('// Helper module content')

    # Toggle back to single-file mode
    in_config_menu { choose('single') }

    # The content should be preserved
    expect(editor).to have_line '// src/main.rs'
    expect(editor).to have_line '// Main file content'
    expect(editor).to have_line '// src/helper.rs'
    expect(editor).to have_line '// Helper module content'
  end

  def editor
    Editor.new(page)
  end

  def filetree
    FileTree.new(page)
  end
end
