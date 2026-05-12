const crypto = require('crypto');

function makeSignature(timestamp, method, path, secretKey) {
  const message = `${timestamp}.${method}.${path}`;
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { keywords, customerId, license, secretKey } = req.body || req.query;

  if (!keywords || !customerId || !license || !secretKey) {
    return res.status(400).json({ error: '파라미터가 부족해요.' });
  }

  try {
    const timestamp = Date.now().toString();
    const method = 'GET';
    const path = '/keywordstool';
    const signature = makeSignature(timestamp, method, path, secretKey);

    const kwList = Array.isArray(keywords) ? keywords : [keywords];
    const params = kwList.map(k => `hintKeywords=${encodeURIComponent(k)}`).join('&');
    const url = `https://api.naver.com/keywordstool?${params}&showDetail=1`;

    const response = await fetch(url, {
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': license,
        'X-Customer': customerId,
        'X-Signature': signature,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
