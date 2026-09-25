# Contribuindo com uma fase

Uma fase é um arquivo JSON em `levels/`. Não precisa mexer no motor.

## Passo a passo

1. `npm install`
2. `npm run new` — responde algumas perguntas e cria `levels/<slug>.json` com `"status": "draft"` (drafts nunca vão para o site).
3. Edite o arquivo. O formato completo está em [SCHEMA.md](SCHEMA.md).
4. `npm run validate` — confere o schema, as tags permitidas e **roda a sua solução de cada desafio no simulador**.
5. `npm run dev` e jogue a fase em http://localhost:8000/?fase=<slug>.
6. Troque para `"status": "open"` e abra um pull request.

## O que faz uma fase boa

- **Uma ideia central.** 5 a 8 passos, 5 a 12 minutos.
- **Mão na massa cedo.** Um desafio, medição ou palpite até o terceiro passo.
- **Surpresa antes da explicação.** O `predict` funciona melhor quando a intuição clássica erra (duas H seguidas dão 0 com certeza!).
- **Toda alternativa de quiz ensina.** O `why` dos distratores é tão importante quanto o da certa.
- **Precisão acima de tudo.** Evite “o qubit é 0 e 1 ao mesmo tempo” sem ressalva. Cite a fonte de curiosidades (`source`).
- **Público certo.** `curioso` sem fórmula; `estudante` pode usar kets e ângulos; `avancado` pode falar de oráculos e fase.
- **Dicas em degraus.** A primeira empurra, a última quase entrega. Depois de todas, o jogo oferece a solução.
- **Texto curto.** Parágrafos de 1 a 3 frases. A tela é pequena e o jogador quer jogar.

## Convenções dos circuitos

- Fio 0 é o de cima e o **dígito mais à esquerda**: `"10"` significa q0 = 1, q1 = 0.
- Portas: `H X Y Z S T SDG TDG` (1 qubit) e `CNOT CZ SWAP` (2 qubits). `"CNOT 0 1"` = controle 0, alvo 1.
- `"@3"` no fim prende a porta na coluna 3. Sem `@`, a porta vai logo depois da anterior nos mesmos fios, na ordem da lista.
- Portas em `fixed` aparecem travadas; o jogador constrói ao redor delas.

# Traduzindo

O jogo fala português, espanhol e inglês. O português é o original; os outros idiomas são **camadas de texto** por cima dele.

| O quê | Onde |
|---|---|
| Textos da interface (botões, mensagens, falas do Gato, página Sobre) | `engine/strings.js`, um bloco por idioma |
| Texto das fases | `i18n/<idioma>/levels/<slug>.json` |
| Glossário | `i18n/<idioma>/glossary.json` |

Um arquivo de tradução de fase tem **a mesma forma** do original, mas só com os campos de texto: `title`, `subtitle`, `body`, `aside`, `question`, `options[].text`, `options[].why`, `goal`, `hints`, `success`, `after`, `explain`, `text`, `source`, `wires`, `takeaways`, `further`. Listas precisam ter o mesmo tamanho e a mesma ordem; `options` segue a ordem das alternativas do original. Campo que faltar aparece em português.

A física **não se traduz**: `qubits`, `gates`, `fixed`, `target`, `solution`, `circuit`, `outcome`, `correct` etc. ficam só no arquivo original. O validador recusa uma tradução que tente mudá-los — assim o jogo é idêntico em todos os idiomas.

`npm run validate` mostra a cobertura de cada idioma (ex.: `✓ i18n/es/ (100% of level text translated)`) e avisa o que falta.

Para um idioma novo: copie o bloco `en` de `engine/strings.js`, traduza, adicione o código em `LANGS` e crie `i18n/<código>/`.
