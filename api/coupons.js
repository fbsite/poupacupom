const https = require('https');

// Função auxiliar para fazer requisições HTTPS
function makeRequest(url, token, apiKey) {
    return new Promise((resolve, reject) => {
        // --- ATUALIZAÇÃO DE AUTENTICAÇÃO ---
        // Adicionamos o 'x-api-key' conforme a documentação nova.
        // Usamos a apiKey específica ou o token como fallback.
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'CupaOferta-App/1.0',
            'x-api-key': apiKey || token 
        };

        const options = { headers };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    // Aceita 200 (OK) e 206 (Partial Content - comum em listas grandes)
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(data));
                    } else {
                        reject({ status: res.statusCode, message: `Erro AWIN: ${res.statusMessage || res.statusCode}` });
                    }
                } catch (e) {
                    reject({ status: 500, message: 'Erro ao processar JSON da AWIN' });
                }
            });
        }).on('error', (err) => reject({ status: 500, message: err.message }));
    });
}

module.exports = async (req, res) => {
    // Configuração de CORS e Cache
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

    // Busca as credenciais do ambiente
    const AWIN_TOKEN = process.env.AWIN_API_TOKEN;
    const AWIN_KEY = process.env.AWIN_API_KEY; // Nova variável (opcional, fallback para TOKEN)
    const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;

    if (!AWIN_TOKEN || !PUBLISHER_ID) {
        return res.status(500).json({ 
            error: 'CONFIG_MISSING', 
            message: 'Configure AWIN_API_TOKEN e AWIN_PUBLISHER_ID na Vercel.' 
        });
    }

    try {
        let allOffers = [];

        // 1. Buscar CUPONS (Promotions API)
        // Documentação antiga: Usa Authorization Bearer
        try {
            const couponsData = await makeRequest(
                `https://api.awin.com/publisher/${PUBLISHER_ID}/promotions?relationship=joined`, 
                AWIN_TOKEN,
                AWIN_KEY
            );

            if (Array.isArray(couponsData)) {
                const formattedCoupons = couponsData.map(promo => ({
                    type: 'coupon',
                    promotionId: promo.promotionId,
                    advertiser: { name: promo.advertiser.name, id: promo.advertiser.id },
                    code: promo.code,
                    description: promo.title || promo.description,
                    trackingUrl: promo.clickUrl || promo.trackingUrl,
                    endDate: promo.endDate || 'Em breve',
                    logoUrl: null
                }));
                allOffers = [...allOffers, ...formattedCoupons];
            }
        } catch (err) {
            console.warn("API Promos:", err.message);
        }

        // 2. Buscar PRODUTOS (Product API)
        // Documentação nova: Exige x-api-key
        if (allOffers.length < 6) {
            try {
                const productsData = await makeRequest(
                    `https://api.awin.com/publishers/${PUBLISHER_ID}/product-search?min_price=10&limit=12`, 
                    AWIN_TOKEN,
                    AWIN_KEY // Aqui o x-api-key é crucial
                );

                if (productsData && productsData.products) {
                    const formattedProducts = productsData.products.map(prod => ({
                        type: 'product',
                        promotionId: prod.productId,
                        advertiser: { name: prod.merchant.name, id: prod.merchant.id },
                        code: 'OFERTA',
                        description: `${prod.productName} - Por ${prod.price} ${prod.currency}`,
                        trackingUrl: prod.awinDeepLink,
                        endDate: 'Enquanto durar',
                        logoUrl: prod.largeImage || prod.merchant.logoUrl
                    }));
                    allOffers = [...allOffers, ...formattedProducts];
                }
            } catch (err) {
                console.warn("API Produtos:", err.message);
            }
        }

        if (allOffers.length === 0) {
            return res.status(200).json([]);
        }

        return res.status(200).json(allOffers);

    } catch (error) {
        console.error("Erro Crítico:", error);
        return res.status(500).json({ 
            error: 'AUTH_ERROR', 
            message: 'Falha na autenticação com AWIN.' 
        });
    }
};