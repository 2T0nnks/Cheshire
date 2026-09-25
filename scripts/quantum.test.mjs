// Unit tests for engine/quantum.js — run with `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { loadQuantum } from "./lib.mjs";

const Q = await loadQuantum();
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ""} expected ${b}, got ${a}`);

test("H makes a 50/50 superposition", () => {
  const st = Q.run(1, Q.layout(["H 0"]));
  const p = Q.probabilities(st);
  near(p[0], 0.5); near(p[1], 0.5);
  const b = Q.bloch(st, 0);
  near(b.x, 1); near(b.z, 0);
});

test("HH = I and HZH = X (interference)", () => {
  near(Q.probabilities(Q.run(1, Q.layout(["H 0", "H 0"])))[0], 1);
  near(Q.probabilities(Q.run(1, Q.layout(["H 0", "Z 0", "H 0"])))[1], 1);
});

test("wire 0 is the leftmost bit", () => {
  const st = Q.run(2, Q.layout(["X 0"]));
  near(Q.probabilities(st)[0b10], 1);
  near(Q.patternProbability(st, "1x"), 1);
});

test("Bell state: correlated outcomes, Bloch vectors shrink to zero", () => {
  const st = Q.run(2, Q.layout(["H 0", "CNOT 0 1"]));
  assert.ok(Q.check(st, { state: { "00": 1, "11": 1 } }).ok);
  assert.ok(!Q.check(st, { state: { "00": 1, "11": -1 } }).ok);
  assert.ok(Q.check(st, { state: { "00": 1, "11": -1 } }).probsMatch);
  const b = Q.bloch(st, 0);
  near(Math.hypot(b.x, b.y, b.z), 0);
});

test("S rotates |+⟩ to |+i⟩", () => {
  const b = Q.bloch(Q.run(1, Q.layout(["H 0", "S 0"])), 0);
  near(b.y, 1);
});

test("global phase is ignored by state targets", () => {
  const st = Q.run(1, Q.layout(["X 0", "Z 0"])); // -|1⟩
  assert.ok(Q.check(st, { state: { "1": 1 } }).ok);
});

test("teleportation moves q0's state to q2", () => {
  const ops = ["H 0 @0", "T 0 @1", "H 1 @0", "CNOT 1 2 @1",
    "CNOT 0 1", "H 0", "CNOT 1 2", "CZ 0 2"];
  const st = Q.run(3, Q.layout(ops));
  const target = { qubit: 2, state: { "0": 0.7071, "1": [0.5, 0.5] } };
  assert.ok(Q.check(st, target).ok);
  assert.ok(!Q.check(st, { qubit: 2, state: { "0": 1, "1": 1 } }).ok);
});

test("Grover on 2 qubits finds |11⟩ in one step", () => {
  const ops = ["H 0", "H 1", "CZ 0 1", "H 0", "H 1", "Z 0", "Z 1", "CZ 0 1", "H 0", "H 1"];
  near(Q.probabilities(Q.run(2, Q.layout(ops)))[3], 1);
});

test("layout honors pinned columns and packs the rest", () => {
  // Unpinned ops follow the previous op on their wires, in list order.
  const placed = Q.layout(["H 1 @0", "CNOT 0 1 @2", "H 0", "X 1 @1"]);
  assert.equal(placed.map(p => `${p.gate}${p.col}`).join(" "), "H0 X1 CNOT2 H3");
  assert.throws(() => Q.layout(["H 0 @1", "X 0 @1"]));
});

test("parseOp rejects nonsense", () => {
  assert.throws(() => Q.parseOp("FOO 0"));
  assert.throws(() => Q.parseOp("CNOT 0"));
  assert.throws(() => Q.parseOp("CZ 1 1"));
});

test("sample follows the distribution", () => {
  const st = Q.run(1, Q.layout(["H 0"]));
  assert.equal(Q.sample(st, () => 0.2), "0");
  assert.equal(Q.sample(st, () => 0.7), "1");
});
