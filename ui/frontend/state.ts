export default interface State {
  configuration: {
    shown: boolean,
    orientation: string,
  },
  output: {
    meta: {
      focus?: boolean,
    },
  },
}
