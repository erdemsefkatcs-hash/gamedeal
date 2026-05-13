// api/deals.js
// Vercel Serverless Function — CORS proxy
// Tüm API çağrıları bu proxy üzerinden geçer

const CHEAPSHARK = 'https://www.cheapshark.com/api/1.0';
const ITAD_KEY   = 'ef4c05e2fcc9562617e65fb738c8ea0a565af6df';
const ITAD_BASE  = 'https://api.isthereanydeal.com';

function isDLCTitle(title) {
  const tl = title.toLowerCase();
  const dlcKeywords = [' - dlc', ' dlc', 'soundtrack', 'season pass', 'add-on', 'addon',
    'expansion pack', ' pack', 'upgrade pack', 'content pack', 'cosmetic', 'skin pack',
    'art book', 'artbook', 'digital artbook', 'digital book', 'digital soundtrack',
    'original soundtrack', ' ost', 'collector', 'pre-order bonus', 'bonus content',
    'deluxe upgrade', 'premium upgrade', 'year one pass', 'expansion pass'];
  return dlcKeywords.some(k => tl.includes(k));
}

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

      // ITAD — Doğru endpoint
      let itadDeals = [];
      try {
        const r = await fetch(
          `${ITAD_BASE}/deals/v2?key=${ITAD_KEY}&country=${tr}&limit=60&sort=cut%3Adesc`
        );
        if (r.ok) {
          const d = await r.json();
          const list = d.list || d.deals || d || [];
          if (Array.isArray(list)) {
            itadDeals = list
              .filter(g => (g.deal?.cut || g.cut || 0) >= 20)
              .filter(g => (g.deal?.regular?.amount || g.regular || 0) > 0)
              .filter(g => (g.deal?.price?.amount || g.price || 0) < (g.deal?.regular?.amount || g.regular || 999))
              .filter(g => g.title && g.title.length > 0)
              .filter(g => /^[\x00-\x7F\u00C0-\u024F\s\-\'\:\.\,\!\&]+$/.test(g.title))
              .filter(g => !isDLCTitle(g.title))
              .slice(0, 30)
              .map(g => ({
                title: g.title,
                platform: (g.shop?.id || g.storeId || '').includes('xbox') ? 'xbox' :
                          (g.shop?.id || '').includes('ubisoft') ? 'ubisoft' :
                          (g.shop?.id || '').includes('epic') ? 'epic' :
                          (g.shop?.id || '').includes('gog') ? 'gog' :
                          (g.shop?.id || '').includes('humble') ? 'humble' : 'steam',
                storeName: g.shop?.name || 'Steam',
                storeID: g.shop?.id || '1',
                normalPrice: g.deal?.regular?.amount || g.regular || 0,
                salePrice: g.deal?.price?.amount || g.price || 0,
                savings: g.deal?.cut || g.cut || 0,
                thumb: g.assets?.banner300 || g.image || '',
                url: g.deal?.url || g.url || '#',
                steamRatingPercent: 75,
                steamRatingCount: 0,
                isITAD: true
              }));
          }
        }
      } catch(e) {}

      // CheapShark
      let cheapDeals = [];
      try {
        const r = await fetch(
          `${CHEAPSHARK}/deals?pageSize=60&sortBy=Savings&desc=1&steamRating=70`,
          { headers: { 'User-Agent': 'GameDealApp/1.0' } }
        );
        if (r.ok) {
          const raw = await r.json();
          cheapDeals = raw
            .filter(g => !g.error)
            .filter(g => {
              const normal = parseFloat(g.normalPrice);
              const sale = parseFloat(g.salePrice);
              // Gerçek indirim yüzdesi hesapla
              const realSavings = normal > 0 ? ((normal - sale) / normal) * 100 : 0;
              return realSavings >= 20 && sale < normal;
            })
            .filter(g => !isDLCTitle(g.title))
            .map(g => {
              const normal = parseFloat(g.normalPrice);
              const sale = parseFloat(g.salePrice);
              const realSavings = normal > 0 ? Math.round(((normal - sale) / normal) * 100) : 0;
              return {
                title: g.title,
                platform: g.storeID === '13' ? 'epic' :
                          g.storeID === '25' ? 'gog' :
                          g.storeID === '11' ? 'humble' : 'steam',
                storeName: g.storeID === '13' ? 'Epic' :
                           g.storeID === '25' ? 'GOG' :
                           g.storeID === '11' ? 'Humble' : 'Steam',
                storeID: g.storeID,
                normalPrice: normal,
                salePrice: sale,
                savings: realSavings,
                thumb: g.thumb || '',
                url: `https://www.cheapshark.com/redirect?dealID=${g.dealID}`,
                steamRatingPercent: parseInt(g.steamRatingPercent) || 75,
                steamRatingCount: parseInt(g.steamRatingCount) || 0,
                isITAD: false
              };
            });
        }
      } catch(e) {}

      // İkisini birleştir, savings'e göre sırala
      const combined = [...itadDeals, ...cheapDeals]
        .sort((a, b) => parseFloat(b.savings) - parseFloat(a.savings))
        // Duplicate title temizle
        .filter((g, i, arr) => arr.findIndex(x => x.title === g.title) === i)
        .slice(0, 24);

      data = {
        cheapshark: cheapDeals,
        itad: itadDeals,
        combined,
        total: combined.length
      };
    }

    // ── FİYAT GEÇMİŞİ ─────────────────────────────
    else if (type === 'pricehistory') {
      const title = req.query.title || '';
      let history = [];
      try {
        // ITAD'da oyunu ara
        const searchR = await fetch(
          `${ITAD_BASE}/games/search/v1?key=${ITAD_KEY}&title=${encodeURIComponent(title)}&results=1`
        );
        if (searchR.ok) {
          const searchD = await searchR.json();
          const gameId = searchD.results?.[0]?.id;
          if (gameId) {
            // Fiyat geçmişini çek
            const histR = await fetch(
              `${ITAD_BASE}/games/price-history/v1?key=${ITAD_KEY}&id=${gameId}&country=TR&since=2024-01-01`
            );
            if (histR.ok) {
              const histD = await histR.json();
              const entries = histD[gameId] || [];
              // Son 12 ayı month bazında grupla
              const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
              const byMonth = {};
              entries.forEach(e => {
                const d = new Date(e.timestamp * 1000);
                const key = `${d.getFullYear()}-${d.getMonth()}`;
                if (!byMonth[key] || e.price_new < byMonth[key].price)
                  byMonth[key] = { month: months[d.getMonth()], price: e.price_new, discount: e.cut || 0 };
              });
              history = Object.values(byMonth).slice(-12);
            }
          }
        }
      } catch(e) {}
      data = { history };
    }

    // ── TRENDING ───────────────────────────────────
    else if (type === 'trending') {

      // Aboneliklere yeni gelenler
      let newInSubs = [];
      try {
        const r = await fetch(`${ITAD_BASE}/games/subscriptions/v1/history?key=${ITAD_KEY}&limit=12`);
        if (r.ok) {
          const d = await r.json();
          newInSubs = (d.list || []).map(g => ({
            title: g.title,
            service: g.service?.name || g.service || 'Game Pass',
            platform: g.service?.id?.includes('prime') ? 'prime' : 'xbox',
            image: g.assets?.banner300 || '',
            addedAt: g.since || new Date().toISOString()
          }));
        }
      } catch(e) {}

      // En çok beklenenler (Most Waitlisted - son 30 gün)
      let mostWaitlisted = [];
      try {
        const r = await fetch(`${ITAD_BASE}/stats/most-waitlisted/v1?key=${ITAD_KEY}&country=${tr}&limit=10&period=30`);
        if (r.ok) {
          const d = await r.json();
          mostWaitlisted = (d.list || []).map(g => ({
            title: g.title,
            platform: 'steam',
            image: g.assets?.banner300 || '',
            price: g.deal?.price?.amount || 0,
            discount: g.deal?.cut || 0,
            url: g.deal?.url || '#'
          }));
        }
      } catch(e) {}

      // En çok toplananlar (Most Collected - son 30 gün)
      let mostCollected = [];
      try {
        const r = await fetch(`${ITAD_BASE}/stats/most-collected/v1?key=${ITAD_KEY}&country=${tr}&limit=10&period=30`);
        if (r.ok) {
          const d = await r.json();
          mostCollected = (d.list || []).map(g => ({
            title: g.title,
            platform: 'steam',
            image: g.assets?.banner300 || '',
            price: g.deal?.price?.amount || 0,
            discount: g.deal?.cut || 0,
            url: g.deal?.url || '#'
          }));
        }
      } catch(e) {}

      data = { newInSubs, mostWaitlisted, mostCollected };
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
