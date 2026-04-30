const { z } = require('zod');

const createClientSchema = z.object({
  fullName: z.string().min(3, 'O nome completo deve ter pelo menos 3 caracteres.'),
  email: z.string().email('Email inválido.').toLowerCase().optional().or(z.literal('')), // Allow empty string
  phone: z.string().optional(),
  cpf: z.string().optional(),
  notes: z.string().optional(),
});

const updateClientSchema = z.object({
  fullName: z.string().min(3, 'O nome completo deve ter pelo menos 3 caracteres.').optional(),
  email: z.string().email('Email inválido.').toLowerCase().optional().or(z.literal('')), // Allow empty string
  phone: z.string().optional(),
  cpf: z.string().optional(),
  notes: z.string().optional(),
}).partial(); // All fields are optional for partial updates

module.exports = { createClientSchema, updateClientSchema };
