# PayControl API v2 🚀

Backend reconstruído do **PayControl** — SaaS multi-tenant de cobranças com white-label por subdomínio. Esta versão foca em segurança, validação de dados e arquitetura limpa.

## 🛠️ Stack
- **Node.js** + **Express**
- **Supabase** (PostgreSQL) — Banco de dados e Auth
- **Zod** — Validação de esquemas e tipos
- **JWT** — Autenticação segura
- **Vercel** — Deploy otimizado

## 📁 Estrutura do Projeto
```
paycontrol-v2/
├── api/
│   └── index.js      # Entry point e configuração do Express
├── lib/
│   └── supabase.js   # Cliente Supabase (Service Role)
├── middleware/
│   └── auth.js       # JWT Auth e Tenant Guard
├── routes/
│   ├── auth.js       # Login e Registro
│   ├── clients.js    # CRUD de Clientes
│   ├── invoices.js   # Faturas e Link de Pagamento
│   └── tenant.js     # Configurações de Branding
├── schemas/
│   └── ...           # Validações Zod por recurso
├── vercel.json       # Configuração de deploy
└── package.json
```

## 🚀 Melhorias Implementadas
1. **Validação com Zod:** Todas as entradas da API são validadas rigorosamente, prevenindo erros de banco e dados malformados.
2. **Segurança Reforçada:** Implementação de `express-rate-limit` em rotas sensíveis e isolamento estrito de tenants via `tenant_id`.
3. **Arquitetura Limpa:** Separação clara entre rotas, lógica de negócio e validação.
4. **Tratamento de Erros Global:** Middleware centralizado para capturar e formatar erros de forma padronizada.
5. **Deploy Otimizado:** Configuração pronta para Vercel usando a estrutura de pastas recomendada.

## ⚙️ Configuração
1. Clone o repositório.
2. Instale as dependências: `npm install`.
3. Configure o arquivo `.env` baseado no `.env.example`.
4. Execute em desenvolvimento: `npm run dev`.

## 🔐 Variáveis de Ambiente
| Variável | Descrição |
|---|---|
| `SUPABASE_URL` | URL do seu projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Service Role Key (privada) |
| `JWT_SECRET` | Chave para assinatura de tokens |
| `FRONTEND_URL` | URL do seu frontend (CORS) |
