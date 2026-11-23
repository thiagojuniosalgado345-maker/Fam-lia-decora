# Família Decora

Site independente da loja Família Decora. Este repositório não depende do BuscaAcademias.

## Estrutura
- `index.html`, `style.css`, `app.js`: loja pública, catálogo, busca, orçamento e consulta de disponibilidade pela data do evento.
- `gestao.html`, `gestao.css`, `gestao.js`: calendário, cadastro de festas, reservas por item, bloqueios manuais, estoque, backup e sincronização.
- `data/agenda.json`: arquivo central usado pelo GitHub. Contém o catálogo e os totais públicos de disponibilidade; os detalhes da agenda são criptografados.
- `scripts/validate-site.mjs`: validação da estrutura, referências, dados e funções essenciais.
- `.github/workflows/deploy-pages.yml`: valida e publica o site no GitHub Pages.

## Fluxo da vitrine para o cliente

- O cliente escolhe a data no início do catálogo; o mesmo valor é sincronizado com o formulário do orçamento.
- Cada cartão tem uma área de detalhes com descrição e disponibilidade da data selecionada.
- Adicionar uma peça não abre mais o orçamento automaticamente: o cliente pode continuar navegando e usar o atalho flutuante ou o botão do cabeçalho quando terminar.
- A seleção de produtos e quantidades fica somente no armazenamento local do navegador do visitante. Nome, telefone e informações do evento não são persistidos pelo site.
- A seleção pode permanecer no mesmo aparelho após fechar ou atualizar a página. Limpar a seleção remove esses itens do navegador.

## Aplicativo instalável do painel de gestão

O painel pode ser adicionado à tela inicial do Android, iPhone/iPad ou computador como um aplicativo da web (PWA). O manifesto `manifest-gestao.webmanifest` abre diretamente `gestao.html` em modo independente. O painel instalado usa a mesma agenda, o mesmo catálogo e o mesmo repositório GitHub do site.

- Android: abra o painel no Chrome e use **Instalar app** ou **Adicionar à tela inicial** no menu.
- iPhone/iPad: abra o endereço no Safari, toque em **Compartilhar → Adicionar à Tela de Início** e ative **Abrir como App** quando disponível.
- Computador: use o ícone de instalação do Chrome/Edge ou a opção correspondente no menu do navegador.

A instalação é um atalho de aplicativo, não um aplicativo nativo distribuído pela Play Store/App Store. É necessário ter internet para consultar e salvar agenda, estoque e fotos no GitHub. Não habilite gravações offline: isso poderia deixar a equipe trabalhando com estoque desatualizado.

## Como a agenda funciona sem outro serviço
A área de gestão grava diretamente no arquivo `data/agenda.json`, usando a API oficial de conteúdo do GitHub. Não há Supabase, Firebase ou outro banco externo.

1. Abra `gestao.html` no endereço publicado.
2. Crie um token **Fine-grained** no GitHub, limitado ao repositório `Fam-lia-decora`, com a permissão **Contents: Read and write**. Não dê acesso a todos os repositórios.
3. Informe o token e uma senha forte da agenda com pelo menos 16 caracteres.
4. Confira e cadastre os produtos e o estoque físico. Só então marque **Publicar disponibilidade por data na loja**. A publicação começa desativada para evitar mostrar como disponível um estoque de exemplo ainda não conferido.
5. A senha deriva uma chave com PBKDF2-SHA-256 (310.000 iterações); os detalhes de festas e bloqueios são criptografados com AES-256-GCM antes de o navegador enviar o arquivo ao GitHub.
6. O token e a senha da agenda ficam somente na memória da página. Não são gravados no repositório nem no armazenamento do navegador. Ao fechar ou atualizar a página, será necessário informá-los novamente.
7. O arquivo de dados é gravado com controle de versão do GitHub. Se outro acesso tiver atualizado o arquivo, o painel detecta a divergência e pede atualização para evitar sobrescrever a agenda mais nova.

A primeira conexão pode oferecer a migração de produtos, festas e bloqueios que estavam salvos no armazenamento local deste navegador. Exporte uma cópia completa antes de migrar ou restaurar dados importantes.

## Adicionar fotos diretamente pelo painel

A dona da loja pode cadastrar uma peça e enviar sua própria foto sem abrir o GitHub separadamente:

1. Abra a área de gestão, conecte ao GitHub e carregue a agenda.
2. Em **Produtos e quantidade em estoque**, preencha o nome, categoria (por exemplo: Vasos, Painéis, Móveis, Bandejas ou Kits), estoque e descrição.
3. Toque em **Foto do objeto, painel, vaso ou kit** e escolha uma imagem da galeria ou tire uma foto pelo celular.
4. Confira a prévia e toque em **Salvar produto**. A foto é redimensionada para no máximo 1.800 px, convertida para WebP quando o navegador suporta esse formato e enviada para `assets/products/` no GitHub. A imagem é vinculada ao produto no catálogo e publicada junto com o site.
5. A foto original pode ter até 12 MB; o arquivo otimizado precisa ficar abaixo de 5 MB. A conversão por canvas remove metadados como localização GPS do arquivo original.

