export default interface State {
  configuration: {
    shown: boolean,
    orientation: string,
    channel: string,
    mode: string,
    theme: string,
    keybinding: string,
  },
  output: {
    meta: {
      focus?: boolean,
    },
  },
}
