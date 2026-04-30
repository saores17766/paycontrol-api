const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email('Email inválido.').toLowerCase(),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
});

const registerSchema = z.object({
  tenantName: z.string().min(3, 'O nome do negócio deve ter pelo menos 3 caracteres.'),
  slug: z.string()
    .min(3, 'O subdomínio deve ter pelo menos 3 caracteres.')
    .regex(/^[a-z0-9-]+$/, 'O subdomínio deve conter apenas letras minúsculas, números e hífens.')
    .toLowerCase(),
  email: z.string().email('Email inválido.').toLowerCase(),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
  fullName: z.string().min(3, 'O nome completo deve ter pelo menos 3 caracteres.'),
  phone: z.string().optional(),
});

module.exports = { loginSchema, registerSchema };
