export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prices } = req.body;
  if (!prices) return res.status(400).json({ error: 'Missing prices' });

  const prompt = `You are CryptoWolf, an aggressive crypto perpetuals trading bot.

LIVE DATA:
BTC: $${prices.btc.price.toFixed(2)} | 24h: ${prices.btc.change.toFixed(2)}% | vol: $${(prices.btc.vol/1e9).toFixed(1)}B
ETH: $${prices.eth.price.toFixed(2)} | 24h: ${prices.eth.change.toFixed(2)}% | vol: $${(prices.eth.vol/1e9).toFixed(1)}B
SOL: $${prices.sol.price.toFixed(2)} | 24h: ${prices.sol.change.toFixed(2)}% | vol: $${(prices.sol.vol/1e9).toFixed(1)}B

RULES:
- BTC is macro signal. BTC 24h > +0.5% = bullish. < -0.5% = bearish. In between = ranging.
- If bullish: find asset with lowest 24h change (biggest lag) → LONG it.
- If bearish: find asset with lowest 24h change (weakest) → SHORT it.
- If ranging: WAIT, no trade.
- Leverage: BTC 5x, ETH 8x, SOL 10x. Size: 25 USDC.
- SL: BTC 0.7%, ETH 1.0%, SOL 1.5%. TP: BTC 2.5%, ETH 3.5%, SOL 5.0%.

Respond ONLY with valid JSON, no markdown, no extra text:
{"direction":"LONG","asset":"SOL","leverage":10,"size":25,"confidence":78,"reason":"BTC bullish +2.1%, SOL lagging at +0.3%","command":"LONG SOL 10x SIZE 25 USDC"}

direction must be LONG, SHORT, or WAIT. If WAIT: asset=NONE, leverage=0, size=0, command="WAIT - no clear setup".`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://bankr-bot-gamma.vercel.app',
        'X-Title': 'CryptoWolf Bankr Bot'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4-5',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'OpenRouter API error' });
    }

    const text = data.choices[0].message.content.replace(/```json|```/g, '').trim();
    const signal = JSON.parse(text);

    return res.status(200).json(signal);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
