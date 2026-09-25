#!/usr/bin/env node
/**
 * validate.mjs — checks every level before it can ship.
 *
 *   1. JSON Schema (schema/level.schema.json)
 *   2. Markup allowlist (the engine renders level text with innerHTML)
 *   3. Physics: every circuit's reference `solution` is run through the same
 *      simulator the game uses and must reach the `target`; measure/predict
 *      circuits must be well-formed; glossary terms must exist.
 *
 * Exits non-zero on any failure. Used by `npm run validate` and CI.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { ROOT, GLOSSARY, loadQuantum, readLevels } from "./lib.mjs";

const SCHEMA = path.join(ROOT, "schema", "level.schema.json");

// Only bare inline formatting tags — no attributes, comments or other elements.
const ALLOWED_TAG = /^<\/?(em|code|strong)>$|^<br\s*\/?>$/i;
const MARKUP = /<[a-zA-Z\/!?][^>]*>?/g;

export function checkHtml(data) {
  const errors = [];
  (function walk(value, where) {
    if (typeof value === "string") {
      for (const m of value.matchAll(MARKUP)) {
        if (!ALLOWED_TAG.test(m[0])) {
          errors.push(`${where}: markup not allowed: ${JSON.stringify(m[0].slice(0, 60))} (only <em>, <code>, <strong>, <br> without attributes)`);
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${where}[${i}]`));
    } else if (value && typeof value === "object") {
      Object.entries(value).forEach(([k, v]) => walk(v, `${where}.${k}`));
    }
  })(data, "$");
  return errors;
}

/** Same default the engine uses when a circuit step has no `slots`. */
export function defaultSlots(Q, step) {
  const placed = Q.layout([...(step.fixed || []), ...(step.solution || [])]);
  const last = Math.max(-1, ...placed.map(p => p.col));
  return Math.max(4, last + 2);
}

export function checkSteps(Q, data, glossary) {
  const errors = [];
  const inRange = (ops, n, where) => {
    ops.forEach((raw, i) => {
      const op = Q.parseOp(raw);
      if (op.qubits.some(q => q >= n)) errors.push(`${where}[${i}] "${raw}": qubit out of range (step has ${n})`);
    });
  };

  data.steps.forEach((step, s) => {
    const at = `steps[${s}] (${step.type})`;
    try {
      const n = step.qubits;
      if (step.initial && step.initial.length !== n) errors.push(`${at}: initial "${step.initial}" must have ${n} bits`);
      if (step.wires && step.wires.length !== n) errors.push(`${at}: wires has ${step.wires.length} names for ${n} qubits`);

      if (step.type === "quiz") {
        const right = step.options.filter(o => o.correct).length;
        if (right !== 1) errors.push(`${at}: needs exactly one option with "correct": true (found ${right})`);
      }

      if (step.type === "circuit") {
        const fixed = step.fixed || [];
        inRange(fixed, n, `${at}.fixed`);
        inRange(step.solution, n, `${at}.solution`);
        if (step.target.qubit != null && step.target.qubit >= n) errors.push(`${at}: target.qubit out of range`);
        const tq = step.target.qubit != null ? 1 : n;
        Object.keys(step.target.state || step.target.probabilities).forEach(k => {
          if (k.length !== tq) errors.push(`${at}: target key "${k}" must have ${tq} bit(s)`);
        });
        if (errors.length) return;

        step.solution.forEach(raw => {
          const { gate } = Q.parseOp(raw);
          if (!step.gates.includes(gate)) errors.push(`${at}: solution uses ${gate}, which is not in "gates"`);
        });
        if (step.solution.length === 0) errors.push(`${at}: solution is empty — the player has nothing to do`);
        const two = step.gates.filter(g => Q.arity(g) === 2);
        if (two.length && n < 2) errors.push(`${at}: two-qubit gates need at least 2 qubits`);

        const placed = Q.layout([...fixed, ...step.solution]);
        const slots = step.slots ?? defaultSlots(Q, step);
        const over = placed.find(p => p.col >= slots);
        if (over) errors.push(`${at}: "${Q.formatOp(over)}" lands in column ${over.col}, but slots = ${slots}`);

        const result = Q.check(Q.run(n, placed, step.initial), step.target);
        if (!result.ok) {
          errors.push(`${at}: the reference solution does NOT reach the target (score ${result.score.toFixed(3)})`);
        }
        const start = Q.check(Q.run(n, Q.layout(fixed), step.initial), step.target);
        if (start.ok) errors.push(`${at}: target is already reached before the player places anything`);
      }

      if (step.type === "measure" || step.type === "predict") {
        inRange(step.circuit, n, `${at}.circuit`);
        Q.layout(step.circuit);
        if (step.type === "predict" && step.outcome.length !== n) {
          errors.push(`${at}: outcome "${step.outcome}" must have ${n} characters`);
        }
      }
    } catch (e) {
      errors.push(`${at}: ${e.message}`);
    }
  });

  (data.terms || []).forEach(t => {
    if (!glossary[t]) errors.push(`terms: "${t}" is not in content/glossary.json`);
  });
  return errors;
}

async function main() {
  const Q = await loadQuantum();
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(JSON.parse(await fs.readFile(SCHEMA, "utf-8")));

  let failed = 0;
  const glossary = JSON.parse(await fs.readFile(GLOSSARY, "utf-8"));
  const gErrors = checkHtml(glossary);
  Object.entries(glossary).forEach(([k, v]) => {
    if (!/^[a-z0-9-]+$/.test(k)) gErrors.push(`key "${k}" must be kebab-case`);
    if (!v || typeof v.term !== "string" || typeof v.short !== "string") gErrors.push(`"${k}" needs "term" and "short"`);
  });
  if (gErrors.length) {
    console.error("✗ content/glossary.json:");
    gErrors.forEach(e => console.error(`    ${e}`));
    failed++;
  } else {
    console.log(`✓ content/glossary.json (${Object.keys(glossary).length} termos)`);
  }

  const levels = await readLevels();
  if (levels.length === 0) {
    console.error("validate: no levels found in levels/");
    process.exit(1);
  }

  for (const { file, data } of levels) {
    if (!validate(data)) {
      console.error(`✗ levels/${file}: ${validate.errors.length} schema error(s)`);
      validate.errors.forEach(err => {
        console.error(`    ${err.instancePath || "/"}  ${err.message}${err.params ? "  " + JSON.stringify(err.params) : ""}`);
      });
      failed++;
      continue;
    }
    const errors = [...checkHtml(data)];
    if (data.slug !== file.replace(/\.json$/, "")) errors.push(`slug "${data.slug}" does not match filename`);
    // "soon" levels are placeholders: only the catalog fields need to be right.
    if (data.status === "open") errors.push(...checkSteps(Q, data, glossary));
    if (errors.length) {
      console.error(`✗ levels/${file}:`);
      errors.forEach(e => console.error(`    ${e}`));
      failed++;
      continue;
    }
    console.log(`✓ levels/${file}`);
  }

  if (failed > 0) {
    console.error(`\nvalidate: ${failed} file(s) failed.`);
    process.exit(1);
  }
  console.log(`\nvalidate: all ${levels.length} level(s) passed.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error("validate failed:", err);
    process.exit(1);
  });
}
