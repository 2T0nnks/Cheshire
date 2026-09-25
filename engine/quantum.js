/**
 * quantum.js — a tiny state-vector simulator for up to 4 qubits.
 *
 * Shared by the engine (inlined into dist/index.html by scripts/build.mjs)
 * and by scripts/validate.mjs, which runs every level's reference solution
 * through it so no level ships unsolvable.
 *
 * Conventions
 *   - Wire 0 is drawn on top and is the LEFTMOST character of a basis label:
 *     with 2 qubits, "10" means q0 = 1 and q1 = 0.
 *   - Ops are short strings: "H 0", "CNOT 0 1" (control, target), "CZ 0 1",
 *     "SWAP 0 1". A trailing "@3" pins the op to column 3.
 */
(function (root) {
  "use strict";

  const S2 = Math.SQRT1_2;
  const EPS = 1e-9;

  // 2x2 complex matrices as [a, b, c, d], each entry [re, im].
  const SINGLE = {
    I: [[1, 0], [0, 0], [0, 0], [1, 0]],
    H: [[S2, 0], [S2, 0], [S2, 0], [-S2, 0]],
    X: [[0, 0], [1, 0], [1, 0], [0, 0]],
    Y: [[0, 0], [0, -1], [0, 1], [0, 0]],
    Z: [[1, 0], [0, 0], [0, 0], [-1, 0]],
    S: [[1, 0], [0, 0], [0, 0], [0, 1]],
    T: [[1, 0], [0, 0], [0, 0], [S2, S2]],
    SDG: [[1, 0], [0, 0], [0, 0], [0, -1]],
    TDG: [[1, 0], [0, 0], [0, 0], [S2, -S2]],
  };
  const DOUBLE = ["CNOT", "CZ", "SWAP"];
  const GATES = [...Object.keys(SINGLE).filter(g => g !== "I"), ...DOUBLE];
  const MAX_QUBITS = 4;

  function arity(gate) {
    return DOUBLE.includes(gate) ? 2 : 1;
  }

  /** Parses "CNOT 0 1 @2" into { gate, qubits: [0, 1], col: 2 }. */
  function parseOp(text) {
    const parts = String(text).trim().toUpperCase().split(/\s+/);
    let col = null;
    if (parts.length && parts[parts.length - 1].startsWith("@")) {
      col = Number(parts.pop().slice(1));
      if (!Number.isInteger(col) || col < 0) throw new Error(`bad column in "${text}"`);
    }
    const gate = parts.shift();
    if (!GATES.includes(gate)) throw new Error(`unknown gate "${gate}" in "${text}"`);
    const qubits = parts.map(Number);
    if (qubits.length !== arity(gate) || qubits.some(q => !Number.isInteger(q) || q < 0)) {
      throw new Error(`"${gate}" needs ${arity(gate)} qubit index(es) in "${text}"`);
    }
    if (qubits.length === 2 && qubits[0] === qubits[1]) throw new Error(`same qubit twice in "${text}"`);
    return { gate, qubits, col };
  }

  function formatOp(op) {
    return `${op.gate} ${op.qubits.join(" ")}`;
  }

  /** |basis⟩ for a label like "01". */
  function basisState(n, label) {
    const size = 1 << n;
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    const idx = label ? parseInt(label, 2) : 0;
    if (label && (label.length !== n || !/^[01]+$/.test(label))) {
      throw new Error(`initial state "${label}" must be ${n} bits`);
    }
    re[idx] = 1;
    return { n, re, im };
  }

  function clone(st) {
    return { n: st.n, re: Float64Array.from(st.re), im: Float64Array.from(st.im) };
  }

  // Bit mask of wire q (wire 0 is the most significant bit).
  function mask(n, q) {
    return 1 << (n - 1 - q);
  }

  function applySingle(st, q, m) {
    const { n, re, im } = st;
    const bit = mask(n, q);
    const [a, b, c, d] = m;
    for (let i = 0; i < re.length; i++) {
      if (i & bit) continue;
      const j = i | bit;
      const r0 = re[i], i0 = im[i], r1 = re[j], i1 = im[j];
      re[i] = a[0] * r0 - a[1] * i0 + b[0] * r1 - b[1] * i1;
      im[i] = a[0] * i0 + a[1] * r0 + b[0] * i1 + b[1] * r1;
      re[j] = c[0] * r0 - c[1] * i0 + d[0] * r1 - d[1] * i1;
      im[j] = c[0] * i0 + c[1] * r0 + d[0] * i1 + d[1] * r1;
    }
  }

  function applyOp(st, op) {
    const { n, re, im } = st;
    if (op.qubits.some(q => q >= n)) throw new Error(`${formatOp(op)}: qubit out of range (circuit has ${n})`);
    if (op.gate in SINGLE) return applySingle(st, op.qubits[0], SINGLE[op.gate]);
    const [p, q] = op.qubits;
    const bp = mask(n, p), bq = mask(n, q);
    for (let i = 0; i < re.length; i++) {
      if (op.gate === "CZ") {
        if ((i & bp) && (i & bq)) { re[i] = -re[i]; im[i] = -im[i]; }
      } else if (op.gate === "CNOT") {
        if ((i & bp) && !(i & bq)) swapAmp(re, im, i, i | bq);
      } else if (op.gate === "SWAP") {
        if ((i & bp) && !(i & bq)) swapAmp(re, im, i, (i & ~bp) | bq);
      }
    }
  }

  function swapAmp(re, im, i, j) {
    let t = re[i]; re[i] = re[j]; re[j] = t;
    t = im[i]; im[i] = im[j]; im[j] = t;
  }

  /**
   * Places ops into columns. Pinned ops ("@col") keep their column; the rest
   * go into the first column after the previous op on any of their wires.
   * Returns [{ gate, qubits, col, i }] sorted by column; i is the input index.
   */
  function layout(ops) {
    const placed = [];
    const busy = new Set();
    const key = (q, c) => `${q}:${c}`;
    const span = op => {
      const lo = Math.min(...op.qubits), hi = Math.max(...op.qubits);
      const out = [];
      for (let q = lo; q <= hi; q++) out.push(q);
      return out;
    };
    const frontier = {};
    ops.forEach((raw, i) => {
      const op = typeof raw === "string" ? parseOp(raw) : raw;
      const wires = span(op);
      let col = op.col;
      if (col == null) {
        col = Math.max(0, ...wires.map(q => frontier[q] ?? 0));
        while (wires.some(q => busy.has(key(q, col)))) col++;
      } else if (wires.some(q => busy.has(key(q, col)))) {
        throw new Error(`${formatOp(op)} @${col} overlaps another gate`);
      }
      wires.forEach(q => { busy.add(key(q, col)); frontier[q] = Math.max(frontier[q] ?? 0, col + 1); });
      placed.push({ gate: op.gate, qubits: op.qubits, col, i });
    });
    return placed.sort((a, b) => a.col - b.col);
  }

  /** Runs placed ops (any order within a column is fine) from |initial⟩. */
  function run(n, placed, initial) {
    const st = basisState(n, initial || "0".repeat(n));
    [...placed].sort((a, b) => a.col - b.col).forEach(op => applyOp(st, op));
    return st;
  }

  function probabilities(st) {
    const p = new Float64Array(st.re.length);
    for (let i = 0; i < p.length; i++) p[i] = st.re[i] ** 2 + st.im[i] ** 2;
    return p;
  }

  function label(n, i) {
    return i.toString(2).padStart(n, "0");
  }

  /** Probability that the measured bits match a pattern like "1x0" (x = any). */
  function patternProbability(st, pattern) {
    const p = probabilities(st);
    let total = 0;
    for (let i = 0; i < p.length; i++) {
      const bits = label(st.n, i);
      if ([...pattern].every((ch, k) => ch === "x" || ch === bits[k])) total += p[i];
    }
    return total;
  }

  /** Reduced density matrix of one wire: { p00, p11, re01, im01 }. */
  function reduced(st, q) {
    const { n, re, im } = st;
    const bit = mask(n, q);
    let p00 = 0, p11 = 0, re01 = 0, im01 = 0;
    for (let i = 0; i < re.length; i++) {
      if (i & bit) continue;
      const j = i | bit;
      p00 += re[i] ** 2 + im[i] ** 2;
      p11 += re[j] ** 2 + im[j] ** 2;
      // a_i * conj(a_j)
      re01 += re[i] * re[j] + im[i] * im[j];
      im01 += im[i] * re[j] - re[i] * im[j];
    }
    return { p00, p11, re01, im01 };
  }

  /** Bloch vector of one wire. Shrinks toward 0 when the wire is entangled. */
  function bloch(st, q) {
    const r = reduced(st, q);
    return { x: 2 * r.re01, y: -2 * r.im01, z: r.p00 - r.p11 };
  }

  /** Amplitude spec → complex vector. Values are numbers or [re, im]. */
  function vectorFrom(n, spec) {
    const size = 1 << n;
    const re = new Float64Array(size), im = new Float64Array(size);
    for (const [bits, v] of Object.entries(spec)) {
      if (bits.length !== n || !/^[01]+$/.test(bits)) throw new Error(`amplitude key "${bits}" must be ${n} bits`);
      const i = parseInt(bits, 2);
      if (Array.isArray(v)) { re[i] = v[0]; im[i] = v[1] || 0; } else { re[i] = v; }
    }
    let norm = 0;
    for (let i = 0; i < size; i++) norm += re[i] ** 2 + im[i] ** 2;
    norm = Math.sqrt(norm);
    if (norm < EPS) throw new Error("target state is all zeros");
    for (let i = 0; i < size; i++) { re[i] /= norm; im[i] /= norm; }
    return { n, re, im };
  }

  /** |⟨a|b⟩|² — 1 means same state up to a global phase. */
  function fidelity(a, b) {
    let r = 0, i = 0;
    for (let k = 0; k < a.re.length; k++) {
      r += a.re[k] * b.re[k] + a.im[k] * b.im[k];
      i += a.re[k] * b.im[k] - a.im[k] * b.re[k];
    }
    return r * r + i * i;
  }

  /** ⟨ψ|ρ_q|ψ⟩ for a single-wire target ψ. */
  function qubitFidelity(st, q, target) {
    const r = reduced(st, q);
    const [a0, b0] = [target.re[0], target.im[0]];
    const [a1, b1] = [target.re[1], target.im[1]];
    // conj(ψ0)ψ0 ρ00 + conj(ψ1)ψ1 ρ11 + 2 Re(conj(ψ0) ρ01 ψ1)
    const t0 = a0 * a0 + b0 * b0, t1 = a1 * a1 + b1 * b1;
    // conj(ψ0) * ψ1
    const cr = a0 * a1 + b0 * b1, ci = a0 * b1 - b0 * a1;
    const cross = cr * r.re01 - ci * r.im01;
    return t0 * r.p00 + t1 * r.p11 + 2 * cross;
  }

  /**
   * Checks a state against a level target. Returns
   *   { ok, score (0..1), probsMatch } — probsMatch helps explain "right
   *   probabilities, wrong phase".
   *
   * Target shapes:
   *   { "state": { "00": 0.7071, "11": 0.7071 } }        full state, any global phase
   *   { "probabilities": { "11": 1 } }                    measurement statistics only
   *   { "qubit": 2, "state": { "0": 1, "1": [0, 1] } }    one wire, whatever the rest do
   */
  function check(st, target, tol = 0.01) {
    if (target.qubit != null) {
      const t = vectorFrom(1, target.state);
      const f = qubitFidelity(st, target.qubit, t);
      const r = reduced(st, target.qubit);
      const probsMatch = Math.abs(r.p00 - (t.re[0] ** 2 + t.im[0] ** 2)) < tol;
      return { ok: f > 1 - tol, score: f, probsMatch };
    }
    const want = targetProbabilities(st.n, target);
    const got = probabilities(st);
    let dist = 0;
    for (let i = 0; i < got.length; i++) dist = Math.max(dist, Math.abs(got[i] - want[i]));
    const probsMatch = dist < tol;
    if (target.state) {
      const f = fidelity(st, vectorFrom(st.n, target.state));
      return { ok: f > 1 - tol, score: f, probsMatch };
    }
    return { ok: probsMatch, score: 1 - dist, probsMatch };
  }

  /** Target → per-basis probabilities (for drawing the ghost bars). */
  function targetProbabilities(n, target) {
    const size = 1 << n;
    const out = new Float64Array(size);
    if (target.qubit != null) return null;
    if (target.state) {
      const v = vectorFrom(n, target.state);
      for (let i = 0; i < size; i++) out[i] = v.re[i] ** 2 + v.im[i] ** 2;
      return out;
    }
    let sum = 0;
    for (const [bits, p] of Object.entries(target.probabilities || {})) {
      if (bits.length !== n || !/^[01]+$/.test(bits)) throw new Error(`probability key "${bits}" must be ${n} bits`);
      out[parseInt(bits, 2)] = p;
      sum += p;
    }
    if (Math.abs(sum - 1) > 0.01) throw new Error(`target probabilities sum to ${sum.toFixed(3)}, not 1`);
    return out;
  }

  /** One simulated measurement of every wire. rand() defaults to Math.random. */
  function sample(st, rand = Math.random) {
    const p = probabilities(st);
    let r = rand(), acc = 0;
    for (let i = 0; i < p.length; i++) {
      acc += p[i];
      if (r < acc) return label(st.n, i);
    }
    return label(st.n, p.length - 1);
  }

  root.Quantum = {
    GATES, MAX_QUBITS, arity, parseOp, formatOp, layout, run, basisState, clone, applyOp,
    probabilities, patternProbability, bloch, reduced, check, targetProbabilities,
    vectorFrom, fidelity, sample, label,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
