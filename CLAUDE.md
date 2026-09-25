# Cheshire — notas para agentes

- Fases: `levels/*.json` (schema em `schema/level.schema.json`, guia em `docs/`). Glossário: `content/glossary.json`.
- Motor: `engine/template.html` (UI, CSS, JS) + `engine/quantum.js` (simulador, compartilhado com o validador). `scripts/build.mjs` injeta tudo num único `dist/index.html` com CSP por hash — nunca use handlers inline nem scripts externos.
- Antes de commitar: `npm test && npm run validate && npm run build`.
- Textos da interface: `engine/strings.js` (pt, es, en — toda chave nova precisa existir nos três). Traduções das fases e do glossário: `i18n/<lang>/`; só texto, nunca física.
- Ao mudar texto de uma fase em `levels/`, atualize também `i18n/es/` e `i18n/en/`.
- Conteúdo original em pt-BR; precisão física acima de tudo.
