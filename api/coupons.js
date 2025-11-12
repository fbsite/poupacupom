// Usando o formato clássico para evitar erros de deploy na Vercel
module.exports = async (req, res) => {
  // A Vercel injetará suas chaves de API
  const AWIN_TOKEN = process.env.AWIN_API_TOKEN;
  const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;

  // Verifica se as variáveis de ambiente existem
  if (!AWIN_TOKEN || !PUBLISHER_ID) {
    return res.status(500).json({ 
      error: 'Configuração do servidor incompleta: Faltam variáveis de ambiente.' 
    });
  }

  try {
    // Rota correta: 'publisher' (singular) e com filtro 'joined'
    const url = `https://api.awin.com/publisher/${PUBLISHER_ID}/promotions?relationship=joined`;

    // O 'fetch' é nativo no Node.js 18+, que é o padrão da Vercel
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AWIN_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CupaOferta-App/1.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da API AWIN:', response.status, errorText);
      throw new Error(`AWIN API respondeu com ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    const formattedCoupons = data.map(promo => ({
      promotionId: promo.promotionId,
      advertiser: { 
        name: promo.advertiser?.name || 'Parceiro', 
        id: promo.advertiser?.id 
      },
      code: promo.code || null,
      description: promo.title || promo.description,
      trackingUrl: promo.clickUrl || promo.trackingUrl, 
      endDate: promo.endDate,
      logoUrl: promo.advertiser?.logoUrl || null
    }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=59');
    
    return res.status(200).json(formattedCoupons);

  } catch (error) {
    console.error('Falha crítica no backend:', error.message);
    return res.status(500).json({ 
      error: 'Não foi possível buscar as ofertas no momento.',
      details: error.message 
    });
  }
};