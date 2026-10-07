# Publicação do MEUCBFPM na Cloudflare Workers

O projeto suporta Workers com assets e funções de servidor. O Supabase continua
responsável pelo banco, autenticação e armazenamento. As tabelas e o administrador
já existem no projeto `mdtiforoemywkrmccuia`; não reinstale as migrações.

## Conectar o GitHub no painel

1. Acesse o painel da Cloudflare, abra **Workers & Pages** e crie uma aplicação Worker.
2. Escolha importar um repositório Git e autorize o GitHub.
3. Selecione `nascimentoleo0605-collab/meucbfpmtentativa3`, branch `main`.
4. Use o nome `meucbfpm`, raiz `./`, Node.js 24 e npm.
5. Comando de build: `npm run build:cloudflare`.
6. Comando de deploy: `npx wrangler deploy --config wrangler.jsonc`.
7. Configure as variáveis de build antes de construir e os segredos de execução
   antes de usar o login e as funções administrativas.

O arquivo `wrangler.jsonc` configura o Worker, compatibilidade Node.js e os assets.
Uma primeira publicação pode usar o endereço `workers.dev` fornecido pela conta.
Um domínio próprio pode ser conectado depois; não é necessário comprar outro domínio.

## Variáveis para o build

| Nome | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://mdtiforoemywkrmccuia.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key do novo Supabase |
| `NODE_VERSION` | `24` |

Use as configurações de build do Worker conectado ao GitHub. Alterar `VITE_*`
exige um novo build. A chave publishable é pública e será usada no navegador.

## Variáveis e segredos do Worker

Abra as configurações do Worker e a seção de variáveis/segredos:

| Nome | Tipo | Valor |
| --- | --- | --- |
| `SUPABASE_URL` | Variável | Já está definida em `wrangler.jsonc` |
| `SUPABASE_PUBLISHABLE_KEY` | Variável | Mesma Publishable key do build |
| `SUPABASE_SERVICE_ROLE_KEY` | Segredo | Secret key do novo Supabase |
| `APP_OPENAI_API_KEY` | Segredo | Chave da API OpenAI, quando disponível |
| `APP_OPENAI_MODEL` | Variável | `gpt-4.1-mini`, já definida em `wrangler.jsonc` |

Insira os valores reais diretamente nos campos seguros da Cloudflare. Não coloque
chaves secretas no GitHub, em variáveis `VITE_*` ou em mensagens. Valores proxy
injetados no Codex não são chaves para copiar ao Worker. Sem a chave OpenAI, as
funções de IA continuam indisponíveis; banco e autenticação usam Supabase.

As variáveis de build não substituem os segredos de execução do Worker.
Mantenha o cadastro público desativado no Supabase.

## Publicação pelo Wrangler

Em uma máquina autenticada na Cloudflare:

```sh
npm ci
npm run build:cloudflare
npx wrangler deploy --config wrangler.jsonc --dry-run
npx wrangler deploy --config wrangler.jsonc
```

`CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` são usados pelo Wrangler e não
devem ser configurados como variáveis da aplicação. Para automação, use o modelo
de token **Edit Cloudflare Workers**, limitado à conta escolhida. Forneça esses
valores somente nas configurações seguras do ambiente que executará o deploy.

## Verificação depois da publicação

Abra `/auth` no endereço real do Worker e entre com a conta administrativa já
criada. Verifique o painel, uma leitura do banco e o funcionamento das imagens.
As funções OpenAI só podem ser verificadas depois da configuração de sua chave.

O tamanho comprimido foi verificado pelo dry-run do Wrangler: aproximadamente
1,85 MiB. O plano gratuito tem limites de requisições, CPU e tamanho de código;
confira os limites atuais da conta. A API OpenAI tem cobrança independente.

## Desenvolvimento e builds

```sh
npm run build:cloudflare
npm run preview:cloudflare
```

O build Node.js continua disponível com `npm run build` e `npm start`, seguindo
`HOSTINGER.md`. Os dois builds usam `.output`; execute o build do destino escolhido
antes de iniciar ou publicar. A emulação local não substitui a validação do site
publicado nem fornece automaticamente os segredos da conta Cloudflare.
