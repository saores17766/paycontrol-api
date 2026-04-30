const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, tenantId, role, tenantSlug }
    next();
  } catch (err) {
    console.error('Erro na validação do token:', err);
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// Garante que o recurso acessado pertence ao tenant do usuário logado
function tenantGuard(req, res, next) {
  // A validação de pertencimento ao tenant deve ser feita estritamente com base no req.user.tenantId
  // extraído do JWT. O cabeçalho x-tenant-slug não deve ser usado para autorização.
  // Esta função é um placeholder para garantir que o tenantId do usuário logado seja usado em todas as queries.
  // A lógica de filtragem por tenant_id deve ser aplicada diretamente nas queries do Supabase.
  next();
}

module.exports = { authMiddleware, tenantGuard };
