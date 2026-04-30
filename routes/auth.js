const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');
const { loginSchema, registerSchema } = require('../schemas/authSchemas');

const router = express.Router();

// POST /auth/login — login do admin do tenant
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Busca usuário + tenant
    const { data: user, error } = await supabase
      .from('tenant_users')
      .select('id, email, password_hash, full_name, role, is_active, tenant_id, tenants(slug, name, primary_color, logo_url)')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Conta inativa. Contate o suporte.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Atualiza last_login
    await supabase
      .from('tenant_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // Gera JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        tenantId: user.tenant_id,
        tenantSlug: user.tenants.slug,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Log de auditoria
    await supabase.from('audit_logs').insert({
      tenant_id: user.tenant_id,
      actor_id: user.id,
      actor_type: 'tenant_user',
      action: 'auth.login',
      entity_type: 'tenant_user',
      entity_id: user.id,
      ip_address: req.ip
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      },
      tenant: {
        id: user.tenant_id,
        slug: user.tenants.slug,
        name: user.tenants.name,
        primaryColor: user.tenants.primary_color,
        logoUrl: user.tenants.logo_url
      }
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /auth/register — cadastro de novo tenant + admin
router.post('/register', async (req, res) => {
  try {
    const { tenantName, slug, email, password, fullName, phone } = registerSchema.parse(req.body);

    // Verifica se slug já existe
    const { data: existingTenant, error: existingTenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingTenantError && existingTenantError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Erro ao verificar slug existente:', existingTenantError);
      return res.status(500).json({ error: 'Erro ao verificar subdomínio. Tente novamente.' });
    }
    if (existingTenant) {
      return res.status(409).json({ error: 'Este subdomínio já está em uso. Escolha outro.' });
    }

    // Cria tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({ slug, name: tenantName, email, phone })
      .select()
      .single();

    if (tenantErr) {
      console.error('Erro ao criar tenant:', tenantErr);
      return res.status(500).json({ error: 'Erro ao criar conta. Tente novamente.' });
    }

    // Cria admin
    const passwordHash = await bcrypt.hash(password, 12);
    const { data: adminUser, error: userErr } = await supabase
      .from('tenant_users')
      .insert({
        tenant_id: tenant.id,
        email,
        password_hash: passwordHash,
        full_name: fullName,
        role: 'admin'
      })
      .select()
      .single();

    if (userErr) {
      console.error('Erro ao criar usuário admin:', userErr);
      // Rollback tenant creation if user creation fails (manual transaction)
      await supabase.from('tenants').delete().eq('id', tenant.id);
      return res.status(500).json({ error: 'Erro ao criar usuário admin. Tente novamente.' });
    }

    // Gera JWT
    const token = jwt.sign(
      { id: adminUser.id, email: adminUser.email, tenantId: tenant.id, tenantSlug: slug, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Conta criada com sucesso!',
      token,
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name }
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error('Erro no registro:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
