export default interface State {
  configuration: {
    shown: boolean,
    orientation: string,
    channel: string,
    mode: string,
  },
  output: {
    meta: {
      focus?: boolean,
    },
  },
}
