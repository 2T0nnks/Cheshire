// The validator must reject levels that can't be solved or that leak markup.
import test from "node:test";
import assert from "node:assert/strict";
import { loadQuantum } from "./lib.mjs";
import { checkSteps, checkHtml } from "./validate.mjs";

const Q = await loadQuantum();
const level = step => ({ steps: [step], terms: [] });
const bell = {
  type: "circuit", title: "t", goal: "g", qubits: 2, gates: ["H", "CNOT"],
  target: { state: { "00": 1, "11": 1 } }, solution: ["H 0", "CNOT 0 1"],
};

test("a correct solution passes", () => {
  assert.deepEqual(checkSteps(Q, level(bell), {}), []);
});

test("a wrong solution is caught", () => {
  const errs = checkSteps(Q, level({ ...bell, solution: ["H 0"] }), {});
  assert.match(errs.join("\n"), /does NOT reach the target/);
});

test("solutions may only use the palette", () => {
  const errs = checkSteps(Q, level({ ...bell, gates: ["H"] }), {});
  assert.match(errs.join("\n"), /not in "gates"/);
});

test("a target already met by the fixed gates is caught", () => {
  const errs = checkSteps(Q, level({ ...bell, fixed: ["H 0 @0", "CNOT 0 1 @1"], solution: ["H 1 @2", "H 1 @3"] }), {});
  assert.match(errs.join("\n"), /already reached/);
});

test("quizzes need exactly one right answer", () => {
  const quiz = { type: "quiz", question: "q", options: [{ text: "a", why: "w" }, { text: "b", why: "w" }] };
  assert.match(checkSteps(Q, level(quiz), {}).join("\n"), /exactly one/);
});

test("only bare inline tags are allowed", () => {
  assert.equal(checkHtml({ a: "<em>ok</em> <code>|0⟩</code>" }).length, 0);
  assert.equal(checkHtml({ a: '<img src=x onerror="alert(1)">' }).length, 1);
  assert.equal(checkHtml({ a: '<a href="https://x">x</a>' }).length, 2);
});
