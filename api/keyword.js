const crypto = require('crypto');

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
  } catch (e) {
    console.error('오류:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
