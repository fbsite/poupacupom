const https = require('https');

function makeRequest(url, token, apiKey) {
    return new Promise((resolve, reject) => {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'CupaOferta-App/1.0',
            'x-api-key': apiKey || token 
        };

        https.get(url, { headers }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(data));
                    } else {
                        // Tenta ler o erro se for JSON
                        try {
                            const errObj = JSON.parse(data);
                            reject({ status: res.statusCode, message: errObj.description || errObj.message || 'Erro AWIN' });
                        } catch(e) {
                            reject({ status: res.statusCode, message: `Erro HTTP ${res.statusCode}` });
                        }
                    }
                } catch (e) {
                    reject({ status: 500, message: 'Erro no JSON da AWIN' });
                }
            });
        }).on('error', (err) => reject({ status: 500, message: err.message }));
    });
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

    const AWIN_TOKEN = process.env.AWIN_API_TOKEN;
    const AWIN_KEY = process.env.AWIN_API_KEY; 
    const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;

    if (!AWIN_TOKEN || !PUBLISHER_ID) {
        console.error("Configuração ausente na Vercel.");
        return res.status(500).json({ error: 'CONFIG_MISSING', message: 'Configure as chaves na Vercel.' });
    }

    try {
        let allOffers = [];

        // --- 1. CUPONS (Promotions API) ---
        // Rota: publisher/{id}/promotions
        try {
            console.log("Buscando Promoções...");
            const couponsData = await makeRequest(
                `https://api.awin.com/publisher/${PUBLISHER_ID}/promotions?relationship=joined`, 
                AWIN_TOKEN,
                AWIN_KEY
            );

            if (Array.isArray(couponsData)) {
                allOffers = couponsData.map(promo => ({
                    type: 'coupon',
                    promotionId: promo.promotionId,
                    advertiser: { name: promo.advertiser.name, id: promo.advertiser.id },
                    code: promo.code,
                    description: promo.title || promo.description,
                    trackingUrl: promo.clickUrl || promo.trackingUrl,
                    endDate: promo.endDate || 'Em breve',
                    logoUrl: null 
                }));
            }
        } catch (err) {
            console.warn("API Promos falhou (pode ser normal se não houver cupons):", err.message);
        }

        // --- 2. PRODUTOS (Product API) ---
        // Só busca produtos se tivermos poucos cupons (< 6)
        // MELHORIA: Adicionado &region=BR e &currency=BRL para focar no Brasil
        if (allOffers.length < 6) {
            try {
                console.log("Buscando Produtos (Fallback)...");
                const productsData = await makeRequest(
                    `https://api.awin.com/publishers/${PUBLISHER_ID}/product-search?region=BR&currency=BRL&min_price=5&limit=15`, 
                    AWIN_TOKEN,
                    AWIN_KEY
                );

                if (productsData && productsData.products) {
                    const formattedProducts = productsData.products.map(prod => ({
                        type: 'product',
                        promotionId: prod.productId,
                        advertiser: { name: prod.merchant.name, id: prod.merchant.id },
                        code: 'OFERTA',
                        description: `${prod.productName} - R$ ${prod.price}`,
                        trackingUrl: prod.awinDeepLink,
                        endDate: 'Oferta Relâmpago',
                        logoUrl: prod.largeImage || prod.merchant.logoUrl
                    }));
                    allOffers = [...allOffers, ...formattedProducts];
                }
            } catch (err) {
                console.warn("API Produtos falhou:", err.message);
            }
        }

        // Se após as duas tentativas a lista estiver vazia, retorna array vazio
        // O frontend lidará com isso mostrando a mensagem "Sem ofertas ativas"
        return res.status(200).json(allOffers);

    } catch (error) {
        console.error("Erro Fatal Backend:", error);
        return res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
    }
};