// api/deals.js
// Vercel Serverless Function — CORS proxy
// Tüm API çağrıları bu proxy üzerinden geçer

const CHEAPSHARK = 'https://www.cheapshark.com/api/1.0';
const ITAD_KEY   = 'ef4c05e2fcc9562617e65fb738c8ea0a565af6df';
const ITAD_BASE  = 'https://api.isthereanydeal.com';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, storeID, pageSize, lowerDiscount, country } = req.query;
  const tr = country || 'TR';

  try {
    let data = {};

    // ── BEDAVA OYUNLAR ─────────────────────────────
    if (type === 'free') {
      // Epic bedava oyunlar
      let epicFree = [];
      try {
        const r = await fetch(
          `https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=tr&country=${tr}&allowCountries=${tr}`
        );
        const d = await r.json();
        const all = d?.data?.Catalog?.searchStore?.elements || [];
        epicFree = all
          .filter(g => {
            const promos = g?.promotions?.promotionalOffers;
            return promos?.length > 0 &&
              promos[0]?.promotionalOffers?.[0]?.discountSetting?.discountPercentage === 0;
          })
          .map(g => ({
            title: g.title,
            platform: 'epic',
            genre: g.categories?.[0]?.path || 'Game',
            originalPrice: g.price?.totalPrice?.fmtPrice?.originalPrice || '—',
            currentPrice: 'FREE',
            url: `https://store.epicgames.com/tr/p/${g.productSlug || g.urlSlug || ''}`,
            image: g.keyImages?.find(i => i.type === 'OfferImageWide')?.url ||
                   g.keyImages?.[0]?.url || '',
            expires: g.promotions?.promotionalOffers?.[0]?.promotionalOffers?.[0]?.endDate || '',
            rating: 4.0,
            reviews: '—'
          }));
      } catch(e) {}

      // Upcoming Epic (gelecek hafta)
      let epicUpcoming = [];
      try {
        const r = await fetch(
          `https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=tr&country=${tr}&allowCountries=${tr}`
        );
        const d = await r.json();
        const all = d?.data?.Catalog?.searchStore?.elements || [];
        epicUpcoming = all
          .filter(g => g?.promotions?.upcomingPromotionalOffers?.length > 0)
          .map(g => ({
            title: g.title,
            platform: 'epic',
            genre: g.categories?.[0]?.path || 'Game',
            originalPrice: g.price?.totalPrice?.fmtPrice?.originalPrice || '—',
            currentPrice: 'UPCOMING',
            url: `https://store.epicgames.com/tr/p/${g.productSlug || g.urlSlug || ''}`,
            image: g.keyImages?.find(i => i.type === 'OfferImageWide')?.url ||
                   g.keyImages?.[0]?.url || '',
            expires: g.promotions?.upcomingPromotionalOffers?.[0]?.promotionalOffers?.[0]?.startDate || '',
            rating: 4.0,
            reviews: '—',
            upcoming: true
          }));
      } catch(e) {}

      // Steam ücretsiz (CheapShark)
      let steamFree = [];
      try {
        const r = await fetch(`${CHEAPSHARK}/deals?storeID=1&upperPrice=0&pageSize=8&sortBy=Savings`);
        const d = await r.json();
        steamFree = d
          .filter(g => parseFloat(g.salePrice) === 0)
          .map(g => ({
            title: g.title,
            platform: 'steam',
            genre: 'Steam',
            originalPrice: `$${g.normalPrice}`,
            currentPrice: 'FREE',
            url: `https://www.cheapshark.com/redirect?dealID=${g.dealID}`,
            image: g.thumb || '',
            expires: 'Sınırlı süre',
            rating: parseFloat((g.steamRatingPercent / 20).toFixed(1)) || 3.5,
            reviews: parseInt(g.steamRatingCount || 0).toLocaleString(),
            dealID: g.dealID,
            steamAppID: g.steamAppID
          }));
      } catch(e) {}

      // Prime Gaming (ITAD)
      let primeFree = [];
      try {
        const r = await fetch(`${ITAD_BASE}/games/subscriptions/v1?key=${ITAD_KEY}&service=amazon:prime&country=${tr}&limit=6`);
        if (r.ok) {
          const d = await r.json();
          primeFree = (d.items || []).slice(0, 4).map(g => ({
            title: g.title || 'Prime Oyunu',
            platform: 'prime',
            genre: 'Prime Gaming',
            originalPrice: '—',
            currentPrice: 'FREE',
            url: 'https://gaming.amazon.com/home',
            image: g.assets?.banner300 || '',
            expires: 'Prime üyeleri',
            rating: 3.8,
            reviews: '—'
          }));
        }
      } catch(e) {}

      // Game Pass (ITAD)
      let gamepassFree = [];
      try {
        const r = await fetch(`${ITAD_BASE}/games/subscriptions/v1?key=${ITAD_KEY}&service=xbox:gamepass&country=${tr}&limit=8`);
        if (r.ok) {
          const d = await r.json();
          gamepassFree = (d.items || []).slice(0, 5).map(g => ({
            title: g.title || 'Game Pass Oyunu',
            platform: 'xbox',
            genre: 'Game Pass',
            originalPrice: '—',
            currentPrice: 'FREE',
            url: 'https://www.xbox.com/tr-TR/xbox-game-pass',
            image: g.assets?.banner300 || '',
            expires: 'Game Pass dahil',
            rating: 4.1,
            reviews: '—'
          }));
        }
      } catch(e) {}

      // Ubisoft ücretsiz oyunlar (static — public API yok)
      const ubiFree = [
        { title:'XDefiant', platform:'ubisoft', genre:'FPS / Free to Play',
          originalPrice:'₺0', currentPrice:'FREE',
          url:'https://www.ubisoft.com/tr-tr/game/xdefiant',
          image:'', expires:'Kalıcı ücretsiz', rating:3.8, reviews:'45k' },
        { title:'Brawlhalla', platform:'ubisoft', genre:'Dövüş / Free to Play',
          originalPrice:'₺0', currentPrice:'FREE',
          url:'https://www.brawlhalla.com',
          image:'', expires:'Kalıcı ücretsiz', rating:4.1, reviews:'120k' },
      ];

      data = {
        epic: epicFree,
        epicUpcoming,
        steam: steamFree,
        prime: primeFree,
        gamepass: gamepassFree,
        ubisoft: ubiFree,
        total: epicFree.length + steamFree.length + primeFree.length + gamepassFree.length + ubiFree.length
      };
    }

    // ── İNDİRİMLER ────────────────────────────────
    else if (type === 'deals') {
      const size = parseInt(pageSize) || 24;
      const minDisc = parseInt(lowerDiscount) || 50;

      // CheapShark — Steam, GOG, Humble, Epic
      let cheapDeals = [];
      try {
        const r = await fetch(
          `${CHEAPSHARK}/deals?pageSize=${size}&sortBy=Savings&desc=1&lowerDiscount=${minDisc}`
        );
        cheapDeals = await r.json();
      } catch(e) {}

      // ITAD — Tüm platformlar
      let itadDeals = [];
      try {
        const r = await fetch(
          `${ITAD_BASE}/deals/v2?key=${ITAD_KEY}&country=${tr}&limit=24&offset=0`
        );
        if (r.ok) {
          const d = await r.json();
          itadDeals = (d.list || []).map(g => ({
            title: g.title,
            platform: g.shop?.id?.includes('xbox') ? 'xbox' :
                      g.shop?.id?.includes('ubisoft') ? 'ubisoft' :
                      g.shop?.id?.includes('epic') ? 'epic' :
                      g.shop?.id?.includes('gog') ? 'gog' :
                      g.shop?.id?.includes('humble') ? 'humble' : 'steam',
            storeName: g.shop?.name || 'Store',
            storeID: g.shop?.id || '1',
            normalPrice: g.deal?.regular?.amount || 0,
            salePrice: g.deal?.price?.amount || 0,
            savings: g.deal?.cut || 0,
            thumb: g.assets?.banner300 || '',
            url: g.deal?.url || '#',
            steamRatingPercent: 75,
            steamRatingCount: 0,
            isITAD: true
          }));
        }
      } catch(e) {}

      data = {
        cheapshark: cheapDeals,
        itad: itadDeals,
        total: cheapDeals.length + itadDeals.length
      };
    }

    // ── USD/TRY KUR ────────────────────────────────
    else if (type === 'rate') {
      try {
        const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const d = await r.json();
        data = { rate: d.rates?.TRY || 38.5, updated: new Date().toISOString() };
      } catch(e) {
        data = { rate: 38.5, updated: new Date().toISOString() };
      }
    }

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
