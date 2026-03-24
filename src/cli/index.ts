#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("beacon")
  .description("AI-powered project health analyzer")
  .version("0.1.0");

program.parse(process.argv);
