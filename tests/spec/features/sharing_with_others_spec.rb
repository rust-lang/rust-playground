require 'spec_helper'
require 'support/editor'
require 'support/file_tree'
require 'support/matchers/be_at_url'
require 'support/playground_actions'

RSpec.feature "Sharing the code with others", :gist, type: :feature, js: true do
  include PlaygroundActions

  before { visit '/' }

  # This test does more than one thing so we can avoid sending too
  # many requests to GitHub
  scenario "saving to a Gist" do
    editor.set(<<~CODE)
      // This code was saved by an automated test for the Rust Playground
    CODE

    in_channel_menu { click_on("Nightly") }
    in_mode_menu { click_on("Release") }
    in_advanced_options_menu { select("2018") }

    within(:header) { click_on 'Share' }

    # Save the links before we navigate away
    perma_link = find_link("Permalink to the playground")[:href]
    direct_link = find_link("Direct link to the gist")[:href]
    urlo_link = find_link("Open a new thread in the Rust user forum")[:href]

    # Have we automatically added the gist to our URL?
    gist_id = Addressable::URI.parse(perma_link).query_values['gist']
    expect(page).to be_at_url('/', gist: gist_id)

    # Navigate away so we can tell that we go back to the same page
    visit 'about:blank'

    visit perma_link
    expect(page).to have_link("Permalink to the playground")
    expect(editor).to have_line 'automated test'
    expect(perma_link).to match(/mode=release/)
    expect(perma_link).to match(/version=nightly/)
    expect(perma_link).to match(/edition=2018/)

    visit direct_link
    expect(page).to have_content 'All gists'
    expect(page).to have_content 'GitHub, Inc.'

    # Need to be logged in to URLO for this link to work
    expect(urlo_link).to match(%r{https://users.rust-lang.org/new-topic})
    expect(urlo_link).to include('automated+test')
  end

  # This test does more than one thing so we can avoid sending too
  # many requests to GitHub
  scenario "saving a multi-file Gist and restoring it" do
    in_config_menu { choose('multiple') }

    filetree.select 'src/main.rs'
    editor.set(<<~CODE)
      mod utils;

      fn main() {
          println!("{}", utils::greet());
      }
    CODE

    filetree.create_file 'src/utils.rs'
    editor.set(<<~CODE)
      pub fn greet() -> &'static str {
          "Hello from multi-file!"
      }
    CODE

    # Save to gist
    within(:header) { click_on 'Share' }

    perma_link = find_link("Permalink to the playground")[:href]

    # Navigate away so we can tell that we go back to the same page
    visit 'about:blank'

    visit perma_link

    filetree.select 'src/main.rs'
    expect(editor).to have_line 'mod utils;'
    expect(editor).to have_line 'println!("{}", utils::greet());'

    filetree.select 'src/utils.rs'
    expect(editor).to have_line 'pub fn greet()'
    expect(editor).to have_line '"Hello from multi-file!"'
  end

  def editor
    Editor.new(page)
  end

  def filetree
    FileTree.new(page)
  end
end
