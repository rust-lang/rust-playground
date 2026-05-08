require 'spec_helper'
require 'support/playground_actions'

RSpec.feature "Interacting with the file tree", type: :feature, js: true do
  include PlaygroundActions

  before do
    visit "/"
    in_config_menu { choose('multiple') }
  end

  scenario "creating a new file" do
    within :filetree do
      create_file('src/awesome.rs')

      expect(page).to have_button('src/awesome.rs')
    end
  end

  scenario "renaming a file" do
    within :filetree do
      create_file('src/junk.rs')

      find_button('src/junk.rs').double_click
      fill_in 'pathname', with: 'src/details/new_name.rs'
      click_on 'Rename file'

      expect(page).to have_button('src/details/new_name.rs')
      expect(page).to_not have_button('src/junk.rs')
    end
  end

  scenario "removing a file" do
    within :filetree do
      create_file('src/junk.rs')

      click_on 'src/junk.rs'
      click_on 'Remove selected file'
      click_on 'Remove File'

      expect(page).to_not have_button('src/junk.rs')
    end
  end

  scenario "renaming a directory" do
    within :filetree do
      create_file('src/a/x.rs')
      create_file('src/a/y/z.rs')
      create_file('src/b/k.rs')

      find_button('src/a').double_click
      fill_in 'pathname', with: 'src/b'
      click_on 'Rename directory'

      expect(page).to have_button('src/b/x.rs')
      expect(page).to have_button('src/b/y/z.rs')
      expect(page).to have_button('src/b/k.rs')

      expect(page).to_not have_button('src/a/x.rs')
      expect(page).to_not have_button('src/a/y/z.rs')
    end
  end

  scenario "removing a directory" do
    within :filetree do
      create_file('src/a/x.rs')
      create_file('src/a/y/z.rs')
      create_file('src/b/k.rs')

      click_on 'src/a'
      click_on 'Remove selected directory'
      click_on 'Remove Directory'

      expect(page).to_not have_button('src/a/x.rs')
      expect(page).to_not have_button('src/a/y/z.rs')
      expect(page).to have_button('src/b/k.rs')
    end
  end

  scenario "triggering a validation error" do
    within :filetree do
      create_file('..')

      expect(page).to_not have_button('..')
      expect(page).to have_text('May not create path components starting with a dot')
    end
  end

  def create_file(name)
    click_on 'Create file'
    fill_in 'pathname', with: name
    click_on 'Create new file'
  end
end
