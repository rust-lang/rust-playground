# coding: utf-8

require 'spec_helper'
require 'support/editor'

RSpec.feature "Configuration by URL parameters", type: :feature, js: true do
  RSpec::Matchers.define :have_mode do |expected|
    match do |actual|
      within actual.find_button("Mode — Choose the optimization level") do |page|
        expect(page).to have_text(expected)
      end
    end
  end

  RSpec::Matchers.define :have_channel do |expected|
    match do |actual|
      within actual.find_button("Channel — Choose the Rust version") do |page|
        expect(page).to have_text(expected)
      end
    end
  end

  scenario "loading from a Gist" do
    visit '/?gist=20fb1e0475f890d0fdb7864e3ad0820c'

    expect(editor).to have_line 'This source code came from a Gist'
  end

  scenario "loading from a Gist preserves the links" do
    visit '/?gist=20fb1e0475f890d0fdb7864e3ad0820c'

    within('.output') { click_on 'Share' }
    expect(page).to have_link("Permalink to the playground")
  end

  scenario "loading from a Gist with a channel preserves the channel" do
    visit '/?gist=20fb1e0475f890d0fdb7864e3ad0820c&version=beta'

    expect(page).to have_channel('Beta')
  end

  scenario "loading from a Gist with a mode preserves the mode" do
    visit '/?gist=20fb1e0475f890d0fdb7864e3ad0820c&mode=release'

    expect(page).to have_mode('Release')
  end

  scenario "loading code directly from a parameter" do
    visit '/?code=fn%20main()%20%7B%0A%20%20%20%20println!(%22Hello%2C%20world!%22)%3B%0A%7D'

    expect(editor).to have_line 'println!("Hello, world!")'
  end

  scenario "loading with a channel" do
    visit '/?version=nightly'

    expect(page).to have_channel('Nightly')
  end

  scenario "loading with a mode" do
    visit '/?mode=release'

    expect(page).to have_mode('Release')
  end

  def editor
    Editor.new(page)
  end
end
