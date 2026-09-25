# Formato de uma fase

O schema formal é `schema/level.schema.json`. Resumo:

```jsonc
{
  "slug": "minha-fase",            // igual ao nome do arquivo
  "status": "open",                // open | soon (aparece como “em breve”) | draft (fora do build)
  "order": 14,                     // posição no mapa
  "title": "Até 48 caracteres",
  "subtitle": "Uma frase que dá vontade de jogar.",
  "track": "circuitos",            // fundamentos | circuitos | fenomenos | algoritmos
  "audience": "estudante",         // curioso | estudante | avancado
  "icon": "🌀",
  "duration": "~8 min",
  "steps": [ /* passos, abaixo */ ],
  "takeaways": ["Frases para levar"],
  "terms": ["qubit", "fase"],      // chaves de content/glossary.json
  "further": [{ "title": "Leitura", "url": "https://…" }]
}
```

Textos aceitam só `<em>`, `<code>`, `<strong>` e `<br>`, sem atributos.

## Passos

### `story`
```json
{ "type": "story", "icon": "📦", "title": "…", "body": ["parágrafo", "parágrafo"], "aside": "nota opcional" }
```

### `fact`
```json
{ "type": "fact", "icon": "🛰️", "title": "…", "text": "…", "source": "Autor et al., Revista (ano)." }
```

### `quiz`
Exatamente uma alternativa com `"correct": true`. Acertar de primeira vale 1 ponto.
```json
{ "type": "quiz", "question": "…", "options": [
  { "text": "…", "correct": true, "why": "…" },
  { "text": "…", "why": "…" }
] }
```

### `circuit`
```json
{
  "type": "circuit",
  "title": "Crie um par de Bell",
  "goal": "O que o jogador precisa alcançar.",
  "qubits": 2,
  "wires": ["Alice", "Bob"],        // opcional
  "initial": "00",                  // opcional
  "slots": 4,                       // opcional; padrão = solução + 2 colunas (mín. 4)
  "gates": ["H", "X", "CNOT"],      // paleta
  "fixed": ["X 1 @0"],              // opcional: portas travadas
  "target": { "state": { "00": 1, "11": 1 } },
  "solution": ["H 0", "CNOT 0 1"],  // validada no simulador; define o “par” de portas
  "hints": ["…", "…"],
  "success": "Mensagem ao resolver."
}
```

Três tipos de alvo:

| Alvo | Quando usar |
|---|---|
| `{ "state": { "01": 1, "10": -1 } }` | O estado exato importa, inclusive fases relativas (a fase global é ignorada). Amplitudes são números ou `[real, imag]` e não precisam estar normalizadas. |
| `{ "probabilities": { "11": 1 } }` | Só as estatísticas de medição importam. |
| `{ "qubit": 2, "state": { "0": 1, "1": [0, 1] } }` | Só um fio importa (ex.: teletransporte), não importa o que os outros façam. |

Pontuação: resolver com ≤ portas da solução e sem dicas = 1; com dicas ou mais portas = ½; ver a solução = 0.

### `measure`
```json
{ "type": "measure", "title": "…", "body": "…", "qubits": 1, "circuit": ["H 0"], "minShots": 12, "after": "Aparece depois de minShots medições." }
```

### `predict`
`outcome` pode usar `x` para “tanto faz” (`"1x"` = q0 é 1). Erro ≤ 10 pontos percentuais vale 1; ≤ 25 vale ½.
```json
{ "type": "predict", "question": "…", "qubits": 1, "circuit": ["H 0", "H 0"], "outcome": "1", "explain": "…" }
```
