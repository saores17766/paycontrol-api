const express = require('express');
const supabase = require('../lib/supabase');
const { authMiddleware } = require('../middleware/auth');
const { brandingSchema, profileSchema } = require('../schemas/tenantSchemas');

const router = express.Router();
router.use(authMiddleware);

// GET /tenant — dados do tenant logado
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, slug, name, logo_url, primary_color, secondary_color, accent_color, font_family, email, phone, plan, is_active, created_at')
      .eq('id', req.user.tenantId)
      .single();

    if (error || !data) {
      console.error('Erro ao buscar tenant:', error);
      return res.status(404).json({ error: 'Tenant não encontrado' });
    }
    return res.json({ tenant: data });
  } catch (err) {
    console.error('Erro ao buscar dados do tenant:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /tenant/branding — atualizar identidade visual (white-label)
router.put('/branding', async (req, res) => {
  try {
    const updates = brandingSchema.parse(req.body);

    const { data, error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', req.user.tenantId)
      .select()
      .single();

    if (error || !data) {
      console.error('Erro ao atualizar identidade visual:', error);
      return res.status(500).json({ error: 'Erro ao atualizar identidade visual' });
    }

    await supabase.from('audit_logs').insert({
      tenant_id: req.user.tenantId,
      actor_id: req.user.id,
      actor_type: 'tenant_user',
      action: 'tenant.branding_updated',
      entity_type: 'tenant',
      entity_id: req.user.tenantId,
      metadata: updates
    });

    return res.json({
      tenant: data,
      message: 'Identidade visual atualizada com sucesso!'
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Erro ao atualizar branding do tenant:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /tenant/profile — atualizar dados gerais (nome, email, telefone)
router.put('/profile', async (req, res) => {
  try {
    const updates = profileSchema.parse(req.body);

    const { data, error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', req.user.tenantId)
      .select()
      .single();

    if (error || !data) {
      console.error('Erro ao atualizar perfil:', error);
      return res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }

    // Log de auditoria para atualização de perfil
    await supabase.from('audit_logs').insert({
      tenant_id: req.user.tenantId,
      actor_id: req.user.id,
      actor_type: 'tenant_user',
      action: 'tenant.profile_updated',
      entity_type: 'tenant',
      entity_id: req.user.tenantId,
      metadata: updates
    });

    return res.json({ tenant: data, message: 'Perfil atualizado com sucesso!' });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Erro ao atualizar perfil do tenant:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
