const { z } = require('zod');

const brandingSchema = z.object({
  logoUrl: z.string().url('URL do logo inválida.').optional().or(z.literal('')), // Allow empty string for clearing
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Cor primária inválida. Use formato hex (#RRGGBB).').optional(),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Cor secundária inválida. Use formato hex (#RRGGBB).').optional(),
  accentColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Cor de destaque inválida. Use formato hex (#RRGGBB).').optional(),
  fontFamily: z.string().optional(),
}).partial(); // All fields are optional for partial updates

const profileSchema = z.object({
  name: z.string().min(3, 'O nome do negócio deve ter pelo menos 3 caracteres.').optional(),
  phone: z.string().optional(),
}).partial(); // All fields are optional for partial updates

module.exports = { brandingSchema, profileSchema };
