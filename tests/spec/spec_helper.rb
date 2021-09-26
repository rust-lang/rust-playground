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
require 'capybara-screenshot/rspec'

ADDRESS = ENV.fetch('PLAYGROUND_UI_ADDRESS', '127.0.0.1')
PORT = ENV.fetch('PLAYGROUND_UI_PORT', '5000')

Capybara.register_driver :firefox do |app|
  Capybara::Selenium::Driver.load_selenium

  capture_js_log = ENV.fetch('CAPTURE_JS_LOG', 'false').casecmp?('true')
  Selenium::WebDriver.logger.level = :debug if capture_js_log

  options = {}
  options[:log_level] = :trace if capture_js_log

  browser_options = ::Selenium::WebDriver::Firefox::Options.new(options)
  browser_options.headless! if ENV.fetch('HEADLESS', 'true').casecmp?('true')
  browser_options.add_preference('devtools.console.stdout.content', true) if capture_js_log

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

Capybara::Screenshot.register_driver(:firefox) do |driver, path|
  driver.browser.save_screenshot(path)
end
Capybara.save_path = "./test-failures"

Capybara.modify_selector(:link_or_button) do
  expression_filter(:build_button) {|xpath, name| xpath[XPath.css('[data-test-id="button-menu-item__name"]').contains(name)] }
end

Capybara.add_selector(:header) do
  css { |_id| "[data-test-id = 'header']" }
end

Capybara.add_selector(:output) do
  css do |id|
    id_s = 'output'
    id_s += "-#{id}" if id
    "[data-test-id = '#{id_s}']"
  end
end
