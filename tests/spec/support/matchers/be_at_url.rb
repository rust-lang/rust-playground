RSpec::Matchers.define :be_at_url do |path, query = {}|
  match do |page|
    uri = URI::parse(page.current_url)
    expect(uri.path).to eql(path)

    query = query.map { |k, v| [k.to_s, Array(v).map(&:to_s)] }.to_h
    query_hash = CGI::parse(uri.query || '')
    expect(query_hash).to include(query)
  end

  failure_message do |page|
    "expected that #{page.current_url} would be #{path} with the query parameters #{query}"
  end
end
