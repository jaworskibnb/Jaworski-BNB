const https = require('https');
const http = require('http');
const url_module = require('url');

function fetchUrl(urlStr, redirectCount) {
  redirectCount = redirectCount || 0;
  if (redirectCount > 5) {
    return Promise.reject(new Error('Too many redirects'));
  }

  return new Promise((resolve, reject) => {
    const parsed = url_module.parse(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      path: parsed.path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/calendar,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000
    };

    const req = lib.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(fetchUrl(res.headers.location, redirectCount + 1));
        return;
      }

      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

exports.handler = async function(event) {
  const icalUrl = event.queryStringParameters && event.queryStringParameters.url;

  if (!icalUrl) {
    return { statusCode: 400, body: 'Missing url parameter' };
  }

  try {
    const result = await fetchUrl(icalUrl);
    
    if (result && result.body) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        },
        body: result.body
      };
    }

    return { statusCode: 502, body: 'Empty response from iCal source' };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
