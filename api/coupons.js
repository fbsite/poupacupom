const https = require('https');

function makeRequest(url, token, apiKey) {
    return new Promise((resolve, reject) => {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json', // Garante que queremos JSON
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
                        // Tenta ler o corpo do erro para saber o motivo real
                        try {
                            const errObj = JSON.parse(data);
                            const erroMsg = errObj.description || errObj.message || 'Sem detalhes';
                            reject({ status: res.statusCode, message: `AWIN Error (${res.statusCode}): ${erroMsg}` });
                        } catch(e) {
                            reject({ status: res.statusCode, message: `HTTP Error ${res.statusCode} (Body não é JSON)` });
                        }
                    }
                } catch (e) {
                    reject({ status: 500, message: 'Erro ao processar JSON da resposta' });
                }
            });
        }).on('error', (err) => reject({ status: 500, message: err.message }));
    });
}

module.exports = async (req, res) => {
    // Configurações de CORS e Cache
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

    const AWIN_TOKEN = process.env.AWIN_API_TOKEN;
    const AWIN_KEY = process.env.AWIN_API_KEY; 
    const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;

    if (!AWIN_TOKEN || !PUBLISHER_ID) {
        return res.status(500).json({ error: 'CONFIG_MISSING', message: 'Chaves AWIN não configuradas na Vercel.' });
    }

    try {
        let allOffers = [];

        // --- 1. CUPONS (Promotions API) ---
        // URL: publisher (singular)
        try {
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
            console.warn("Log Cupons:", err.message);
        }

        // --- 2. PRODUTOS (Product API) ---
        // URL CORRIGIDA: publisher (singular)
        // Adicionado região BR e moeda BRL
        if (allOffers.length < 6) {
            try {
                const productsData = await makeRequest(
                    `https://api.awin.com/publisher/${PUBLISHER_ID}/product-search?region=BR&currency=BRL&min_price=5&limit=15`, 
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
                console.warn("Log Produtos:", err.message);
            }
        }

        return res.status(200).json(allOffers);

    } catch (error) {
        console.error("Erro Crítico:", error);
        return res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
    }
};