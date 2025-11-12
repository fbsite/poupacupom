// api/coupons.js
export default async function handler(req, res) {
  // A Vercel injetará sua chave de API aqui (Variáveis de Ambiente)
  const AWIN_TOKEN = process.env.AWIN_API_TOKEN;
  const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;

  if (!AWIN_TOKEN || !PUBLISHER_ID) {
    return res.status(500).json({ error: 'Configuração de API ausente no servidor' });
  }

  try {
    // Exemplo de chamada para endpoint de ofertas da AWIN
    // Ajuste a URL conforme a documentação específica da AWIN para 'Offers'
    const response = await fetch(`https://api.awin.com/publishers/${PUBLISHER_ID}/promotions`, {
      headers: {
        'Authorization': `Bearer ${AWIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Erro AWIN: ${response.statusText}`);
    }

    const data = await response.json();

    // Vamos filtrar e formatar os dados para o frontend não receber lixo
    // Isso também protege dados sensíveis que a API possa retornar
    const formattedCoupons = data.map(promo => ({
      promotionId: promo.promotionId,
      advertiser: { name: promo.advertiser.name, id: promo.advertiser.id },
      code: promo.code,
      description: promo.description || promo.title,
      trackingUrl: promo.clickUrl || promo.trackingUrl, // Link de afiliado
      endDate: promo.endDate,
      logoUrl: promo.advertiser.logoUrl // Se disponível
    }));

    // Cachear a resposta por 1 hora (3600 segundos) para não estourar limite da API
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    
    return res.status(200).json(formattedCoupons);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Falha ao buscar cupons' });
  }
}

### 3. Como fazer o Deploy

1.  **Suba para o GitHub:** Coloque o `index.html` e a pasta `api/` em um repositório.
2.  **Importe na Vercel:** Vá no painel da Vercel e importe o projeto.
3.  **Variáveis de Ambiente (Environment Variables):**
    Antes de clicar em "Deploy", ou nas configurações do projeto depois, adicione:
    * `AWIN_API_TOKEN`: Sua chave gerada no painel da AWIN.
    * `AWIN_PUBLISHER_ID`: Seu ID de afiliado.

Assim que o deploy terminar, o `index.html` vai tentar acessar `/api/coupons`. Se as chaves estiverem certas, ele mostrará os cupons reais. Se não, ele mostrará os dados de teste (Demo).
