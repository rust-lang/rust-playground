module PlaygroundActions
  def choose_styled(label)
    find('label', text: label).click
  end
end
