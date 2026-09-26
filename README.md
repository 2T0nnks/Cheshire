# Cheshire

**Física quântica, na prática.**

Minijogo educativo e open source para aprender computação e física quântica montando circuitos, medindo qubits e vendo a interferência acontecer. Fases curtas para públicos diferentes — de quem está só curioso até quem quer entender Grover.

> O Gato de Cheshire, de *Alice no País das Maravilhas*, some e deixa só o sorriso — e é o seu companheiro no jogo: comenta as jogadas, dá pistas e desaparece se você ficar parado. A física tem até um “gato de Cheshire quântico” (2013): uma partícula que parece passar por um caminho enquanto o seu spin passa por outro.

## Como funciona

Cada **fase** é uma sequência de passos, escrita num único arquivo JSON em `levels/`:

| Passo | O que o jogador faz |
|---|---|
| `story` | Lê um trecho curto de contexto ou explicação |
| `quiz` | Responde uma pergunta; cada alternativa explica o porquê |
| `circuit` | Monta um circuito para chegar a um estado-alvo, vendo barras de probabilidade (cor = fase) e esferas de Bloch em tempo real |
| `measure` | Mede um circuito 1×, 10×, 100× e vê a estatística surgir |
| `predict` | Chuta uma probabilidade antes de ver a resposta |
| `fact` | Uma curiosidade para lembrar depois |

Por baixo, `engine/quantum.js` é um simulador de vetor de estado (até 4 qubits) usado **tanto pelo jogo quanto pelo validador**: toda solução de referência roda no simulador antes de publicar, então nenhuma fase sai impossível.

### Públicos e trilhas

- 🌱 **Curioso(a)** — zero pré-requisito
- 📘 **Estudante** — ensino médio ou graduação
- 🚀 **Avançado** — devs e pesquisa

Trilhas: **Fundamentos** → **Circuitos** → **Fenômenos** → **Algoritmos e protocolos**.

Fases atuais: moeda quântica, gato de Schrödinger, quântico no dia a dia, esfera de Bloch, interferência, emaranhamento, fenda dupla, BB84, Deutsch, teletransporte e Grover (mais tunelamento e Shor “em breve”).

O **Gato de Cheshire** acompanha o jogador (dá para esconder na página Sobre). O jogo está em **português, español e English** (botão de idioma no topo; detecta o idioma do navegador). Há também um **laboratório livre** (sandbox com todas as portas e exemplos prontos) e um **glossário** (`content/glossary.json`).

## Idiomas

O português é o original. Espanhol e inglês ficam em `i18n/<idioma>/` (texto das fases e glossário) e em `engine/strings.js` (interface). Traduções só trocam texto — o validador impede que mexam na física. Veja a seção “Traduzindo” em [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md).

## Rodar localmente

```bash
npm install
npm test            # testes do simulador e do validador
npm run validate    # schema + física de todas as fases
npm run build       # gera dist/index.html + dist/fonts/
npm run dev         # build + servidor local em http://localhost:8000
npm run new         # cria o esqueleto de uma fase nova (status draft)
```

## Publicar no GitHub Pages

O workflow `.github/workflows/deploy.yml` roda testes, validação e build a cada push na `main` e publica `dist/` no Pages. Para ativar uma vez: **Settings → Pages → Build and deployment → Source: GitHub Actions**. O site fica em `https://2t0nnks.github.io/Cheshire/`.

## Privacidade e segurança

Um único HTML estático, sem backend e sem requisições a terceiros: as fontes são servidas do próprio domínio e a Content-Security-Policy só libera o script do motor (por hash). O progresso fica no `localStorage` do navegador. Texto das fases só aceita `<em>`, `<code>`, `<strong>` e `<br>` — o validador barra o resto.

## Contribuir

Leia [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) e o formato completo em [`docs/SCHEMA.md`](docs/SCHEMA.md).

## Licenças

- **Motor** (`engine/`, `scripts/`): [MIT](./LICENSE)
- **Fases, glossário e docs** (`levels/`, `content/`, `docs/`): [CC BY-SA 4.0](./LICENSE-CONTENT)
- Fontes (Space Grotesk, Atkinson Hyperlegible, JetBrains Mono): SIL OFL
