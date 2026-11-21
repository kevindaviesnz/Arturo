// src/control/pipeline.ts

import { Worker } from "./workers";

// ---------------------------------------------
// Pipeline Type
// ---------------------------------------------

export type Pipeline<I, O> = (input: I) => Generator<any, O, any>;

// ---------------------------------------------
// Pipe Overloads (compile-time safety)
// ---------------------------------------------

export function pipe<A, B>(
  w1: Worker<A, B>
): Pipeline<A, B>;

export function pipe<A, B, C>(
  w1: Worker<A, B>,
  w2: Worker<B, C>
): Pipeline<A, C>;

export function pipe<A, B, C, D>(
  w1: Worker<A, B>,
  w2: Worker<B, C>,
  w3: Worker<C, D>
): Pipeline<A, D>;

export function pipe<A, B, C, D, E>(
  w1: Worker<A, B>,
  w2: Worker<B, C>,
  w3: Worker<C, D>,
  w4: Worker<D, E>
): Pipeline<A, E>;

// ---------------------------------------------
// Implementation (runtime)
// ---------------------------------------------

export function pipe(
  ...workers: readonly Worker<any, any>[]
): Pipeline<any, any> {
  return function* (input: any) {
    let current = input;

    for (const w of workers) {
      const gen = w.run(current);

      let result = gen.next();

      while (!result.done) {
        yield result.value;
        result = gen.next();
      }

      current = result.value;
    }

    return current;
  };
}