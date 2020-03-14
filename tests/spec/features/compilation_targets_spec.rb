require 'spec_helper'
require 'support/editor'
require 'support/playground_actions'

RSpec.feature "Compiling to different formats", type: :feature, js: true do
  include PlaygroundActions

  before do
    visit '/'
    editor.set(code)
  end

  context "ignoring automatic primary actions" do
    before do
      code = <<~EOF
        #[test]
        fn a_test() { assert!(false); }
        fn main() { println!("Hello, world!"); }
      EOF
      editor.set(code)
    end

    scenario "choosing to run the code" do
      in_build_menu { click_on(build_button: "Run") }
      within('.output-stdout') do
        expect(page).to have_content 'Hello, world!'
      end
    end

    scenario "choosing to build the code" do
      in_build_menu { click_on(build_button: "Build") }
      within('.output-stderr') do
        expect(page).to have_content 'function is never used: `main`'
      end
    end

    scenario "choosing to test the code" do
      in_build_menu { click_on(build_button: "Test") }
      within('.output-stdout') do
        expect(page).to have_content "panicked at 'assertion failed: false'"
      end
    end
  end

  context "when AT&T syntax is selected" do
    before do
      in_config_menu { choose("AT&T") }
    end

    scenario "compiling to assembly" do
      in_build_menu { click_on("assembly") }

      within('.output-code') do
        # We demangle the symbols
        expect(page).to have_content 'playground::main:'

        expect(page).to have_content 'movq %rdi, %rax'
      end
    end
  end

  context "when Intel syntax is selected" do
    before do
      in_config_menu { choose("Intel") }
    end

    scenario "compiling to assembly" do
      in_build_menu { click_on("assembly") }

      within('.output-code') do
        # We demangle the symbols
        expect(page).to have_content 'playground::main:'

        expect(page).to have_content 'mov rax, rdi'
      end
    end
  end

  scenario "compiling to LLVM IR" do
    in_build_menu { click_on("LLVM IR") }

    within('.output-code') do
      expect(page).to have_content 'ModuleID'
      expect(page).to have_content 'target datalayout'
      expect(page).to have_content 'target triple'
    end
  end

  scenario "compiling to MIR" do
    in_build_menu { click_on("MIR") }

    within('.output-code') do
      expect(page).to have_content 'StorageLive'
      expect(page).to have_content 'StorageDead'
    end
  end

  scenario "compiling to WebAssembly" do
    in_build_menu { click_on("WASM") }

    within('.output-code') do
      expect(page).to have_content '(module'
      expect(page).to have_content '(block'
    end
  end

  context "when the code doesn't compile" do
    before { editor.set("fn main() {") }

    scenario "it shows the compilation error" do
      in_build_menu { click_on("MIR") }

      within('.output-stderr') do
        expect(page).to have_content 'an unclosed delimiter'
      end
    end
  end

  def editor
    Editor.new(page)
  end

  def code
    <<~EOF
    fn main() {
        println!("Hello, world!");
    }
    EOF
  end
end
