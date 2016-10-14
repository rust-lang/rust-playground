require 'spec_helper'
require 'support/editor'

RSpec.feature "Configuration by URL parameters", type: :feature, js: true do
  scenario "loading from a Gist" do
    visit '/?gist=20fb1e0475f890d0fdb7864e3ad0820c'

    expect(editor).to have_line 'This source code came from a Gist'
  end

  scenario "loading from a Gist preserves the links" do
    visit '/?gist=20fb1e0475f890d0fdb7864e3ad0820c'

    within('.output') { click_on 'Gist' }
    expect(page).to have_link("Permalink to the playground")
  end

  scenario "loading code directly from a parameter" do
    visit '/?code=fn%20main()%20%7B%0A%20%20%20%20println!(%22Hello%2C%20world!%22)%3B%0A%7D'

    expect(editor).to have_line 'println!("Hello, world!")'
  end

  def editor
    Editor.new(page)
  end
end
