require 'spec_helper'
require 'support/editor'
require 'support/playground_actions'

RSpec.feature "Sharing the code with others", type: :feature, js: true do
  include PlaygroundActions

  before { visit '/' }

  # This test does more than one thing so we can avoid sending too
  # many requests to GitHub
  scenario "saving to a Gist" do
    editor.set(code)

    in_channel_menu { click_on("Beta") }
    in_mode_menu { click_on("Release") }

    within('.header') { click_on 'Share' }

    # Save the links before we navigate away
    perma_link = find_link("Permalink to the playground")[:href]
    direct_link = find_link("Direct link to the gist")[:href]

    # Navigate away so we can tell that we go back to the same page
    visit 'about:blank'

    visit perma_link
    expect(page).to have_link("Permalink to the playground")
    expect(editor).to have_line 'automated test'
    expect(perma_link).to match(/mode=release/)
    expect(perma_link).to match(/version=beta/)

    visit direct_link
    expect(page).to have_content 'All gists'
    expect(page).to have_content 'GitHub, Inc.'
  end

  def editor
    Editor.new(page)
  end

  def code
    <<~EOF
      // This code was saved by an automated test for the Rust Playground
    EOF
  end
end
