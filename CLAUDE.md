# Bloch — notas para agentes

- Fases: `levels/*.json` (schema em `schema/level.schema.json`, guia em `docs/`). Glossário: `content/glossary.json`.
- Motor: `engine/template.html` (UI, CSS, JS) + `engine/quantum.js` (simulador, compartilhado com o validador). `scripts/build.mjs` injeta tudo num único `dist/index.html` com CSP por hash — nunca use handlers inline nem scripts externos.
- Antes de commitar: `npm test && npm run validate && npm run build`.
- Conteúdo em pt-BR; precisão física acima de tudo.
