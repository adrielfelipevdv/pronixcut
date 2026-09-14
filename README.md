# ⚡ PronixCut

**Editor de vídeo desktop desenvolvido para a operação da PRONIX.**

O PronixCut reúne edição de vídeo, áudio, textos, legendas, efeitos e ferramentas próprias em uma única interface, com foco em produtividade, velocidade e criação de conteúdo.

> 🚧 **Status:** desenvolvimento ativo.

---

## Sobre o PronixCut

O **PronixCut** nasceu com o objetivo de criar um fluxo de edição mais rápido e centralizado, principalmente para produção de conteúdos verticais e materiais de social media.

A proposta é combinar a praticidade de editores modernos com uma interface própria da PRONIX e ferramentas que façam sentido para o fluxo real da equipe.

A identidade do aplicativo segue um visual **dark premium**, utilizando o amarelo `#FFC600` como principal cor de destaque.

---

## ✨ Principais recursos

### 🎬 Timeline

- Timeline multifaixa
- Vídeo, áudio, textos e legendas em tracks independentes
- Divisão e organização de clips
- Trim de mídia
- Zoom da timeline
- Playhead sincronizado com o preview
- Visualização de waveform de áudio
- Seleção e edição contextual de elementos

---

### 📹 Vídeo

- Preview em tempo real
- Projetos horizontais e verticais
- Suporte a diferentes proporções
- `16:9`
- `9:16`
- `1:1`
- Outros formatos personalizados
- Frame rate configurável
- Transformação e posicionamento
- Preview expandido para edição de vídeos verticais

---

### 🔤 Texto

Ferramentas para criação e personalização de textos diretamente no editor.

Entre as configurações disponíveis ou previstas estão:

- Fonte
- Peso
- Tamanho
- Cor
- Alinhamento
- Espaçamento
- Altura da linha
- Sombra
- Contorno
- Transformação
- Posição
- Escala
- Rotação

O PronixCut também possui suporte a **predefinições de texto**, permitindo reutilizar estilos em diferentes projetos.

---

### 💬 Legendas

- Legendas diretamente na timeline
- Edição pelo Inspector
- Personalização de fonte
- Cor
- Tamanho
- Alinhamento
- Posicionamento
- Estilos reutilizáveis

---

### 🎵 Áudio

O sistema de áudio é integrado à timeline.

Recursos incluem:

- Tracks de áudio
- Waveform visual
- Controle de volume
- Importação de músicas
- Importação de efeitos sonoros
- Biblioteca **Sounds & effects**

A proposta é permitir que sons adicionados à biblioteca possam ser reutilizados em outros projetos.

---

### ✨ Efeitos

O PronixCut possui uma área dedicada a efeitos e ajustes visuais.

A estrutura inclui:

- Efeitos predefinidos
- Filtros
- Ajustes de cor
- Saturação
- Contraste
- Temperatura
- Brilho
- Sombras
- Realces
- Nitidez
- Vinheta
- Predefinições personalizadas

Os efeitos podem utilizar thumbnails de preview para facilitar a comparação antes da aplicação.

---

### ⚡ PronixEditor

O **PronixEditor** é integrado ao PronixCut como uma ferramenta interna.

Ele pode ser acessado diretamente pelo menu do aplicativo sem precisar abrir uma nova janela ou navegador.

A proposta é concentrar recursos adicionais da operação dentro do mesmo ambiente de trabalho.

---

## 🖥 Interface

O PronixCut utiliza um design system inspirado na identidade visual da PRONIX.

| Elemento | Cor |
|---|---|
| Destaque principal | `#FFC600` |
| Fundo principal | `#090A0B` |
| Painéis | `#111214` / `#141517` |
| Texto principal | `#FFFFFF` |
| Texto secundário | Cinza |
| Áudio / sucesso | Verde |
| Erros / ações destrutivas | Vermelho |

### Direção visual

- Dark premium
- Alto contraste
- Interface limpa
- Painéis contextuais
- Menu lateral recolhível
- Inspector recolhível
- Amarelo utilizado como destaque
- Glows sutis
- Layout responsivo

---

## 🧩 Estrutura do editor

```text
PronixCut
│
├── Home
│   ├── Novo projeto
│   ├── Abrir projeto
│   └── Projetos recentes
│
├── Editor
│   │
│   ├── Mídia
│   ├── Áudio
│   ├── Texto
│   ├── Adesivos
│   ├── Efeitos
│   ├── Transições
│   ├── Legendas
│   ├── Ajustes
│   └── PronixEditor
│
├── Preview
│
├── Inspector contextual
│
├── Timeline
│   ├── Texto
│   ├── Legendas
│   ├── Vídeo
│   └── Áudio
│
└── Exportação
```

---

## 🎞 Fluxo de edição

```text
Criar projeto
      ↓
Importar mídia
      ↓
Organizar timeline
      ↓
Editar vídeo
      ↓
Adicionar textos / legendas
      ↓
Adicionar áudio
      ↓
Aplicar efeitos
      ↓
Revisar no preview
      ↓
Exportar
```

---

## ⚙️ Configurações do projeto

Configurações relacionadas diretamente ao vídeo podem ser acessadas pelo próprio Viewer.

Entre elas:

### Taxa de quadros

- 24 FPS
- 30 FPS
- 60 FPS
- Outras taxas suportadas

### Proporção

- 16:9
- 9:16
- 1:1
- 4:5
- Personalizado

