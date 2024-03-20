// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

use clap::{Arg, ArgAction, ArgMatches, Command};
use tracing::warn;

#[derive(Debug)]
pub struct CliParams {
  pub dev_mode: bool,
}

pub fn get() -> CliParams {
  let clap: ArgMatches = Command::new("Toolbi API CLI")
    .arg(
      Arg::new("dev_mode")
        .long("dev")
        .short('d')
        .action(ArgAction::SetTrue)
        .help("Runs the API on development mode"),
    )
    .get_matches();

  let dev_mode: bool = {
    let value: bool = clap
      .get_one::<bool>("dev_mode")
      .unwrap_or(&false)
      .to_owned();
    if value {
      warn!(message = "Running on development mode.", category = "CLI")
    }
    value
  };

  CliParams { dev_mode }
}
