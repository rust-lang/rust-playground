RSpec::Matchers.define :have_line do |text|
  match do |editor|
    editor.has_line?(text)
  end

  match_when_negated do |editor|
    editor.has_no_line?(text)
  end

  description do
    "have line #{text.inspect}"
  end
end
