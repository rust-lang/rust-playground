# coding: utf-8

require 'net/http'
require 'spec_helper'

RSpec.feature "JSON argument deserialization", type: :request do
  let(:evaluate_json_uri) { URI.join(Capybara.app_host, '/evaluate.json') }

  context "when the JSON data is malformed" do
    let(:body) { JSON.generate({}) }

    it "responds with a JSON error" do
      Net::HTTP.start(evaluate_json_uri.host, evaluate_json_uri.port) do |http|
        request = Net::HTTP::Post.new(evaluate_json_uri)
        request.body = body
        request['Content-Type'] = 'application/json'

        response = http.request(request)

        expect(response['Content-Type']).to eq('application/json')
        body = JSON.parse(response.body)
        expect(body['error']).to match('Unable to deserialize request')
      end
    end
  end

  context "when the data is not JSON" do
    let(:body) { 'lolhello' }

    it "responds with a JSON error" do
      Net::HTTP.start(evaluate_json_uri.host, evaluate_json_uri.port) do |http|
        request = Net::HTTP::Post.new(evaluate_json_uri)
        request.body = body
        request['Content-Type'] = 'text/plain'

        response = http.request(request)

        expect(response['Content-Type']).to eq('application/json')
        body = JSON.parse(response.body)
        expect(body['error']).to match('Unable to deserialize request')
      end
    end
  end
end