As fotos do catálogo são públicas, pois o repositório e a vitrine são públicos. Envie somente imagens dos produtos da loja, sem pessoas, documentos, endereços ou outros dados privados. Ao substituir uma foto, o arquivo anterior permanece no repositório como histórico; ele não é apagado automaticamente.

## O que aparece para os visitantes
O site GitHub Pages e o arquivo de dados publicado são acessíveis publicamente. Por isso, o arquivo publicado contém apenas:
- produtos, imagens, descrições e quantidade física cadastrada;
- quantidade livre por peça e data, sem nome, código ou observações da festa.

Os detalhes de eventos, códigos de pedidos, observações e bloqueios manuais ficam dentro do campo criptografado `privateAgenda`. O catálogo e os números de disponibilidade por data são públicos; visitantes podem consultar a quantidade livre quando escolhem a data no orçamento. A vitrine atualiza os dados periodicamente e também após recarregar.

Mesmo criptografados, use códigos internos de pedido (por exemplo, `FD-001`) em vez de nomes completos. Não registre telefone, CPF, endereço residencial, dados de pagamento ou qualquer informação sensível na agenda ou nas observações. A senha deve ser longa, exclusiva e guardada em local seguro. Sem ela, não será possível abrir a parte privada do arquivo.

## Regras do estoque e da agenda
- É possível cadastrar várias festas na mesma data.
- As quantidades de festas confirmadas e em negociação ocupam estoque; as canceladas liberam. Festas concluídas permanecem no histórico.
- Os bloqueios manuais contam desde a data inicial até a data final, inclusive.
- O sistema não permite reservar ou bloquear mais unidades do que o estoque disponível.
- A disponibilidade pública é calculada por data e não revela os dados de cada festa.
- Fora do intervalo público de datas calculado, a vitrine orienta o visitante a consultar a equipe, em vez de presumir disponibilidade.
- A solicitação de orçamento enviada pelo cliente não confirma uma reserva. A equipe ainda precisa validar o pedido.

## Backups
Use **Baixar cópia completa da agenda** antes de mudanças importantes. O arquivo exportado contém dados descriptografados para permitir a restauração; mantenha-o em local privado. A opção **Restaurar cópia completa** valida produtos, referências e estoque antes de substituir os dados do GitHub.

## Dados comerciais ainda pendentes de confirmação
- O WhatsApp oficial não está configurado no código até a loja confirmar o número.
- O Instagram `@familiadecora_oficial` deve ser confirmado pela loja antes de ser tratado como perfil oficial.
- O catálogo inicial contém produtos e fotografias ilustrativos, com estoque provisório, não um inventário confirmado. Atualize nomes, fotos, temas e quantidades reais e só depois ative a publicação de disponibilidade.
- Preços, taxas de entrega e montagem ainda não foram confirmados.

## Limitações importantes
Este arranjo usa o próprio GitHub como armazenamento de arquivos, não é um banco transacional. A checagem de versão ajuda a evitar que um painel sobrescreva uma alteração recente, mas não oferece garantias de um sistema de reservas de grande volume com bloqueios transacionais simultâneos. Para uma única equipe pequena, mantenha um responsável por salvar a agenda por vez e atualize o painel antes de continuar quando houver conflito.

O token dá permissão de escrita no conteúdo do repositório escolhido. Crie-o com escopo mínimo, nunca o cole em mensagens, nunca o coloque no código e revogue-o nas configurações do GitHub se suspeitar de exposição.

## Publicação
Em **Settings → Pages → Build and deployment**, mantenha a origem **GitHub Actions**.

Loja: https://thiagojuniosalgado345-maker.github.io/Fam-lia-decora/

Gestão: https://thiagojuniosalgado345-maker.github.io/Fam-lia-decora/gestao.html

Execuções: https://github.com/thiagojuniosalgado345-maker/Fam-lia-decora/actions
### Atenção à política do GitHub Pages

A política atual do GitHub informa que o Pages não pode ser usado como hospedagem gratuita para operar um negócio on-line, uma loja/e-commerce ou um site principalmente destinado a facilitar transações comerciais. Como este projeto divulga locação de peças e facilita pedidos de orçamento, pode se enquadrar nessa restrição. O repositório GitHub pode continuar guardando o código e os dados, mas não trate o GitHub Pages gratuito como hospedagem comercial de produção sem confirmar a permissão aplicável com o GitHub.
