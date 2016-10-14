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
require 'capybara/poltergeist'
require 'capybara-screenshot/rspec'
require 'phantomjs'

ADDRESS = ENV.fetch('PLAYGROUND_UI_ADDRESS', '127.0.0.1')
PORT = ENV.fetch('PLAYGROUND_UI_PORT', '5000')

Capybara.register_driver :poltergeist do |app|
  Capybara::Poltergeist::Driver.new(app, phantomjs: Phantomjs.path)
end

Capybara.javascript_driver = :poltergeist
Capybara.app_host = "http://#{ADDRESS}:#{PORT}"
Capybara.run_server = false

RSpec.configure do |config|
  config.before do
    visit '/'
    page.execute_script 'localStorage.clear();'
  end
end
