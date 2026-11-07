/**
 * Lightweight Zero-dependency HTTP router and body parser for Node.js
 */
const url = require('url');

class MiniServer {
  constructor() {
    this.routes = [];
  }

  use(fn) {
    this.routes.push({ middleware: fn });
  }

  get(path, handler) {
    this.routes.push({ method: 'GET', path, handler });
  }

  post(path, handler) {
    this.routes.push({ method: 'POST', path, handler });
  }

  handle(req, res) {
    const parsedUrl = url.parse(req.url, true);
    req.query = parsedUrl.query;
    req.pathname = parsedUrl.pathname;

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      if (req.headers['content-type']?.includes('application/json') && body) {
        try {
          req.body = JSON.parse(body);
        } catch (e) {
          req.body = {};
        }
      } else if (req.headers['content-type']?.includes('application/x-www-form-urlencoded') && body) {
        req.body = Object.fromEntries(new URLSearchParams(body));
      } else {
        req.body = body;
      }

      // Helper methods
      res.json = (data, statusCode = 200) => {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data, null, 2));
      };

      res.html = (htmlString, statusCode = 200) => {
        res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(htmlString);
      };

      res.redirect = (redirectUrl) => {
        res.writeHead(302, { Location: redirectUrl });
        res.end();
      };

      // Match routes
      for (const r of this.routes) {
        if (r.middleware) {
          await r.middleware(req, res);
        } else if (r.method === req.method && r.path === req.pathname) {
          try {
            return await r.handler(req, res);
          } catch (err) {
            console.error('Route error:', err);
            return res.json({ error: 'Internal Server Error', message: err.message }, 500);
          }
        }
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });
  }
}

module.exports = MiniServer;