O frame rate do projeto deve servir como referência para timeline, timecode, stepping e exportação sem alterar a duração original do vídeo.

---

## 📦 Exportação

A arquitetura de exportação está sendo evoluída para suportar diferentes configurações de saída.

Entre as opções planejadas:

### Formatos

- MP4
- MOV
- WebM

### Vídeo

- H.264
- H.265 / HEVC
- Outros codecs quando suportados

### Resoluções

- 720p
- 1080p
- 1440p
- 4K
- Personalizada

### Conteúdo vertical

Exemplo:

```text
1080 × 1920
9:16
```

### Conteúdo horizontal

Exemplo:

```text
1920 × 1080
16:9
```

Também estão previstas opções de:

- Bitrate
- Qualidade
- FPS
- Codec de áudio
- Bitrate de áudio
- Presets de exportação

---

## 🔄 Atualizações do aplicativo

O PronixCut está sendo preparado para receber atualizações sem exigir que o usuário desinstale e instale novamente o programa.

Fluxo esperado:

```text
Nova versão publicada
        ↓
PronixCut verifica atualizações
        ↓
Nova versão encontrada
        ↓
Download em segundo plano
        ↓
Atualização pronta
        ↓
Usuário escolhe "Atualizar e reiniciar"
        ↓
PronixCut abre atualizado
```

O objetivo é evitar interrupções durante uma edição.

Uma atualização nunca deve fechar o projeto inesperadamente.

---

## 🎚 Performance

Performance é uma prioridade do PronixCut.

Alguns princípios utilizados no desenvolvimento:

- Playback independente de renders desnecessários da interface
- Reprodução nativa de vídeo
- Cache de thumbnails
- Cache de waveform
- Processamento pesado fora do ciclo principal de playback
- Atualizações eficientes do playhead
- Redução de rerenders da timeline
- Reaproveitamento de dados de mídia já processados

---

## 🎧 Waveform

A timeline pode representar visualmente o áudio real dos arquivos.

```text
ÁUDIO

┌──────────────────────────────────────────────┐
│ ▁▂▃▅▇▅▂▁▂▃▆█▅▂▁▂▅▇▆▄▂▁▂▃▅▇▅▂▁             │
└──────────────────────────────────────────────┘
```

A waveform deve acompanhar:

- Zoom
- Trim
- Split
- In point
- Out point

sem precisar analisar o mesmo arquivo novamente a cada renderização.

---

## 🖼 Preview 9:16

Projetos verticais podem utilizar um modo de visualização ampliado.

Nesse modo:

- O viewer ganha mais espaço
- O vídeo permanece em `9:16`
- A timeline continua disponível
- O vídeo não é distorcido
- O modo altera apenas a interface
- A resolução final do projeto não é modificada

---

## 💾 Predefinições

O PronixCut está sendo estruturado para permitir reutilização de configurações.

Exemplos:

### Texto

```text
Headline Pronix
Legenda Clean
CTA Amarelo
Título Impacto
```

### Efeitos

```text
Cinema
Quente
Frio
Contraste
Produto
Estoque
```

### Exportação

```text
Reels PRONIX
YouTube 1080p
YouTube 4K
Arquivo leve
Alta qualidade
```

---

## 🛠 Desenvolvimento

Clone o projeto:

```bash
git clone https://github.com/adrielfelipevdv/pronixcut.git
cd pronixcut
```

A partir daqui, utilize o gerenciador de pacotes e os scripts definidos no projeto.

> Os comandos específicos de instalação, desenvolvimento, build e distribuição devem seguir o `package.json` e a configuração atual do PronixCut.

---

## 📐 Diretrizes para desenvolvimento

Ao adicionar ou alterar funcionalidades:

1. Não quebrar funcionalidades já existentes.
2. Não criar controles visuais sem implementação real.
3. Evitar valores hardcoded quando houver configuração central.
4. Preservar a fluidez do playback.
5. Evitar processamento pesado durante reprodução.
6. Manter a interface em PT-BR.
7. Preservar o estado do projeto entre diferentes áreas.
8. Testar projetos `16:9` e `9:16`.
9. Manter consistência com o design system PronixCut.
10. Validar TypeScript, lint e build antes de concluir.

---

## 🗺 Roadmap

Algumas das frentes de evolução do PronixCut:

- [ ] Otimizações contínuas de playback
- [ ] Waveform avançada com cache
- [ ] Biblioteca local de sons
- [ ] Mais presets de texto
- [ ] Editor avançado de efeitos
- [ ] Presets personalizados
- [ ] Melhorias no sistema de exportação
- [ ] Auto-update
- [ ] Mais ferramentas no PronixEditor
- [ ] Melhor experiência de edição 9:16
- [ ] Atalhos personalizados
- [ ] Keyframes avançados
- [ ] Mais opções de áudio
- [ ] Melhorias de performance para projetos longos

---

## ⚠️ Status do projeto

O PronixCut está em **desenvolvimento ativo**.

Isso significa que:

- funcionalidades podem mudar;
- partes da interface ainda podem ser refinadas;
- novos recursos estão sendo adicionados;
- algumas ferramentas ainda estão em processo de implementação ou otimização.

---

## 🎨 Identidade

**Produto:** PronixCut  
**Marca:** PRONIX  
**Cor principal:** `#FFC600`

---

## 🔗 Repositório

**GitHub**

```text
https://github.com/adrielfelipevdv/pronixcut
```

---

## PRONIX

**Vendas Online na Prática.**
