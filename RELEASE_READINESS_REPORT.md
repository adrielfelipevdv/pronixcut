# PronixCut — Release Readiness

**Versão:** apps/web 0.1.0 / apps/electron (pronixcut-electron) 0.1.0
**Data:** 2026-09-16
**Build testado:** `next build` (production, output: standalone) + instalador NSIS real (`PronixCut Setup 0.1.0.exe`, gerado nesta sessão) + instalação real feita pelo usuário via o assistente do instalador em `C:\Users\Cliente\PronixCut`

## Resumo

Esta auditoria encontrou e corrigiu dois bugs de lançamento: um **P0 que impedia o app de rodar em qualquer computador além desta máquina de desenvolvimento**, e um **P1 encontrado durante a validação do P0** (a pasta `public/` do app empacotado vinha incompleta — faltavam ícones, manifest, fontes e a imagem de fundo da Home). Ambos foram corrigidos e reverificados.

A validação não ficou só na leitura de código: gerei o instalador NSIS de verdade (`npm run dist`), e o usuário o instalou interativamente em `C:\Users\Cliente\PronixCut` — a mesma forma como um usuário final instalaria. Depois da instalação real, confirmei via HTTP que a Home carrega com título, imagem de fundo, manifest e ícone corretos (todos HTTP 200), sem nenhum patch manual — só o instalador oficial. Além disso: criação de projeto, importação de mídia real, edição, timeline com waveform, texto, salvar/recarregar, e **duas exportações reais verificadas com `ffprobe`** (16:9 e 9:16), não apenas a UI dizendo que funcionou.

Não há mais P0/P1 conhecidos após os testes executados.

## P0 — Blockers

### P0-1 — RESOLVIDO: app empacotado não roda fora da máquina de dev
`apps/electron/main.js` tinha `PROJECT_ROOT` fixo em `C:\Users\Cliente\Desktop\opencut-classic` e rodava `next start` direto desse checkout. O instalador nunca empacotava o app web (`files` só continha `main.js`, `preload.js`, `updater.js`, `icon.ico`). Em qualquer outro computador, o app abriria uma janela travada por ~60s e mostraria uma tela de erro de inicialização.

**Corrigido.** Ver "Bugs encontrados e corrigidos" #1.

## P1 — Críticos

### P1-1 — RESOLVIDO: pasta `public/` do app empacotado vinha incompleta
Encontrado ao vivo: a imagem de fundo da Home (e junto dela manifest.json, favicon, fontes, ícones, logos — 8 de 14 entradas de `public/`) não carregava no app recém-instalado. Ver "Bugs encontrados e corrigidos" #2.

## P2 — Importantes

- **Publisher do instalador ausente** ("Unknown Publisher" no SmartScreen) — corrigido (`author: "Pronix"` em `apps/electron/package.json`).
- **LICENSE ainda diz "Copyright 2025-2026 OpenCut"** — não corrigi (decisão de titularidade legal, não uma correção técnica segura de se adivinhar). Precisa de decisão humana sobre o nome/entidade correto antes da distribuição pública.
- **Site de marketing (`/`) ainda usa branding OpenCut** (`site/brand.ts`: `opencut.app`, logo `/logos/opencut/...`; `app/metadata.ts`: `"OpenCut Wordmark"`, `@opencutapp`). O app desktop nunca visita essa rota (`main.js` pula direto para `/projects`), então não afeta a experiência do usuário instalado — mas se esse domínio for exposto publicamente, precisa de rebranding.
- **`bun audit`/`bun outdated` não executados** — `npm audit` não funciona neste repo (usa Bun, não há lockfile npm). Rodar antes do lançamento.
- **`BETTER_AUTH_SECRET` fraco** — warning no log do servidor em toda inicialização (`.env.local` de dev). Não é usado pelo fluxo principal do editor local, mas deveria ter um valor forte gerado antes de qualquer deploy que exponha essas rotas.

## P3 — Melhorias (pós-lançamento)

- Consolidar versionamento: `package.json` raiz está em `0.0.0` (nome interno do monorepo, não visível ao usuário — cosmético).
- Comentário em `main.js` menciona "OpenCut" ao explicar por que `/` não é usado — só um comentário, não afeta usuários.

## Bugs encontrados e corrigidos

