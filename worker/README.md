# Serviço seguro da Família Decora (Cloudflare Worker)

O Worker intermedia o painel e o GitHub. O Cloudflare Access autentica a dona da loja por PIN de e-mail; o Worker usa um GitHub App limitado ao repositório e criptografa os dados privados antes de gravá-los.

## 1. Criar o GitHub App

1. Entre no GitHub que administra o repositório.
2. Abra **Settings → Developer settings → GitHub Apps → New GitHub App**.
3. Nome: **Família Decora Gestão**.
4. Em **Repository permissions**, configure somente **Contents: Read and write**.
5. Não configure Webhooks nem permissões extras.
6. Copie o **App ID** para `GITHUB_APP_ID` em `wrangler.toml`.
7. Gere uma chave privada em **Private keys** e guarde o arquivo PEM.
8. Em **Install App**, instale o App somente no repositório **Fam-lia-decora**.

## 2. Publicar o Worker

1. Crie ou acesse a conta Cloudflare.
2. Instale Node.js e abra um terminal dentro da pasta `worker` deste repositório.
3. Edite `wrangler.toml`: preencha somente `GITHUB_APP_ID`. O e-mail autorizado será cadastrado como Secret `ADMIN_EMAIL`, para não ficar exposto no repositório.
4. Execute `npx wrangler login`.
5. Cadastre os Secrets. O primeiro recebe o PEM integral da chave privada do GitHub App. Gere as outras duas chaves aleatoriamente no computador:
   - `SESSION_SIGNING_KEY`: resultado de `openssl rand -hex 32`.
   - `AGENDA_ENCRYPTION_KEY`: resultado de `openssl rand -base64 32` (Base64 de 32 bytes).

```bash
cat caminho/para/chave-privada.pem | npx wrangler secret put GITHUB_APP_PRIVATE_KEY
npx wrangler secret put SESSION_SIGNING_KEY
npx wrangler secret put AGENDA_ENCRYPTION_KEY
npx wrangler secret put ADMIN_EMAIL
```

O Wrangler solicitará os valores no terminal. Para `SESSION_SIGNING_KEY`, informe uma sequência aleatória longa; para `AGENDA_ENCRYPTION_KEY`, informe uma chave aleatória Base64 de 32 bytes (por exemplo, gerada com `openssl rand -base64 32`). Para `ADMIN_EMAIL`, informe o endereço exato liberado na política do Access. Não coloque nenhum desses valores no GitHub, em mensagens ou em `wrangler.toml`.

6. Publique:
```bash
npx wrangler deploy
```
7. Copie a URL do Worker exibida pelo Cloudflare.

## 3. Ativar PIN de e-mail no Cloudflare Access

1. No Cloudflare, abra **Zero Trust → Settings → Authentication / Identity Providers** e habilite **One-time PIN**, se ainda não estiver ativo.
2. Abra **Access → Applications → Add an application → Self-hosted**.
3. Nome: **Família Decora - Login da Gestão**.
4. Configure como domínio o hostname do Worker e o caminho `/auth/complete`.
5. Crie uma política **Allow** com o seletor **Emails** e somente o e-mail definido em `ADMIN_EMAIL`. Em **Require**, escolha **Login methods → One-time PIN**.
6. Salve. Proteja somente `/auth/complete`, não `/api/*`: a API usa uma sessão assinada temporária.

O PIN é de uso único e expira em 10 minutos. Endereços não autorizados não recebem o código.

## 4. Ligar o painel ao Worker

1. Edite `API_BASE_URL` no início de `gestao.js` e substitua pelo endereço do Worker, sem barra no final.
2. Envie as alterações para a branch `main` e aguarde o GitHub Actions publicar o site.
3. Abra a gestão e clique em **Entrar com e-mail**. A janela do Cloudflare pedirá o e-mail e o PIN; após confirmar, ela retorna ao painel.

A sessão dura até 8 horas e fica no armazenamento de sessão daquela aba. Os tokens de instalação do GitHub App expiram em uma hora e são renovados pelo Worker.

## 5. Testar antes de usar

- Entrar com o e-mail autorizado e confirmar que a agenda carrega.
- Tentar entrar com outro e-mail e verificar que ele é bloqueado.
- Cadastrar/editar um produto, enviar uma foto, cadastrar uma festa e bloquear uma peça.
- Verificar na vitrine que somente catálogo e disponibilidade habilitada aparecem.
- Sair da gestão e confirmar que a API recusa operações sem sessão.

## Segurança e recuperação

- A agenda privada usa AES-256-GCM. Guarde uma cópia de recuperação de `AGENDA_ENCRYPTION_KEY` em local privado; sem ela, festas e bloqueios não poderão ser abertos.
- A chave privada do GitHub App fica como Secret do Worker.
- O Worker aceita requisições somente do domínio de `ALLOWED_ORIGIN` e exige sessão assinada na API.
- O arquivo público contém somente o catálogo, a disponibilidade opcional e o bloco privado criptografado.

## Migração da versão anterior

O arquivo atualmente versionado no GitHub contém `privateAgenda: null`, portanto não há dados privados criptografados nesse arquivo para converter. Dados salvos somente no armazenamento local de outro navegador não migram automaticamente: exporte uma cópia completa no navegador antigo e importe-a após ativar o novo acesso. Backups antigos criptografados continuam dependendo da senha que os criou.
