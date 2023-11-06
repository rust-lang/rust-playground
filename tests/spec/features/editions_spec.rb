require 'spec_helper'
require 'support/editor'
require 'support/playground_actions'

RSpec.feature "Multiple Rust editions", type: :feature, js: true do
  include PlaygroundActions

  before do
    visit '/'
    editor.set(rust_edition_code)
  end

  scenario "using the 2015 edition" do
    in_advanced_options_menu { select '2015' }
    click_on("Run")

    within(:output, :stderr) do
      expect(page).to have_content 'cannot find struct, variant or union type `async` in this scope'
    end
  end

  scenario "using the 2018 edition" do
    in_advanced_options_menu { select '2018' }
    click_on("Run")

    within(:output, :stderr) do
      expect(page).to have_content "thread 'main' panicked at src/main.rs:3:5"
    end
  end

  scenario "using the 2021 edition" do
    in_advanced_options_menu { select '2021' }
    click_on("Run")

    within(:output, :stderr) do
      expect(page).to have_content 'format argument must be a string literal', wait: 10
    end
  end

  scenario "using the 2024 edition" do
    editor.set <<-EOF
      #![feature(gen_blocks)]

      fn main() {
          let mut x = gen { yield 1 };

          eprintln!("{:?}", x.next());
          eprintln!("{:?}", x.next());
      }
    EOF

    in_advanced_options_menu { select '2024' }
    click_on("Run")

    within(:output, :stderr) do
      expect(page).to have_content 'Some(1)'
      expect(page).to have_content 'None'
    end
  end

  def editor
    Editor.new(page)
  end

  def rust_edition_code
    <<~EOF
    #![allow(non_fmt_panic)]
    fn main() {
        panic!(async {})
    }
    EOF
  end
end
