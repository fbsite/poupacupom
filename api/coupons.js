module.exports = async (req, res) => {
  const AWIN_TOKEN = process.env.AWIN_API_TOKEN;
  const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;

  // 1. Verificação de Segurança Inicial
  if (!AWIN_TOKEN || !PUBLISHER_ID) {
    console.error("ERRO CRÍTICO: Variáveis de ambiente não configuradas na Vercel.");
    return res.status(500).json({ 
      error: 'CONFIG_MISSING', 
      message: 'As chaves da AWIN não foram configuradas no painel da Vercel.' 
    });
  }

  try {
    // 2. Montagem da URL
    // Documentação: https://wiki.awin.com/index.php/API_get_promotions
    const url = `https://api.awin.com/publisher/${PUBLISHER_ID}/promotions?relationship=joined`;

    console.log(`Tentando conectar na AWIN: Publisher ${PUBLISHER_ID}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AWIN_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CupaOferta-App/1.0'
      }
    });

    // 3. Tratamento de Erros da API AWIN
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Erro AWIN (${response.status}):`, errorText);
      
      if (response.status === 401) {
        return res.status(401).json({ error: 'AUTH_ERROR', message: 'Token da AWIN inválido ou expirado.' });
      }
      if (response.status === 404) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Publisher ID incorreto ou rota inexistente.' });
      }
      
      return res.status(response.status).json({ error: 'API_ERROR', message: `Erro na AWIN: ${errorText}` });
    }

    const data = await response.json();

    // 4. Verifica se veio vazio (Caso comum: você não tem parcerias aprovadas ainda)
    if (!Array.isArray(data) || data.length === 0) {
      console.warn("AWIN retornou lista vazia. O usuário tem parceiros aprovados?");
      return res.status(200).json([]); // Retorna array vazio, frontend decide o que fazer
    }

    // 5. Formatação dos dados
    const formatted = data.map(promo => ({
      promotionId: promo.promotionId,
      advertiser: { 
        name: promo.advertiser?.name || 'Parceiro', 
        id: promo.advertiser?.id 
      },
      code: promo.code || null, // Se for null, é oferta de link
      description: promo.title || promo.description,
      trackingUrl: promo.clickUrl || promo.trackingUrl,
      endDate: promo.endDate,
      logoUrl: promo.advertiser?.logoUrl // Tenta pegar logo se disponível
    }));

    // Cache curto para garantir atualização rápida enquanto testa
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    
    return res.status(200).json(formatted);

  } catch (error) {
    console.error('Erro Interno do Servidor:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
};