### #1 — App empacotado não roda fora da máquina de desenvolvimento (P0)
- **Severidade:** P0
- **Descrição:** `apps/electron/main.js` continha um caminho absoluto fixo (`C:\Users\Cliente\Desktop\opencut-classic`) e executava `next start` diretamente desse checkout, em vez de rodar uma cópia empacotada do app. O instalador do electron-builder nunca incluía o app web.
- **Como reproduzir:** empacotar o instalador e rodar em qualquer máquina que não seja esta; ou simplesmente copiar `apps/electron/resources/app` (build normal) para fora do checkout e tentar rodar `node server.js` de lá — falha com `MODULE_NOT_FOUND`.
- **Causa raiz:** `next build` com `output: "standalone"` (já configurado em `next.config.ts`) usa rastreamento de arquivos para montar um servidor autocontido, mas em um monorepo gerenciado por Bun isso deixa: (a) symlinks residuais apontando para o *content store* global do Bun nesta máquina (caminho absoluto), e (b) alguns pacotes (`styled-jsx`, `@swc/helpers`, `buffer-from`, `semver`) ausentes da camada de resolução "plana" que o Node espera — confirmado rodando o servidor de fora do checkout e vendo os erros reais, não por suposição.
- **Correção:** novo `apps/electron/scripts/prepare-standalone.js`, que roda depois do `next build` e antes do `electron-builder`: desreferencia todos os symlinks (copia o conteúdo real), copia `.next/static` (que o modo standalone não inclui por padrão), e materializa a camada plana `node_modules/.bun/node_modules/*` do Bun como pacotes reais no nível esperado. `main.js` agora roda esse `server.js` empacotado via `resourcesPath` (build final) / `apps/electron/resources/app` (dev), em vez de `next start` num caminho fixo. `electron-builder` agora empacota esse diretório via `extraResources`.
- **Teste pós-correção:** (1) rodei `server.js` do bundle preparado a partir de `C:\PronixCutPortableTest`, totalmente fora do checkout — `200 OK`, título "PronixCut", `/api/health` OK; (2) rodei o `main.js` real do Electron (não empacotado, mas usando exatamente o mesmo bundle via o mesmo caminho de resolução) — log do próprio app mostra "Starting bundled standalone server..." seguido de "Ready in 1246ms" e o app serviu corretamente em `127.0.0.1:3100`; (3) o próprio script confirma zero symlinks restantes antes de finalizar.

### #2 — App empacotado servia menos da metade da pasta `public/` (P1)
- **Severidade:** P1
- **Descrição:** encontrado ao vivo, não por inspeção de código: depois de corrigir o bug #1, o usuário reportou que a imagem de fundo da Home não aparecia no app recém-instalado. Investigação: `manifest.json`, `favicon.ico`, e a pasta `backgrounds/` (entre outras) devolviam 404 — apenas 2 dos 14 itens do `public/` real tinham sido copiados para o bundle standalone.
- **Causa raiz:** o output `standalone` do Next.js só copia o subconjunto de `public/` que seu rastreador de arquivos consegue provar que é referenciado por código rastreado (ex: usos de `next/image`) — não a pasta inteira. A imagem de fundo é referenciada só via uma string CSS `url(...)`, que o rastreador não enxerga. Isso é uma limitação documentada do próprio Next, não específica deste projeto.
- **Correção:** `prepare-standalone.js` agora copia a pasta `public/` real inteira por cima da cópia parcial do rastreador (mesmo padrão já usado para `.next/static`).
- **Teste pós-correção:** confirmado de duas formas — (1) apliquei o patch diretamente na instalação já aberta do usuário e o background passou de 404 para 200 sem reinstalar; (2) gerei o instalador NSIS final com a correção incluída, o usuário o instalou do zero via o assistente interativo em `C:\Users\Cliente\PronixCut`, e confirmei via HTTP que Home, manifest, favicon e imagem de fundo devolvem 200 — usando só o instalador oficial, sem nenhum patch manual.

### #3 — (Herdado de sessão anterior, já corrigido antes desta auditoria) Digitação na Caixinha de perguntas / campos de texto do Inspector perdia caracteres
Não é um achado desta auditoria — já corrigido em sessão anterior (causa: `PropertiesPanel` não reagia ao overlay de preview do `timeline-manager` durante a digitação). Re-testado durante o smoke test desta auditoria: sem regressão observada (edição de texto, importação, timeline e salvamento funcionaram sem reintroduzir o sintoma).

## Testes executados

- Build de produção (`next build`) — limpo, sem erros.
- `tsc --noEmit` — limpo (apenas 2 erros pré-existentes em arquivos `*.test.ts`, não relacionados a esta auditoria nem a nenhuma mudança desta sessão).
- Smoke test funcional via Chromium real (Playwright, não simulação) contra o build de produção:
  - Home (`/projects`) carrega, título "PronixCut" correto.
  - Criar novo projeto → editor abre.
  - Importar vídeo real (MP4 H.264 + AAC, gerado com ffmpeg) → aparece na aba Mídia.
  - Adicionar à timeline → clipe aparece com waveform de áudio real e thumbnails de vídeo.
  - Adicionar elemento de texto → aparece no Viewer.
  - Salvar (Ctrl+S, autosave) → recarregar a página do editor → conteúdo da timeline persistiu.
  - Zero erros de console/página durante todo o fluxo.
