# MEUCBFPM

Aplicação de estudos com React, TanStack Start, Supabase e OpenAI, preparada para Cloudflare Workers e hospedagem Node.js.

## Desenvolvimento

Use Node.js 24 (ou 22.13+), copie `.env.example` para `.env` e preencha as chaves localmente.

```sh
npm ci
npm run dev
```

## Produção

```sh
npm ci
npm run build
npm start
```

O servidor é gerado em `.output/server/index.mjs`. Configure as variáveis `VITE_*` antes do build e os segredos do servidor no ambiente de execução. Não publique arquivos `.env` ou chaves.

Para publicar na Cloudflare, consulte [CLOUDFLARE.md](CLOUDFLARE.md) e execute `npm run build:cloudflare`. O arquivo `wrangler.jsonc` configura o Worker e os assets.

Consulte [HOSTINGER.md](HOSTINGER.md) para a alternativa Node.js no hPanel. As migrações e a conta administrativa já foram configuradas no novo Supabase; não execute instalação inicial novamente sobre o banco existente.

`MEUCBFPM-projeto.zip` é o arquivo original preservado. O código atualizado está na raiz deste repositório; use `package.json` e `package-lock.json` para instalar e construir.
