import { Action, ActionType } from '../actions';

const DEFAULT: State = `
use sunscreen::{
    fhe_program,
    types::{bfv::Signed, Cipher},
    Compiler, Error, Runtime,
};

#[fhe_program(scheme = "bfv")]
fn simple_multiply(a: Cipher<Signed>, b: Cipher<Signed>) -> Cipher<Signed> {
    a * b
}

fn main() -> Result<(), Error> {
    let fhe_program = Compiler::with_fhe_program(simple_multiply).compile()?;

    let runtime = Runtime::new(&fhe_program.metadata.params)?;

    let (public_key, private_key) = runtime.generate_keys()?;

    let a = runtime.encrypt(Signed::from(15), &public_key)?;
    let b = runtime.encrypt(Signed::from(5), &public_key)?;

    let results = runtime.run(&fhe_program, vec![a, b], &public_key)?;

    let c: Signed = runtime.decrypt(&results[0], &private_key)?;

    assert_eq!(c, 75.into());

    let c: i64 = c.into();

    println!("Got {}", c);

    Ok(())
}
`;

export type State = string;

export default function code(state = DEFAULT, action: Action): State {
  switch (action.type) {
    case ActionType.RequestGistLoad:
      return '';
    case ActionType.GistLoadSucceeded:
      return action.code;

    case ActionType.EditCode:
      return action.code;

    case ActionType.AddMainFunction:
      return `${state}\n\n${DEFAULT}`;

    case ActionType.AddImport:
      return action.code + state;

    case ActionType.EnableFeatureGate:
      return `#![feature(${action.featureGate})]\n${state}`;

    case ActionType.FormatSucceeded:
      return action.code;

    default:
      return state;
  }
}
