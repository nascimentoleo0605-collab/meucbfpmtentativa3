# MEUCBFPM — publicação manual na Hostinger

Use uma hospedagem com aplicações Node.js (SSR e funções de servidor).
O Gerenciador de Arquivos/public_html para sites estáticos não executa este aplicativo.

## Configuração no hPanel
- No hPanel: Sites / Adicionar site / Aplicação Node.js / Importar do GitHub.
- Autorize a Hostinger no GitHub e selecione nascimentoleo0605-collab/meucbfpmtentativa3, branch main.
- Como alternativa, envie o ZIP de código-fonte.
- Framework: Other/Outro ou Custom (TanStack Start com Vite/Nitro).
- Node.js: 24 (validado); Node 22 somente versão >=22.13.0.
- Gerenciador: npm.
- Diretório raiz: ./ (package.json está na raiz do ZIP).
- Instalação: npm ci (inclua dependências de desenvolvimento para o build).
- Build: npm run build.
- Inicialização: npm start.
- Arquivo de entrada, se solicitado: .output/server/index.mjs.
- Diretório de saída, se solicitado: .output.
- A porta PORT é fornecida pela hospedagem; não fixe uma porta local.

## Variáveis — inserir no hPanel antes do build e manter no runtime
SUPABASE_URL=https://mdtiforoemywkrmccuia.supabase.co
VITE_SUPABASE_URL=https://mdtiforoemywkrmccuia.supabase.co
SUPABASE_PUBLISHABLE_KEY=<Publishable key do novo Supabase>
VITE_SUPABASE_PUBLISHABLE_KEY=<mesma Publishable key>
SUPABASE_SERVICE_ROLE_KEY=<Secret key do novo Supabase>
APP_OPENAI_API_KEY=<chave real da API OpenAI, quando disponível>
APP_OPENAI_MODEL=gpt-4.1-mini
NODE_ENV=production
HOST=0.0.0.0

As chaves devem ser reais, obtidas nos serviços. Valores/placeholder de segredos
injetados pelo proxy do Codex não funcionam na Hostinger.
Nunca prefixe a Secret key ou a chave OpenAI com VITE_. O ZIP não contém chaves.
A API OpenAI requer sua própria chave e cobrança; uma assinatura ChatGPT não a fornece.
Se a chave OpenAI não estiver disponível, login e banco podem funcionar, mas IA fica pendente.

## Depois da publicação
- Abra https://SEU_DOMINIO/auth e use o e-mail e a senha do administrador criado.
- Se o Supabase solicitar URLs autorizadas, em Authentication / URL Configuration
  defina Site URL para https://SEU_DOMINIO e cadastre somente os redirects usados
  no domínio (por exemplo https://SEU_DOMINIO/auth).
- Mantenha o cadastro público desativado. Não reaplique as migrações: as 9 tabelas
  e o administrador já foram criados no novo Supabase.
- Verifique login, painel e uma consulta ao banco após publicar.
- Alterações em variáveis VITE_ exigem rebuild. Segredos do servidor exigem restart.

## Validação deste pacote
npm ci, TypeScript, build Nitro node-server e npm start concluídos no Node 24.
A rota /auth e o favicon retornaram HTTP 200. A função de servidor needsSetup
retornou false e reconheceu o administrador existente no novo Supabase.
Login com senha e chamada real OpenAI não foram testados. Publicação Hostinger pendente.

O pacote inclui as alterações de IA para OpenAI e usa package-lock.json de npm.
O ZIP original do repositório foi preservado. node_modules, build, .env e o
bun.lock antigo com URLs privadas do Lovable foram excluídos do pacote de envio.
