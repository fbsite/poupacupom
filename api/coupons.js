export default async function handler(req, res) {
  // A Vercel injetará suas chaves de API (definidas no painel da Vercel)
  const AWIN_TOKEN = process.env.AWIN_API_TOKEN;
  const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;

  // Verifica se as variáveis de ambiente existem
  if (!AWIN_TOKEN || !PUBLISHER_ID) {
    return res.status(500).json({ 
      error: 'Configuração do servidor incompleta: Faltam variáveis de ambiente.' 
    });
  }

  try {
    // --- CORREÇÃO APLICADA AQUI ---
    // 1. 'publisher' no singular.
    // 2. Adicionado '?relationship=joined' para pegar apenas ofertas de programas aceitos.
    const url = `https://api.awin.com/publisher/${PUBLISHER_ID}/promotions?relationship=joined`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AWIN_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CupaOferta-App/1.0' // Boa prática identificar o app
      }
    });

    // Se a AWIN rejeitar, capturamos o motivo exato
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da API AWIN:', response.status, errorText);
      throw new Error(`AWIN API respondeu com ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // Mapeamento dos dados para o formato simples que nosso Frontend espera
    // Isso protege sua API Key e limpa dados desnecessários
    const formattedCoupons = data.map(promo => ({
      promotionId: promo.promotionId,
      advertiser: { 
        name: promo.advertiser?.name || 'Parceiro', 
        id: promo.advertiser?.id 
      },
      // Algumas promoções não têm código (são apenas ofertas), tratamos isso
      code: promo.code || null,
      description: promo.title || promo.description,
      // Prioriza o clickUrl (link de afiliado já pronto)
      trackingUrl: promo.clickUrl || promo.trackingUrl, 
      endDate: promo.endDate,
      // Tenta pegar a logo, ou usa null para o frontend usar fallback
      logoUrl: promo.advertiser?.logoUrl || null
    }));

    // Configura Cache da Vercel (Edge Cache)
    // Cache por 1 hora (3600s) para performance rápida e economizar chamadas de API
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=59');
    
    return res.status(200).json(formattedCoupons);

  } catch (error) {
    console.error('Falha crítica no backend:', error.message);
    // Retorna erro 500 mas com JSON para o frontend não quebrar
    return res.status(500).json({ 
      error: 'Não foi possível buscar as ofertas no momento.',
      details: error.message // Útil para debug nos logs da Vercel
    });
  }
}