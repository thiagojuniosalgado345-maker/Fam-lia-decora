# Família Decora

Site independente da loja Família Decora. Este repositório não depende do BuscaAcademias.

## Estrutura
- \`index.html\`: loja pública, catálogo, filtros e formulário de orçamento.
- \`style.css\`: identidade visual rosa-claro, branco e rosé, responsiva e com ajustes de leitura/acessibilidade.
- \`app.js\`: catálogo, orçamento via WhatsApp, validação dos dados locais e acessibilidade do painel lateral.
- \`gestao.html\`, \`gestao.css\`, \`gestao.js\`: ferramenta local de demonstração para adicionar, editar, excluir e importar/exportar produtos e anotar datas.

## Dados comerciais que precisam de confirmação
- WhatsApp configurado: \`+55 38 99123-4590\`. O número aparece em um anúncio público de terceiros. **A loja deve confirmar que continua correto antes de divulgar o site.**
- Instagram configurado: [@familiadecora_oficial](https://www.instagram.com/familiadecora_oficial/). A identificação aparece em anúncio público de terceiros; confirme se é o perfil oficial.
- Endereço citado em anúncio público: Avenida Coronel Luiz Maia, 1717, Santa Lúcia, Montes Claros. Não foi colocado como endereço confirmado no site.
- O catálogo inicial e as fotografias são ilustrativos, não um inventário confirmado. Troque por fotos, nomes, temas e condições reais autorizadas pela Família Decora.
- Preços, estoque, disponibilidade por item, taxas de entrega e montagem não foram confirmados e não são prometidos pelo site.

## Fluxo do cliente
1. Escolhe produtos e quantidades.
2. Preenche nome, telefone, data, tipo de evento, preferência de retirada/entrega, bairro e observações.
3. O cliente marca o consentimento para compartilhar os dados do orçamento.
4. Como o WhatsApp ainda não foi confirmado, o navegador copia a mensagem e abre o Instagram para que o cliente a cole na conversa. Depois da confirmação do telefone oficial, o fluxo poderá abrir o WhatsApp diretamente.
5. O cliente revisa e envia a mensagem. O pedido não confirma reserva; a loja confirma disponibilidade, valores e condições.

O site não grava nome, telefone ou detalhes do evento. Os dados só são preparados no navegador para compartilhamento pelo canal escolhido pelo cliente.

## Limitações importantes da área da equipe
\`gestao.html\` é uma ferramenta provisória local, sem autenticação. Catálogo e datas são salvos no \`localStorage\` do navegador atual. As alterações não são compartilhadas entre celulares/computadores nem entre usuários. O painel não é seguro para uso comercial ou dados de clientes; qualquer pessoa que descubra o endereço pode abrir a página. A remoção do link público e a instrução \`noindex\` não substituem login.

Os pedidos enviados pelo Instagram ou WhatsApp não aparecem automaticamente no painel. A agenda local permite várias festas no mesmo dia. Cada evento pode reservar itens e quantidades; o sistema soma as reservas ativas e os bloqueios manuais por data e impede exceder o estoque cadastrado. Um painel/objeto pode ser marcado manualmente como indisponível por período e liberado depois. O botão de backup exporta festas e bloqueios em JSON. Essas informações continuam somente no navegador atual e não são sincronizadas entre aparelhos.

Para gestão real, é necessário conectar um backend (por exemplo, Supabase), configurar autenticação, políticas de acesso e tabelas para produtos, estoque, datas, pedidos e status. Não inserir chaves administrativas no JavaScript público.

## Publicação
O repositório já usa GitHub Actions para publicar o diretório raiz no GitHub Pages. Em **Settings → Pages → Build and deployment**, a origem deve permanecer em **GitHub Actions**.

Endereço esperado:
\`https://thiagojuniosalgado345-maker.github.io/Fam-lia-decora/\`

A execução de publicação mais recente pode ser acompanhada em:
https://github.com/thiagojuniosalgado345-maker/Fam-lia-decora/actions
