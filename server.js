var express = require('express');

var http = require('http'), 
		URL = require('url'),
		fs = require('fs'),
		io = require('./lib/socket.io-node'),
		sys = require('sys'),
    OAuth = require('./lib/node-oauth').OAuth;
var twitterUrl = ""
    var oauth = new OAuth("https://api.twitter.com/oauth/request_token",
			  "https://api.twitter.com/oauth/access_token",
			  "tzQ3s6FopvC5NuosF1QqGw",
			  "Tjl302eKWS675Kr8AScUkSzVWMJJqYMazQLztuj0eE",
			  "1.0a",
			  "http://localhost:8080/oauth_authorized",
			  "HMAC-SHA1");
    
var HOST = '192.168.100.165:8080';
		
server = http.createServer(function(req, res){
	// your normal server code
	var url = URL.parse(req.url);
	var host = url.host;
	var path = url.pathname;
	switch (path){
		case '/':
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.write('<h1>Welcome. Try the <a href="/chat.html">chat</a> example.</h1>');
			res.end();
			break;
			
		case '/json.js':
		case '/chat.html':
		    if (path === '/chat.html' && !session.token_secret) {
			requestAuthorization(req, res);
			break;
		    }
			fs.readFile(__dirname + path, function(err, data){
				if (err) return send404(res);
				res.writeHead(200, {'Content-Type': path == 'json.js' ? 'text/javascript' : 'text/html'})
				res.write(data, 'utf8');
				res.end();
			});
			console.log(sys.inspect(session));
			getUser();
			break;
	case '/oauth_authorized':
	    authorized(req, res);
	    break;
		default: send404(res);
	}
}),

send404 = function(res){
    res.writeHead(404);
    res.write('404');
    res.end();
};

function redirect(res, url) {
    res.writeHead(302, {'Location': url});
    res.end();
}

function requestAuthorization(req, res) {
    oauth._authorize_callback = 'http://' + HOST + '/oauth_authorized';
    oauth.getOAuthRequestToken(function(error, token, token_secret, results) {
	    console.log(sys.inspect(results));
	    if (onError(res, error)) {
		return;
	    }
	    session.token = token;
	    session.token_secret = token_secret;
	    redirect(res, 'https://api.twitter.com/oauth/authorize?oauth_token=' + token);
	});
}

var session = {};

function authorized(req, res) {
    var token = session.token;
    var token_secret = session.token_secret;
    var query = URL.parse(req.url, true).query;
    var verifier = query.oauth_verifier;

    oauth.getOAuthAccessToken(token, token_secret, verifier, function(error, access_token, access_token_secret, results2) {
	    console.log(sys.inspect(arguments));
	    if (onError(res, error)) {
		return; 
	    }
	    //	    res.writeHead(200, {'Content-Type': 'text/html'});
	    //	    res.write('token=' + token + ',token_secret=' + token_secret + ', access_token=' + access_token + ', access_token_secret=' + access_token_secret, 'utf8');
	    session.token = access_token;
	    session.token_secret = access_token_secret;
	    //	    res.end();
	    redirect(res, 'http://' + HOST + '/chat.html');
	});
}

function onError(res, error) {
    if (error) {
	returnText(res, sys.inspect(error));
	return true;
    }
    return false;
}

function getUser() {
    var host = 'api.twitter.com';
    var path = '/1/account/verify_credentials.json';
    oauth.getProtectedResource('http://' + host + path, 'GET', session.token, session.token_secret, function(error, data, response) {
	    console.log(sys.inspect(arguments));
	    console.log(typeof data, data);
	    console.log(JSON.parse(data).screen_name);
	});
}

function returnText(res, text) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(text, 'utf8');
    res.end();
}

server.listen(8080);

// socket.io, I choose you
// simplest chat application evar
var io = io.listen(server),
		buffer = [];
		
io.on('connection', function(client){
	client.send({ buffer: buffer });
	client.broadcast({ announcement: client.sessionId + ' connected' });

	client.on('message', function(message){
		var msg = { message: [client.sessionId, message] };
		buffer.push(msg);
		if (buffer.length > 15) buffer.shift();
		client.broadcast(msg);
	});

	client.on('disconnect', function(){
		client.broadcast({ announcement: client.sessionId + ' disconnected' });
	});
});
