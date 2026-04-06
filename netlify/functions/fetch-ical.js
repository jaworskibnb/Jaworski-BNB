const https = require('https');
const http = require('http');

exports.handler = async function(event) {
  const url = event.queryStringParameters && event.queryStringParameters.url;

  if (!url) {
    return { statusCode: 400, body: 'Missing url parameter' };
  }

  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    
    const req = lib.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ical-fetch/1.0)' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: 200,
          headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store'
          },
          body: data
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 500,
        body: JSON.stringify({ error: err.message })
      });
    });

    req.setTimeout(8000, () => {
      req.destroy();
      resolve({
        statusCode: 504,
        body: JSON.stringify({ error: 'Request timed out' })
      });
    });
  });
};
