const { z } = require('zod');

const createInvoiceSchema = z.object({
  clientId: z.string().uuid('ID do cliente inválido.'),
  amount: z.number().positive('O valor deve ser positivo.'),
  description: z.string().min(3, 'A descrição deve ter pelo menos 3 caracteres.').max(255, 'A descrição não pode exceder 255 caracteres.'),
  dueDate: z.string().datetime('Formato de data de vencimento inválido. Use ISO 8601.'),
});

const updateInvoiceStatusSchema = z.object({
  status: z.enum(['paid', 'cancelled'], 'Status de fatura inválido.'),
});

module.exports = { createInvoiceSchema, updateInvoiceStatusSchema };
