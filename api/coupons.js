module.exports = async (req, res) => {
  // Variáveis de ambiente da Vercel
  const AWIN_TOKEN = process.env.AWIN_API_TOKEN;
  const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;

  if (!AWIN_TOKEN || !PUBLISHER_ID) {
    return res.status(500).json({ error: 'Faltam chaves de API no servidor.' });
  }

  try {
    // URL corrigida: publisher (singular) e relationship=joined
    const url = `https://api.awin.com/publisher/${PUBLISHER_ID}/promotions?relationship=joined`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AWIN_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CupaOferta-App'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Erro AWIN API:', errText);
      throw new Error(`AWIN respondeu com status ${response.status}`);
    }

    const data = await response.json();

    // Formata para o frontend
    const formatted = data.map(promo => ({
      promotionId: promo.promotionId,
      advertiser: { 
        name: promo.advertiser?.name || 'Loja Parceira', 
        id: promo.advertiser?.id 
      },
      code: promo.code || null,
      description: promo.title || promo.description,
      trackingUrl: promo.clickUrl || promo.trackingUrl,
      endDate: promo.endDate
    }));

    // Cache de 1 hora
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    
    return res.status(200).json(formatted);

  } catch (error) {
    console.error('Erro no servidor:', error);
    return res.status(500).json({ error: 'Falha interna ao buscar ofertas.' });
  }
};