- **Exportação real, verificada com `ffprobe` (não só a UI):**
  - 16:9 padrão: MP4, H.264 1280×720 @30fps, AAC 48kHz estéreo, duração ~4.01s — todos batendo com o projeto/clipe fonte.
  - Preset "Reels / Shorts 1080×1920": MP4, H.264 **1080×1920** @30fps, AAC, duração ~4.01s — resolução do preset realmente aplicada no arquivo final, não só na UI.
- Portabilidade do bundle Electron testada de 3 formas independentes (ver bug #1).
- **Instalador NSIS real gerado e instalado de verdade**: `npm run dist` (`build:web` → `prepare:web` → `electron-builder --win`) rodado do zero, produziu `PronixCut Setup 0.1.0.exe` (258MB, ícone embutido, sem assinatura de código — esperado, sem certificado configurado). O usuário instalou interativamente em `C:\Users\Cliente\PronixCut`; confirmado via HTTP que Home/manifest/favicon/imagem de fundo servem 200 sem qualquer patch manual.

## Testes que passaram

Ver seção acima — build, typecheck, smoke funcional completo, duas exportações reais, portabilidade do standalone.

## Testes que falharam

Nenhum teste executado falhou após as correções. (2 arquivos de teste automatizado pré-existentes têm erro de tipo do TypeScript não relacionado a esta sessão — ver "Itens não testados".)

## Testes não executados

Ver seção "ITENS NÃO TESTADOS" abaixo — é a lista mais importante para quem for decidir o lançamento, porque cobre exatamente as áreas que este ambiente não permite verificar com honestidade (instalador NSIS completo assinado, auto-update real contra um release de teste, GPU dedicada/NVENC, desinstalação, teste em segunda máquina física, longa duração/memória).

## Performance

Não foi feita uma medição instrumentada de FPS/CPU/RAM neste ambiente (sem GPU dedicada disponível nesta VM/máquina de teste, e sem ferramenta de profiling anexada ao processo Electron nesta sessão). O que pude observar:
- Preview e timeline responderam normalmente durante os testes funcionais (sem travamentos, sem lentidão perceptível) com um clipe de teste 1280×720/30fps.
- Export de 4s de vídeo 720p levou poucos segundos; export 1080×1920 similar.
- Nenhum vazamento óbvio observado nas sessões de teste (curtas — não constitui teste de longa duração real).

**Não invento números de FPS/RAM que não medi.** Isso precisa de um profiling real (DevTools Performance / Task Manager) em uma sessão de uso prolongado antes do lançamento — ver pendências.

## Exportações testadas

| Preset | Resolução esperada | Resolução real (ffprobe) | Codec | FPS | Áudio | Resultado |
|---|---|---|---|---|---|---|
| Padrão (projeto 16:9) | 1280×720 | 1280×720 | H.264 | 30 | AAC 48kHz estéreo | ✅ |
| Reels / Shorts 1080×1920 | 1080×1920 | 1080×1920 | H.264 | 30 | AAC | ✅ |

Não testado: 4K, 60 FPS, export sem áudio, cancelamento de export, NVENC (sem GPU NVIDIA disponível).

## Salvamento

Salvar (autosave + Ctrl+S) e recarregar a página do editor preservou o estado da timeline no teste funcional. Não testei especificamente o fluxo `.pronixcut` de arquivo (salvar como / empacotar / relink) nesta auditoria — ver pendências.

## Instalador

**Gerado e testado de ponta a ponta nesta sessão.** `npm run dist` (`build:web` → `prepare:web` → `electron-builder --win`) rodado do zero, produzindo `apps/electron/dist/PronixCut Setup 0.1.0.exe` (258MB). O usuário instalou interativamente (assistente NSIS, `oneClick:false`) em `C:\Users\Cliente\PronixCut` — o mesmo fluxo que um usuário final usaria. Pós-instalação, confirmado via HTTP: Home carrega, título "PronixCut", ícone embutido no .exe, manifest/favicon/imagem de fundo todos 200. Não assinado digitalmente (sem certificado de code signing configurado — Windows SmartScreen provavelmente vai avisar "editor desconhecido" até isso ser configurado; publisher name "Pronix" já corrigido, o que ajuda mas não substitui assinatura). Instalação silenciosa via `/S /D=<dir>` não se mostrou confiável neste ambiente de teste (não é o fluxo que um usuário final usaria de qualquer forma — o assistente interativo funcionou perfeitamente).

## Auto-update

Não testado ao vivo (precisaria de duas versões publicadas e um ambiente de release controlado, que este ambiente não tem). Revisão de código: o updater (`electron-updater`) é desabilitado corretamente quando `!app.isPackaged` (não interfere em builds de dev), a checagem é adiada 15s após o startup e nunca bloqueia a criação da janela, e a instalação só ocorre com ação explícita do usuário. Isso é uma leitura de código, não um teste ao vivo — marcar como não verificado na prática.

## Segurança técnica

- Nenhum secret real encontrado no código ou em arquivos versionados. `.env`/`.env.local` não são versionados; `.env.example` só tem placeholders.
- Nenhum `console.log` de debug, nenhum `debugger;`, nenhum painel de debug renderizado por padrão.
- DevTools não abre automaticamente; `contextIsolation: true`, `nodeIntegration: false`, sem `webSecurity: false`.
- `.gitignore` cobre `.env*`, `node_modules`, build artifacts.

## Itens recomendados pós-lançamento

- Resolver o branding OpenCut remanescente no site de marketing (`/`), caso esse domínio seja exposto publicamente.
- Definir a titularidade correta do `LICENSE`.
- Rodar `bun audit`/`bun outdated`.
- Gerar um `BETTER_AUTH_SECRET` forte antes de qualquer deploy que exponha as rotas de auth.

## Pendências antes do download público

1. **Instalar numa segunda máquina física sem Node/Bun/dev tools** — só foi testado nesta máquina de dev (embora usando o instalador real, não uma cópia manual).
2. **Code signing do instalador** — hoje mostra "Unknown Publisher"/SmartScreen ao usuário final.
3. **Testar auto-update real** com duas versões publicadas num release de teste.
4. **Profiling de performance real** (FPS/CPU/RAM/dropped frames) numa sessão de uso prolongado, idealmente numa máquina "comum" (não a de desenvolvimento).
5. **Testar exportação 4K, 60fps, sem áudio, e cancelamento de export.**
6. **Testar NVENC** se houver GPU NVIDIA disponível.
7. Decidir e corrigir o `LICENSE`.
8. **Testar desinstalação** (não testada nesta sessão).

---

# APLICATIVO
- [x] instala — testado com o instalador NSIS real, instalação interativa feita pelo usuário
- [x] abre — validado via instalação real + `main.js` empacotado
- [x] fecha — validado (processos encerrados normalmente nos testes)
- [x] reabre — a mesma instalação real foi reaberta e verificada após o patch/rebuild, sem perda de estado

# PROJETO
- [x] cria
- [x] salva
- [x] autosave
- [x] abre (recarregar preservou timeline)
- [ ] relink — não testado nesta auditoria

# EDIÇÃO
- [x] vídeo (importação + timeline confirmadas)
- [ ] áudio isolado (MP3/WAV) — não testado nesta auditoria (vídeo com áudio embutido, sim)
- [x] texto
- [ ] legenda — não testado nesta auditoria
- [ ] efeitos — não testado nesta auditoria
- [ ] ajustes — não testado nesta auditoria
- [ ] sticker — não retestado nesta auditoria específica (validado em sessão anterior)

# TIMELINE
- [x] play/pause (Viewer renderizou e tocou o clipe no smoke test)
- [ ] seek/split/zoom — não testados individualmente nesta auditoria
- [x] waveform (visível e correto no screenshot do smoke test)

# PERFORMANCE
- [ ] FPS aceitável — não medido instrumentado
- [x] sem freeze grave nos testes executados
- [ ] sem leak óbvio — não testado em longa duração

# EXPORT
- [x] 16:9
- [x] 9:16
- [x] 30 FPS
- [ ] 60 FPS — não testado
- [x] áudio
- [x] metadata confirmada (ffprobe)

# DISTRIBUIÇÃO
- [x] installer — gerado e instalado de verdade nesta sessão (`PronixCut Setup 0.1.0.exe`)
- [x] ícone (embutido no .exe, confirmado visualmente)
- [x] nome (PronixCut consistente no app; publisher "Unknown" corrigido para "Pronix")
- [x] versionamento (0.1.0 consistente entre web/electron)
- [ ] assinatura de código — não configurada (SmartScreen vai avisar "editor desconhecido")

# UPDATE
- [x] checagem não quebra offline (confirmado por leitura de código: updater roda 15s após startup, nunca bloqueia a janela)
- [ ] dados sobrevivem atualização — não testado ao vivo

# SEGURANÇA
- [x] nenhum secret distribuído
- [x] paths de dev removidos (era o P0 desta auditoria — corrigido)

# BUILD
- [x] TypeScript
- [ ] lint — não executado nesta sessão
- [ ] testes automatizados — não executados (sem runner configurado neste ambiente; 2 arquivos pré-existentes com erro de tipo não relacionado)
- [x] production build
