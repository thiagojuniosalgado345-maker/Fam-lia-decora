# Família Decora

Site independente da loja Família Decora. Este repositório não depende do BuscaAcademias.

## Estrutura
- `index.html`: loja pública, catálogo, filtros e formulário de orçamento.
- `style.css`: identidade visual rosa-claro, branco e rosé, responsiva.
- `app.js`: catálogo e montagem de mensagem para WhatsApp.
- `gestao.html`, `gestao.css`, `gestao.js`: protótipo local para manutenção do catálogo e anotações de datas indisponíveis.

## Configurações a confirmar com a loja
No começo de `app.js):
- WhatsApp está definido como `5538991234590`, derivado do número `991234590` exibido em um diretório público antigo, presumindo DDD 38. **Confirme o número com a empresa antes de divulgar o site.**
- Instagram está como `https://www.instagram.com/familiadecora_oficial/`, conforme identificação pública encontrada.

O catálogo inicial e as fotografias são ilustrativos, não um inventário confirmado. Troque por fotos, nomes, temas e condições reais autorizadas pela Família Decora. Endereço completo, preços, entrega e montagem não foram publicados por não estarem confirmados.

## Fluxo do cliente
1. Escolhe produtos e quantidades.
2. Preenche nome, telefone, data, tipo de evento, preferência de retirada/entrega, bairro e observações.
3. O navegador abre uma conversa WhatsApp com a mensagem preparada.
4. O cliente precisa apertar enviar dentro do WhatsApp. O pedido não confirma reserva; a loja confirma disponibilidade e condições.

O site não grava nome, telefone ou detalhes do evento no navegador.

## Limitações da área da equipe
`gestao.html` é somente um protótipo local, sem autenticação. Catálogo e datas anotadas são salvos no `localStorage` do navegador atual. Qualquer pessoa que conheça o endereço da área de gestão pode acessá-la. Não usar como agenda oficial nem guardar dados pessoais. Os pedidos enviados pelo WhatsApp não aparecem automaticamente nessa tela.

Para gestão real entre diferentes dispositivos/funcionários, o próximo passo é conectar um backend como Supabase, configurar autenticação, políticas de acesso e tabelas para produtos, unidades/estoque, datas, pedidos e status.

## Publicação no GitHub Pages
O repositório precisa estar configurado em **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root)**. Depois da ativação, o endereço esperado é:
`https://thiagojuniosalgado345-maker.github.io/Fam-lia-decora/`

O primeiro carregamento pode levar alguns minutos após ativar o Pages.