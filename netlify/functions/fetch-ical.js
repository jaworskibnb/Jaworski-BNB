const https = require('https');
const http = require('http');
const url_module = require('url');

function fetchUrl(urlStr) {
  return new Promise((resolve, reject) => {
    const parsed = url_module.parse(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.path,
      method: 'GET',
      headers: {
        'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'Connection': 'close'
      }
    };

    const req = lib.request(options, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }

      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 && data.includes('BEGIN:VCALENDAR')) {
          resolve(data);
        } else {
          reject(new Error(`Bad response: ${res.statusCode}`));
        }
      });
    });

    // 5 second timeout
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout after 5s'));
    });

    req.on('error', reject);
    req.end();
  });
}

exports.handler = async function(event) {
  const icalUrl = event.queryStringParameters && event.queryStringParameters.url;

  if (!icalUrl) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: 'Missing url parameter'
    };
  }

  try {
    const data = await fetchUrl(icalUrl);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      },
      body: data
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
