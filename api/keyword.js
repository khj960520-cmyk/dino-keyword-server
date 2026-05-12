const crypto = require('crypto');

function makeSignature(timestamp, method, path, secretKey) {
  const message = `${timestamp}.${method}.${path}`;
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
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
    const timestamp = Date.now().toString();
    const signature = makeSignature(timestamp, 'GET', '/keywordstool', secretKey);

    const kwList = Array.isArray(keywords) ? keywords : [keywords];
    const params = kwList.map(k => `hintKeywords=${encodeURIComponent(k)}`).join('&');
    const url = `https://api.naver.com/keywordstool?${params}&showDetail=1`;

    console.log('요청 URL:', url);
    console.log('키워드:', kwList);

    const response = await fetch(url, {
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': license,
        'X-Customer': String(customerId),
        'X-Signature': signature,
        'Content-Type': 'application/json'
      }
    });

    const text = await response.text();
    console.log('네이버 응답 상태:', response.status);
    console.log('네이버 응답 내용:', text.slice(0, 500));

    let data;
    try { data = JSON.parse(text); }
    catch(e) { return res.status(200).json({ error: '응답 파싱 실패', raw: text.slice(0, 300) }); }

    return res.status(200).json(data);
  } catch (e) {
    console.error('오류:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
