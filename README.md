# Gerador de Certificados

Aplicação estática em HTML, CSS e JavaScript para gerar certificados diretamente no navegador.

## Evento disponível

- Encontro de Comadres 2026

## Estrutura

```text
gerador-certificados/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   └── certificado.js
├── data/
│   └── eventos.json
└── assets/
    ├── certificados/
    │   └── certificado-encontro-comadres-2026.png
    ├── logos/
    └── fontes/
```

## Configuração do nome

- Arte original: 1750 × 1167 px
- Posição: X 875 / Y 585
- Posição vertical ajustada para aproximadamente 10,04 cm a partir do topo
- Fonte: 30 pt
- Peso: 600
- Cor: preta
- Família: Libre Baskerville, com alternativa Georgia

## Saída

O PNG é gerado em 3548 × 2366 px, equivalente à ampliação proporcional de 148 para 300 dpi.
O navegador não grava necessariamente o metadado físico de 300 dpi no PNG, mas a quantidade de pixels
é adequada para manter aproximadamente o mesmo tamanho físico informado quando impresso a 300 dpi.

## Teste local

Como o projeto usa `fetch()` para ler `data/eventos.json`, abra-o com um servidor local.

Exemplo com Python:

```bash
python -m http.server 8000
```

Depois aceda a:

```text
http://localhost:8000
```

## GitHub Pages

Em **Settings → Pages**, escolha:

- Source: Deploy from a branch
- Branch: main
- Folder: /root

## Próxima etapa

Adicionar controlo de acesso e validação da lista de participantes antes de permitir a emissão.


## Paleta da interface

- Cinza escuro
- Cinza claro
- Gelo


## Fonte do nome

A fonte Libre Baskerville é carregada pelo Google Fonts. Para visualização e exportação corretas,
o navegador precisa estar ligado à internet no primeiro carregamento.


## Downloads

- O botão **Baixar PNG** descarrega o certificado diretamente no dispositivo.
- O botão **Salvar PDF** gera e descarrega o PDF diretamente no dispositivo.
- Nenhum certificado é entregue em arquivo ZIP ao participante.
- A geração de PDF usa a biblioteca jsPDF carregada por CDN.


## Controle de acesso — versão de teste

- Fonte importada: `Nomes-comadres-2026.xlsx`
- Participantes válidos processados: 10
- Opções de acesso: CPF ou telefone
- Entrada aceita: apenas números
- Limite: 5 tentativas
- Bloqueio local: 3 minutos
- Após a validação, o nome cadastrado aparece como identificação do participante e também é sugerido no campo do certificado
- O arquivo `participantes.json` guarda hashes SHA-256, não CPF ou telefone em texto aberto

### Limitação importante

Este bloqueio é executado no navegador e usa `localStorage`. Ele reduz acessos casuais, mas não é
segurança forte. Para a publicação definitiva, a validação deve ocorrer numa API/backend, sem disponibilizar
a lista de participantes no site estático.


## Ajuste do nome no certificado

O nome cadastrado é usado apenas para identificar o participante autorizado.
O campo do nome do certificado permanece editável, permitindo correções, abreviações ou diferenças entre
o nome de cadastro e o nome que deve aparecer no certificado.
