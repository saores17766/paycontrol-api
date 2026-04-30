const express = require('express');
const supabase = require('../lib/supabase');
const { authMiddleware } = require('../middleware/auth');
const { createInvoiceSchema } = require('../schemas/invoiceSchemas');

const router = express.Router();

// ─── ROTA PÚBLICA: busca fatura pelo token (usada na página de pagamento) ────
// GET /invoices/pay/:token — sem autenticação (usuário final acessando o link)
router.get('/pay/:token', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v_invoices_full') // Assuming this view exists in Supabase for full invoice details + tenant theme
      .select('*')
      .eq('public_token', req.params.token)
      .single();

    if (error || !data) {
      console.error('Erro ao buscar fatura pública:', error);
      return res.status(404).json({ error: 'Fatura não encontrada ou link inválido' });
    }

    if (data.status === 'paid') {
      return res.json({
        status: 'paid',
        paidAt: data.paid_at,
        amount: data.amount,
        description: data.description,
        tenant: buildTenantTheme(data)
      });
    }

    if (data.status === 'cancelled') {
      return res.status(410).json({ error: 'Esta cobrança foi cancelada' });
    }

    // Retorna dados da fatura + tema white-label do tenant
    return res.json({
      invoice: {
        id: data.id,
        token: data.public_token,
        amount: data.amount,
        description: data.description,
        dueDate: data.due_date,
        status: data.status
      },
      endUser: {
        name: data.end_user_name,
        email: data.end_user_email
      },
      tenant: buildTenantTheme(data)
    });
  } catch (err) {
    console.error('Erro na rota pública de fatura:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

function buildTenantTheme(data) {
  return {
    name: data.tenant_name,
    slug: data.tenant_slug,
    logoUrl: data.logo_url,
    primaryColor: data.primary_color,
    secondaryColor: data.secondary_color,
    accentColor: data.accent_color,
    fontFamily: data.font_family
  };
}

// ─── ROTAS PROTEGIDAS (admin do tenant) ──────────────────────────────────────
router.use(authMiddleware);

// GET /invoices — lista faturas do tenant com filtros
router.get('/', async (req, res) => {
  try {
    const { status, clientId, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('invoices')
      .select(`
        id, amount, description, due_date, status, paid_at, public_token, created_at,
        end_users(id, full_name, email, phone)
      `, { count: 'exact' })
      .eq('tenant_id', req.user.tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (clientId) query = query.eq('end_user_id', clientId);

    const { data, error, count } = await query;
    if (error) {
      console.error('Erro ao buscar faturas:', error);
      return res.status(500).json({ error: 'Erro ao buscar faturas' });
    }

    return res.json({ invoices: data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Erro ao listar faturas:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /invoices/dashboard — resumo financeiro para o painel do admin
router.get('/dashboard', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Tenta usar RPC se existir, senão faz o fallback manual
    const { data: rpcStats, error: rpcError } = await supabase.rpc('get_tenant_dashboard', { p_tenant_id: tenantId });

    if (rpcStats && !rpcError) {
      return res.json(rpcStats);
    }

    // Fallback manual se RPC não existir ou falhar
    const [pending, paid, overdue, total] = await Promise.all([
      supabase.from('invoices').select('amount', { count: 'exact' }).eq('tenant_id', tenantId).eq('status', 'pending'),
      supabase.from('invoices').select('amount', { count: 'exact' }).eq('tenant_id', tenantId).eq('status', 'paid'),
      supabase.from('invoices').select('amount', { count: 'exact' }).eq('tenant_id', tenantId).eq('status', 'overdue'),
      supabase.from('invoices').select('amount', { count: 'exact' }).eq('tenant_id', tenantId)
    ]);

    const sumAmounts = (rows) => (rows.data || []).reduce((acc, r) => acc + Number(r.amount), 0);

    return res.json({
      pending:  { count: pending.count,  total: sumAmounts(pending) },
      paid:     { count: paid.count,     total: sumAmounts(paid) },
      overdue:  { count: overdue.count,  total: sumAmounts(overdue) },
      allTime:  { count: total.count,    total: sumAmounts(total) }
    });
  } catch (err) {
    console.error('Erro ao buscar dashboard de faturas:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /invoices — criar nova fatura e gerar link de pagamento
router.post('/', async (req, res) => {
  try {
    const { clientId, amount, description, dueDate } = createInvoiceSchema.parse(req.body);

    // Verifica se cliente pertence ao tenant
    const { data: client, error: clientError } = await supabase
      .from('end_users')
      .select('id, full_name, email')
      .eq('id', clientId)
      .eq('tenant_id', req.user.tenantId)
      .single();

    if (clientError || !client) {
      console.error('Erro ao verificar cliente para fatura:', clientError);
      return res.status(404).json({ error: 'Cliente não encontrado ou não pertence ao seu tenant' });
    }

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        tenant_id: req.user.tenantId,
        end_user_id: clientId,
        amount: Number(amount),
        description,
        due_date: dueDate
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar fatura:', error);
      return res.status(500).json({ error: 'Erro ao criar fatura' });
    }

    // Monta o link público de pagamento
    const paymentLink = `${process.env.FRONTEND_URL}/pagar/${invoice.public_token}`;

    await supabase.from('audit_logs').insert({
      tenant_id: req.user.tenantId,
      actor_id: req.user.id,
      actor_type: 'tenant_user',
      action: 'invoice.created',
      entity_type: 'invoice',
      entity_id: invoice.id,
      metadata: { amount, clientId, dueDate }
    });

    return res.status(201).json({
      invoice,
      paymentLink,
      message: `Fatura criada! Envie este link para ${client.full_name}: ${paymentLink}`
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Erro ao criar fatura:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /invoices/:id/cancel — cancelar fatura
router.patch('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('invoices')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('tenant_id', req.user.tenantId)
      .in('status', ['pending', 'overdue']) // Só pode cancelar faturas pendentes ou vencidas
      .select()
      .single();

    if (error || !data) {
      console.error('Erro ao cancelar fatura:', error);
      return res.status(404).json({ error: 'Fatura não encontrada ou não pode ser cancelada' });
    }

    await supabase.from('audit_logs').insert({
      tenant_id: req.user.tenantId,
      actor_id: req.user.id,
      actor_type: 'tenant_user',
      action: 'invoice.cancelled',
      entity_type: 'invoice',
      entity_id: id
    });

    return res.json({ invoice: data, message: 'Fatura cancelada com sucesso' });
  } catch (err) {
    console.error('Erro ao cancelar fatura:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
