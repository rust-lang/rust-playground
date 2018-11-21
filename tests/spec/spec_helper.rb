RSpec.configure do |config|
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end

  config.disable_monkey_patching!

  # We aren't really testing Ruby code, so let's assume the Ruby code
  # of the tests is good enough
  config.warnings = false

  if config.files_to_run.one?
    config.default_formatter = 'doc'
  end

  config.order = :random

  Kernel.srand config.seed
end

require 'capybara/rspec'
require 'webdrivers'

ADDRESS = ENV.fetch('PLAYGROUND_UI_ADDRESS', '127.0.0.1')
PORT = ENV.fetch('PLAYGROUND_UI_PORT', '5000')

Capybara.register_driver :firefox do |app|
  Capybara::Selenium::Driver.load_selenium

  browser_options = ::Selenium::WebDriver::Firefox::Options.new
  browser_options.headless! if ENV.fetch('HEADLESS', 'true').casecmp?('true')

  Capybara::Selenium::Driver.new(
    app,
    browser: :firefox,
    options: browser_options,
    clear_local_storage: true,
    clear_session_storage: true,
  )
end

Capybara.default_driver = Capybara.javascript_driver = :firefox
Capybara.app_host = "http://#{ADDRESS}:#{PORT}"
Capybara.run_server = false
Capybara.default_max_wait_time = 5
Capybara.automatic_label_click = true

Capybara.modify_selector(:link_or_button) do
  expression_filter(:build_button) {|xpath, name| xpath[XPath.css('.button-menu-item__name').contains(name)] }
end
