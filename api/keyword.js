const crypto = require('crypto');

// URL 크롤링 함수
async function fetchUrl(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    }
  });
  const html = await response.text();
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 10000);
  return text;
}

function makeSignature(timestamp, method, path, secretKey) {
  const message = `${timestamp}.${method}.${path}`;
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
}

async function queryNaver(kwBatch, customerId, license, secretKey) {
  const timestamp = Date.now().toString();
  const signature = makeSignature(timestamp, 'GET', '/keywordstool', secretKey);
  const params = new URLSearchParams();
  kwBatch.forEach(k => {
    const clean = k.trim().replace(/\s+/g, '').replace(/['"]/g, '');
    if (clean) params.append('hintKeywords', clean);
  });
  params.append('showDetail', '1');
  const url = `https://api.naver.com/keywordstool?${params.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Timestamp': timestamp,
      'X-API-KEY': license,
      'X-Customer': String(customerId),
      'X-Signature': signature,
      'Content-Type': 'application/json'
    }
  });
  const text = await response.text();
  console.log('응답:', text.slice(0, 300));
  const data = JSON.parse(text);
  return data.keywordList || [];
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // URL 크롤링 요청
  const action = req.query.action || req.body?.action;
  if (action === 'fetch') {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).json({ error: 'url 파라미터가 필요해요.' });
    try {
      const text = await fetchUrl(targetUrl);
      return res.status(200).json({ text });
    } catch(e) {
      console.error('크롤링 오류:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // 네이버 키워드 조회 요청
  const { keywords, customerId, license, secretKey } = req.body || {};
  if (!keywords || !customerId || !license || !secretKey) {
    return res.status(400).json({ error: '파라미터가 부족해요.' });
  }
  try {
    const kwList = Array.isArray(keywords) ? keywords : [keywords];
    const batches = [];
    for (let i = 0; i < kwList.length; i += 10) {
      batches.push(kwList.slice(i, i + 10));
    }
    const results = await Promise.all(
      batches.map(batch => queryNaver(batch, customerId, license, secretKey))
    );
    const keywordList = results.flat();
    return res.status(200).json({ keywordList });
  } catch(e) {
    console.error('오류:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
