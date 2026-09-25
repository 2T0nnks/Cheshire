#!/usr/bin/env node
/**
 * new-level.mjs — scaffolds levels/<slug>.json from a few questions.
 *
 * Usage:  npm run new
 * or:     node scripts/new-level.mjs <slug>
 */

import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { LEVELS_DIR, readLevels } from "./lib.mjs";

async function ask(rl, q, def = "") {
  const ans = (await rl.question(`${q}${def ? ` [${def}]` : ""}: `)).trim();
  return ans || def;
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const slug = process.argv[2] || await ask(rl, "slug (kebab-case, vira a URL)", "nova-fase");
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(slug)) {
    console.error("slug: letras minúsculas, números e hífens");
    process.exit(1);
  }
  const target = path.join(LEVELS_DIR, `${slug}.json`);
  try { await fs.access(target); console.error(`levels/${slug}.json já existe`); process.exit(1); } catch { /* ok */ }

  const title = await ask(rl, "título (até 48 caracteres)");
  const subtitle = await ask(rl, "subtítulo (uma frase)");
  const track = await ask(rl, "trilha (fundamentos | circuitos | fenomenos | algoritmos)", "fundamentos");
  const audience = await ask(rl, "público (curioso | estudante | avancado)", "curioso");
  const icon = await ask(rl, "emoji", "✨");
  const author = await ask(rl, "seu usuário do GitHub", "");
  rl.close();

  const last = Math.max(0, ...(await readLevels()).map(l => l.data.order || 0));
  const skeleton = {
    slug, status: "draft", order: last + 1, title, subtitle, track, audience, icon,
    duration: "~8 min", tags: [], author, license: "CC-BY-SA-4.0",
    steps: [
      { type: "story", icon, title: "Abertura", body: ["Conte a história que motiva a fase em 2 ou 3 parágrafos curtos."] },
      {
        type: "quiz",
        question: "Uma pergunta que verifica a ideia principal?",
        options: [
          { text: "Alternativa certa", correct: true, why: "Por que está certa." },
          { text: "Distrator plausível", why: "Por que parece certa, mas não é." },
        ],
      },
      {
        type: "circuit", title: "Desafio", goal: "Descreva o alvo em uma frase.",
        qubits: 1, gates: ["H", "X"],
        target: { probabilities: { "0": 0.5, "1": 0.5 } },
        solution: ["H 0"],
        hints: ["Uma dica que empurra sem entregar."],
        success: "O que o jogador acabou de aprender.",
      },
      { type: "fact", icon: "💡", title: "Curiosidade", text: "Um fato surpreendente, com fonte.", source: "Autor et al., Revista (ano)." },
    ],
    takeaways: ["Uma ideia para levar."],
    terms: ["qubit"],
    further: [],
  };
  await fs.writeFile(target, JSON.stringify(skeleton, null, 2) + "\n");
  console.log(`\ncriado levels/${slug}.json (status: draft)`);
  console.log("edite, rode `npm run validate` e `npm run dev`, e troque para \"open\" quando estiver pronta.");
}

main();
