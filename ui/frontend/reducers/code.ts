import { Action, ActionType } from '../actions';

const DEFAULT: State = `
use sunscreen::{
  fhe_program,
  types::{bfv::Signed, Cipher},
  Ciphertext, CompiledFheProgram, Compiler, Error, FheProgramInput, Params, PrivateKey,
  PublicKey, Runtime,
};

const SQRT_DATABASE_SIZE: usize = 10;

#[fhe_program(scheme = "bfv")]
/// This program takes a user's query and looks up the entry in the database.
/// Queries are arrays containing a single 1 element at the
/// desired item's index and 0s elsewhere.
fn lookup(
  col_query: [Cipher<Signed>; SQRT_DATABASE_SIZE],
  row_query: [Cipher<Signed>; SQRT_DATABASE_SIZE],
  database: [[Signed; SQRT_DATABASE_SIZE]; SQRT_DATABASE_SIZE],
) -> Cipher<Signed> {
  // Safe Rust requires you initialize arrays with some value. Just put
  // put copies of col_query[0] and we'll overwrite them later.
  let mut col = [col_query[0]; SQRT_DATABASE_SIZE];

  // Perform matrix-vector multiplication with col_query to extract
  // Alice's desired column
  for i in 0..SQRT_DATABASE_SIZE {
      for j in 0..SQRT_DATABASE_SIZE {
          if j == 0 {
              col[i] = database[i][j] * col_query[j];
          } else {
              col[i] = col[i] + database[i][j] * col_query[j];
          }
      }
  }

  let mut sum = col[0] * row_query[0];

  // Dot product the result with the row query to get the result
  for i in 1..SQRT_DATABASE_SIZE {
      sum = sum + col[i] * row_query[i];
  }

  sum
}

/// This is the server that processes Alice's query.
struct Server {
  /// The compiled database query program
  pub compiled_lookup: CompiledFheProgram,

  /// The server's runtime
  runtime: Runtime,
}

impl Server {
  pub fn setup() -> Result<Server, Error> {
      let compiled_lookup = Compiler::with_fhe_program(lookup).compile()?;

      let runtime = Runtime::new(&compiled_lookup.metadata.params)?;

      Ok(Server {
          compiled_lookup,
          runtime,
      })
  }

  pub fn run_query(
      &self,
      col_query: Ciphertext,
      row_query: Ciphertext,
      public_key: &PublicKey,
  ) -> Result<Ciphertext, Error> {
      // Our database will consist of values between 400 and 500.
      let mut database = [[Signed::from(0); SQRT_DATABASE_SIZE]; SQRT_DATABASE_SIZE];
      let mut val = Signed::from(400);

      for i in 0..SQRT_DATABASE_SIZE {
          for j in 0..SQRT_DATABASE_SIZE {
              database[i][j] = val;
              val = val + 1;
          }
      }

      let args: Vec<FheProgramInput> = vec![col_query.into(), row_query.into(), database.into()];

      let results = self.runtime.run(&self.compiled_lookup, args, public_key)?;

      Ok(results[0].clone())
  }
}

/// Alice is a party that wants to look up a value in the database without
/// revealing what she looked up.
struct Alice {
  /// Alice's public key
  pub public_key: PublicKey,

  /// Alice's private key
  private_key: PrivateKey,

  /// Alice's runtime
  runtime: Runtime,
}

impl Alice {
  pub fn setup(params: &Params) -> Result<Alice, Error> {
      let runtime = Runtime::new(params)?;

      let (public_key, private_key) = runtime.generate_keys()?;

      Ok(Alice {
          public_key,
          private_key,
          runtime,
      })
  }

  pub fn create_query(&self, index: usize) -> Result<(Ciphertext, Ciphertext), Error> {
      let col = index % SQRT_DATABASE_SIZE;
      let row = index / SQRT_DATABASE_SIZE;

      let mut col_query = [Signed::from(0); SQRT_DATABASE_SIZE];
      let mut row_query = [Signed::from(0); SQRT_DATABASE_SIZE];
      col_query[col] = Signed::from(1);
      row_query[row] = Signed::from(1);

      Ok((
          self.runtime.encrypt(col_query, &self.public_key)?,
          self.runtime.encrypt(row_query, &self.public_key)?,
      ))
  }

  pub fn check_response(&self, value: Ciphertext) -> Result<(), Error> {
      let value: Signed = self.runtime.decrypt(&value, &self.private_key)?;

      let value: i64 = value.into();

      println!("Alice received {}", value);
      assert_eq!(value, 494);

      Ok(())
  }
}

fn main() -> Result<(), Error> {
  // Set up the database
  let server = Server::setup()?;

  // Alice sets herself up. The FHE scheme parameters are public to the
  // protocol, so Alice has them.
  let alice = Alice::setup(&server.compiled_lookup.metadata.params)?;

  let (col_query, row_query) = alice.create_query(94)?;

  let response = server.run_query(col_query, row_query, &alice.public_key)?;

  alice.check_response(response)?;

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
