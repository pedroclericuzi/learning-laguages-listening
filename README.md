# 🎧 3L — Learn Languages Listening

Aprenda idiomas ouvindo músicas e histórias. O 3L é um aplicativo web que combina letras sincronizadas de músicas, narração de contos clássicos com TTS neural, tradução instantânea palavra a palavra e exercícios de vocabulário — tudo em 8 idiomas.

![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)
![Node](https://img.shields.io/badge/Node-18+-339933?logo=node.js&logoColor=white)

---

## Objetivo

O 3L permite que o usuário pratique um novo idioma de forma imersiva, através de:

- **Músicas com letras sincronizadas** — ouça prévias de 30 segundos do Deezer com a letra acompanhando em tempo real, traduzida linha a linha
- **Histórias narradas com TTS neural** — 8 contos clássicos de domínio público narrados por vozes da Microsoft Edge em qualquer idioma suportado, com texto sincronizado frase a frase
- **Tradução instantânea de palavras** — clique em qualquer palavra do texto para ver sua tradução, classe gramatical e definições
- **Exercícios de preenchimento (fill-in-the-blank)** — nas histórias, pratique vocabulário preenchendo lacunas com 4 opções de resposta

### Idiomas suportados

🇧🇷 Português · 🇺🇸 Inglês · 🇪🇸 Espanhol · 🇫🇷 Francês · 🇩🇪 Alemão · 🇮🇹 Italiano · 🇯🇵 Japonês · 🇰🇷 Coreano

---

## Arquitetura

O projeto é um **monorepo** com duas aplicações separadas:

```
3l/
├── client/          → SPA React (Vite)
├── server/          → API REST (Express.js)
└── package.json     → Scripts de orquestração (concurrently)
```

### Client (React + Vite)

```
client/src/
├── main.jsx                  # Entry point + hierarquia de providers
├── App.jsx                   # Definição de rotas (React Router)
├── components/               # Componentes reutilizáveis
│   ├── ErrorBoundary/        # Captura erros de renderização
│   ├── ErrorState/           # UI genérica de erro com retry
│   ├── Layout/               # Shell do app (sidebar + bottom tabs)
│   ├── SongCard/             # Card de música
│   ├── StoryCard/            # Card de história
│   ├── Toast/                # Sistema de notificações (context + hook)
│   └── WordTranslation/      # Texto clicável + popup de tradução
├── context/
│   ├── LanguageContext.jsx    # Idioma nativo e alvo (localStorage)
│   └── FavoritesContext.jsx   # IDs de músicas favoritas (localStorage)
├── pages/
│   ├── Onboarding/           # Seleção de idiomas (2 telas)
│   ├── Home/                 # Dashboard principal
│   ├── SongList/             # Busca e listagem de músicas
│   ├── Player/               # Player de música com letras sincronizadas
│   ├── Stories/              # Catálogo de histórias
│   ├── StoryPlayer/          # Player de história com quiz e narração
│   ├── Favorites/            # Músicas favoritas
│   └── Settings/             # Configurações de idioma
└── styles/
    └── global.css            # Estilos globais e variáveis CSS
```

**Hierarquia de Providers:**

```
React.StrictMode
  └─ BrowserRouter
      └─ ErrorBoundary
          └─ LanguageProvider       ← idiomas (localStorage)
              └─ FavoritesProvider  ← favoritos (localStorage)
                  └─ ToastProvider  ← notificações
                      └─ App
```

**Rotas:**

| Rota | Página | Descrição |
|---|---|---|
| `/onboarding/native` | NativeLanguage | Selecionar idioma nativo |
| `/onboarding/target` | TargetLanguage | Selecionar idioma alvo |
| `/` | Home | Dashboard com músicas populares e histórias |
| `/songs` | SongList | Buscar e navegar músicas |
| `/player/:id` | Player | Player de música com letras sincronizadas |
| `/stories` | Stories | Catálogo de contos |
| `/story/:id` | StoryPlayer | Player de história com narração e quiz |
| `/favorites` | Favorites | Músicas salvas |
| `/settings` | Settings | Configurações |

### Server (Express.js)

```
server/
├── index.js              # Entry point — rotas e middleware
├── data/
│   ├── languages.js      # 8 idiomas suportados
│   └── stories.js        # 8 contos com frases segmentadas
├── routes/
│   ├── languages.js      # GET /api/languages
│   ├── songs.js          # Busca, detalhes e letras de músicas
│   ├── stories.js        # Listagem, áudio TTS e conteúdo de histórias
│   └── translate.js      # Tradução de palavras individuais
├── services/
│   ├── deezer.js         # API do Deezer (busca, chart, detalhes)
│   ├── lrclib.js         # LRCLIB (letras sincronizadas em formato LRC)
│   ├── translator.js     # Google Translate (tradução + detecção de idioma)
│   └── tts.js            # Microsoft Edge Neural TTS (via edge-tts/Python)
└── cache/
    ├── translations.json       # Cache de traduções de texto
    ├── word_translations.json  # Cache de traduções de palavras
    └── tts/                    # Áudio MP3 + legendas VTT gerados
```

**Endpoints da API:**

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/languages` | Lista de idiomas suportados |
| `GET` | `/api/songs/search?q=&limit=` | Buscar músicas (Deezer) |
| `GET` | `/api/songs/popular?limit=` | Top chart global (Deezer) |
| `GET` | `/api/songs/language/:code` | Músicas curadas por idioma |
| `GET` | `/api/songs/:id` | Detalhes de uma faixa |
| `GET` | `/api/songs/:id/lyrics?translate=` | Letra sincronizada + tradução |
| `GET` | `/api/stories?lang=` | Listar histórias com metadados |
| `GET` | `/api/stories/:id?lang=` | Detalhes de uma história |
| `GET` | `/api/stories/:id/audio?lang=` | Áudio MP3 narrado (TTS) |
| `GET` | `/api/stories/:id/content?lang=&translate=` | Conteúdo com timestamps, tradução e quiz |
| `POST` | `/api/translate/word` | Traduzir palavra individual |

### APIs e Serviços Externos

| Serviço | Uso | Base URL |
|---|---|---|
| **Deezer** | Busca de músicas, charts, prévias de 30s | `https://api.deezer.com` |
| **LRCLIB** | Letras sincronizadas (formato LRC) | `https://lrclib.net/api` |
| **Google Translate** | Tradução de texto e detecção de idioma | `translate.googleapis.com` |
| **Microsoft Edge TTS** | Narração com vozes neurais (via Python) | CLI `edge-tts` |

### Cache

O servidor mantém cache em disco para evitar chamadas repetidas:

- **Traduções de texto** → `cache/translations.json`
- **Traduções de palavras** → `cache/word_translations.json`
- **Áudio TTS** → `cache/tts/*.mp3` + `*.vtt` + `*_sentences.json`

---

## Tech Stack

### Client

| Tecnologia | Versão | Uso |
|---|---|---|
| React | 18.3 | UI e gerenciamento de estado |
| React Router | 6.26 | Roteamento SPA |
| React Icons | 5.3 | Ícones (Feather, Material, etc.) |
| Vite | 5.4 | Bundler e dev server |
| CSS Variáveis | — | Tematização global |

### Server

| Tecnologia | Versão | Uso |
|---|---|---|
| Node.js | 18+ | Runtime (native `fetch`) |
| Express | 4.21 | Framework HTTP |
| CORS | 2.8 | Cross-origin requests |
| edge-tts (Python) | — | Geração de áudio por TTS neural |

### Ferramentas

| Ferramenta | Uso |
|---|---|
| Concurrently | Rodar client e server em paralelo |
| Vite Proxy | Redirecionar `/api` → server em dev |

---

## Como Rodar

### Pré-requisitos

- **Node.js** 18 ou superior
- **Python 3** com o pacote `edge-tts` instalado:

```bash
pip install edge-tts
```

### Instalação

```bash
# Clonar o repositório
git clone https://github.com/pedroclericuzi/learning-laguages-listening.git
cd learning-laguages-listening

# Instalar dependências (client + server)
npm run install:all
```

### Desenvolvimento

```bash
# Iniciar client (porta 5173) e server (porta 3001) simultaneamente
npm run dev
```

Ou separadamente:

```bash
# Apenas o server
npm run dev:server

# Apenas o client
npm run dev:client
```

Acesse **http://localhost:5173** no navegador.

### Build de Produção

```bash
cd client
npm run build
npm run preview
```

---

## Histórias Disponíveis

O app inclui 8 contos clássicos de domínio público, cada um com frases segmentadas para narração sincronizada e exercícios:

| História | Autor | Dificuldade | Frases |
|---|---|---|---|
| Chapeuzinho Vermelho | Irmãos Grimm | Iniciante | 35 |
| Os Três Porquinhos | Joseph Jacobs | Iniciante | 27 |
| A Tartaruga e a Lebre | Esopo | Iniciante | 22 |
| O Patinho Feio | Hans Christian Andersen | Intermediário | 31 |
| O Menino que Gritava Lobo | Esopo | Iniciante | 23 |
| Cachinhos Dourados | Robert Southey | Iniciante | ~27 |
| João e o Pé de Feijão | Folclore Inglês | Intermediário | 34 |
| Cinderela | Charles Perrault | Intermediário | 32 |

---

## Estrutura de Dados

### Persistência no Client (localStorage)

| Chave | Conteúdo |
|---|---|
| `3l-languages` | `{ nativeLanguage, targetLanguage }` |
| `3l-favorites` | Array de IDs de músicas (Deezer) |

### Fluxo Principal

1. **Onboarding** — usuário seleciona idioma nativo e idioma alvo
2. **Home** — dashboard com músicas populares, músicas no idioma alvo e histórias
3. **Player de Música** — reproduz prévia de 30s com letra sincronizada, tradução e clique em palavras
4. **Player de História** — narra conto com TTS neural, mostra texto sincronizado, tradução e exercícios de vocabulário
5. **Favoritos** — músicas salvas localmente

---

## Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia client e server em paralelo |
| `npm run dev:client` | Inicia apenas o Vite dev server |
| `npm run dev:server` | Inicia apenas o Express (com --watch) |
| `npm run install:all` | Instala dependências de ambos |

---

## Licença

Projeto acadêmico / pessoal.
