'use strict';

var PatEmitter = require('pattern-emitter'),
	urlParse = require('url').parse,
	http = require('http'),
	httpDuplex = require('http-duplex'),
	_ = require('lodash');

module.exports = function (webServer) {
	var symHttp = {
		server: undefined,
		methodEmitter: {},
		requestHandler: function (req, res) {
			var dup = httpDuplex(req, res),
				url = urlParse(req.url, true),
				method = req.method.toUpperCase();
			
			//Set headers
			_.forEach(symHttp.headers, function (v, k) {
				dup.setHeader(k, v);
			});
			
			if (symHttp.methodEmitter.hasOwnProperty(method)) {
				
				if (!symHttp.methodEmitter[method].emit(url.pathname, dup, url.query, url.hash)) {
					dup.statusCode = 404;
					dup.end('{"code": 404, "msg": "' + http.STATUS_CODES[404] + '"}');
				}
			}
			else {
				dup.statusCode = 405;
				dup.end('{"code": 405, "msg": "' + http.STATUS_CODES[405] + '"}');
			}
		},
		create: function (port, callback) {
			port = port || 80;
			this.server = webServer.createServer();
			//this.server.timeout = 5 * 60 * 1000;
			this.server.on('request', this.requestHandler);
			this.server.listen(port, typeof callback === 'function' ? callback : undefined);

			//Add pattern-listerner to every http method
			_.forEach(this.methods, function (method) {
				symHttp.methodEmitter[method] = new PatEmitter();
			});

			//Prevent method modifications after startup
			Object.freeze(this.methods);

			return this;
		},
		//Standard HTTP verbs
		methods: [
			//REST verbs
			'GET', 'POST', 'PUT', 'DELETE', 'PATCH',
			//Slightly obsure REST verbs
			'HEAD', 'OPTIONS',
			//Less common REST verbs
			'TRACE', 'CONNECT',
			//WebDAV verbs
			//'PROPFIND', 'PROPPATCH', 'MKCOL', 'COPY', 'MOVE', 'LOCK', 'UNLOCK'
		],
		//Standard headers that will be sended
		headers: {
			'X-Frame-Options': 'SAMEORIGIN',
			'Content-Type': 'application/json',
			'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
			'X-XSS-Protection': '1; mode=block'
		},
		method: function (method, regexp, callback) {
			if (typeof method !== 'string') {
				throw new Error('Method expected to be string, ' + typeof method + ' given.');
			}
			if (!(regexp instanceof RegExp)) {
				throw new Error('regexp expected to be a RegExp object, ' + typeof regexp + ' given.');
			}
			if (typeof callback !== 'function') {
				throw new Error('Callback expected to be function, ' + typeof callback + ' given.');
			}
			method = method.toUpperCase();
			if (this.methods.indexOf(method) < 0) {
				console.error('Non standard HTTP verb! Add it to methods array if you want to support it (NOT RECOMMENDED!. If you do add some new verb, HTTPS is recommended to elimenate problems with bad proxies.)');
				throw new Error('Non standard HTTP verb!');
			}

			this.methodEmitter[method].on(regexp, callback);
		}
	};

	return symHttp;
};