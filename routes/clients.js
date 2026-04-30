const express = require('express');
const supabase = require('../lib/supabase');
const { authMiddleware } = require('../middleware/auth');
const { createClientSchema, updateClientSchema } = require('../schemas/clientSchemas');

const router = express.Router();
router.use(authMiddleware);

// GET /clients — lista clientes do tenant logado
router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('end_users')
      .select('id, full_name, email, phone, cpf, is_active, created_at', { count: 'exact' })
      .eq('tenant_id', req.user.tenantId)
      .eq('is_active', true)
      .order('full_name')
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar clientes:', error);
      return res.status(500).json({ error: 'Erro ao buscar clientes' });
    }

    return res.json({ clients: data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Erro ao listar clientes:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /clients/:id — detalhe do cliente + faturas recentes
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: client, error } = await supabase
      .from('end_users')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', req.user.tenantId)
      .single();

    if (error || !client) {
      console.error('Erro ao buscar cliente:', error);
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    // Busca faturas do cliente
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('id, amount, description, due_date, status, paid_at, public_token')
      .eq('end_user_id', client.id)
      .eq('tenant_id', req.user.tenantId) // Ensure invoices belong to the tenant
      .order('due_date', { ascending: false })
      .limit(10);

    if (invoicesError) {
      console.error('Erro ao buscar faturas do cliente:', invoicesError);
      // Do not return 500, just an empty array or log the error
    }

    return res.json({ client, invoices: invoices || [] });
  } catch (err) {
    console.error('Erro ao obter detalhes do cliente:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /clients — cadastrar novo cliente
router.post('/', async (req, res) => {
  try {
    const { fullName, email, phone, cpf, notes } = createClientSchema.parse(req.body);

    const { data, error } = await supabase
      .from('end_users')
      .insert({
        tenant_id: req.user.tenantId,
        full_name: fullName,
        email: email?.toLowerCase(),
        phone,
        cpf,
        notes
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao cadastrar cliente:', error);
      if (error.code === '23505') return res.status(409).json({ error: 'Cliente com este email ou CPF já cadastrado' });
      return res.status(500).json({ error: 'Erro ao cadastrar cliente' });
    }

    await supabase.from('audit_logs').insert({
      tenant_id: req.user.tenantId,
      actor_id: req.user.id,
      actor_type: 'tenant_user',
      action: 'end_user.created',
      entity_type: 'end_user',
      entity_id: data.id
    });

    return res.status(201).json({ client: data });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Erro ao criar cliente:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /clients/:id — editar cliente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = updateClientSchema.parse(req.body);

    const { data, error } = await supabase
      .from('end_users')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', req.user.tenantId)
      .select()
      .single();

    if (error || !data) {
      console.error('Erro ao editar cliente:', error);
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    await supabase.from('audit_logs').insert({
      tenant_id: req.user.tenantId,
      actor_id: req.user.id,
      actor_type: 'tenant_user',
      action: 'end_user.updated',
      entity_type: 'end_user',
      entity_id: data.id,
      metadata: updates
    });

    return res.json({ client: data });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Erro ao atualizar cliente:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /clients/:id — desativar cliente (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('end_users')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', req.user.tenantId);

    if (error) {
      console.error('Erro ao desativar cliente:', error);
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    await supabase.from('audit_logs').insert({
      tenant_id: req.user.tenantId,
      actor_id: req.user.id,
      actor_type: 'tenant_user',
      action: 'end_user.deactivated',
      entity_type: 'end_user',
      entity_id: id
    });

    return res.json({ message: 'Cliente removido com sucesso' });
  } catch (err) {
    console.error('Erro ao desativar cliente:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
