var express = require('express')
    http = require('http'),
    URL = require('url'),
    fs = require('fs'),
    socketio = require('./lib/socket.io-node'),
    sys = require('sys'),
    OAuth = require('./lib/node-oauth').OAuth,
    RedisStore = require('connect-redis'),
    twitterUrl = "",
    oauth = new OAuth("https://api.twitter.com/oauth/request_token",
			  "https://api.twitter.com/oauth/access_token",
			  "tzQ3s6FopvC5NuosF1QqGw",
			  "Tjl302eKWS675Kr8AScUkSzVWMJJqYMazQLztuj0eE",
			  "1.0a",
			  "http://localhost:8080/oauth_authorized",
			  "HMAC-SHA1");
    
var app = express.createServer();

/* configurations */
app.configure(function() {
  app.set('views', __dirname + '/views');
  app.use(express.bodyDecoder());
  app.use(express.cookieDecoder());
  app.use(express.errorHandler({dumpException: true, showStack: true}));
  app.use(express.staticProvider(__dirname + '/public'));
  app.use(express.session(/* {store: new RedisStore} */));
});

app.error(function(err, req, res, next) {
  sys.log(err);
  sys.log(req);
  sys.log(res);
  res.send(err.message, 500);
});

app.get('/req', function(req, res) {
  res.send(sys.inspect(req));
});

app.get('/',function(req, res){
  res.send('<h1>Welcome. Try the <a href="/chat">chat</a> example.</h1>');
});

app.get('/chat', function(req, res) {
  if (!req.session.token_secret) {
    requestAuthorization(req, res);
  } else {
    var user = getUser(req);
    res.contentType('.html');
    res.render('chat.ejs');
  }
});

app.get('/html', function(req, res) {
  res.contentType('.html');
  res.render('chat.ejs');
});

app.get('/oauth_authorized', function(req, res) {
  authorized(req, res);
});

/** 認証がまだならtwitterにリダイレクト */
function requestAuthorization(req, res) {
    var host = req.headers.host;
    oauth._authorize_callback = 'http://' + host + '/oauth_authorized';
    oauth.getOAuthRequestToken(function(error, token, token_secret, results) {
	    console.log(sys.inspect(results));
	    if (error) {
		throw new Error(sys.inspect(error));
	    }
	    req.session.token = token;
	    req.session.token_secret = token_secret;
	    res.redirect('https://api.twitter.com/oauth/authorize?oauth_token=' + token);
	});
}

/** ユーザの承認後、Twitterから戻ってきたとき */
function authorized(req, res) {
    var token = req.session.token;
    var token_secret = req.session.token_secret;
    var verifier = req.query.oauth_verifier;
    var host = req.headers.host;

    oauth.getOAuthAccessToken(token, token_secret, verifier, function(error, access_token, access_token_secret, results2) {
	    if (error) {
		throw new Error(sys.inspect(error));
	    }
	    req.session.token = access_token;
	    req.session.token_secret = access_token_secret;
	    res.redirect('http://' + host + '/chat', 301);
	});
}

app.get('/connect_sessions', function(req, res) {
  res.send(sys.inspect(connectSessions));
});

app.get('/socketio_sessions', function(req, res) {
  res.send(sys.inspect(sessions));
});

var connectSessions = {};

/**
 * OAuth認証しつつtwitterのverify_credentialsでユーザ情報を取得
 */
function getUser(req) {
  var token = req.session.token;
  var token_secret = req.session.token_secret;
  var host = 'api.twitter.com';
  var path = '/1/account/verify_credentials.json';

  oauth.getProtectedResource('http://' + host + path, 'GET', token, token_secret, function(error, data, response) {
    var user = JSON.parse(data);
    req.session.user = user;
    connectSessions[req.cookies['connect.sid']] = req.session;
  });
}

app.listen(8080);

// socket.io, I choose you
// simplest chat application evar
var io = socketio.listen(app),
    buffer = [],
    sessions = {};
		
io.on('connection', function(client){
	sys.log(sys.inspect(client));
	function name() {
	    var headers = client.request.headers;

	    if (!headers) {
		return client.sessionId;
	    }

	    var cookie = cookieToObject(headers.cookie);
	    var connectSessionId = cookie['connect.sid'];
	    var session = {};
	    var connectSession = connectSessions[connectSessionId];
	    var user = connectSession ? connectSession.user : null;
	    session.name = user ? user.screen_name : client.sessionId;
	    var screen_name = session.name;
	    console.log(sys.inspect(cookie), connectSessionId, sys.inspect(connectSessions), sys.inspect(connectSession), sys.inspect(session));
	    return screen_name;
	}

	client.send({ buffer: buffer });
	client.broadcast({ announcement: name() + ' connected' });

	client.on('message', function(message){
		    if (message.type === 'text') {
		      var msg = { message: [name(), message.text] };
		      buffer.push(msg);
		      if (buffer.length > 15) buffer.shift();
		      client.broadcast(msg);
		    }
	});

	client.on('disconnect', function(){
		client.broadcast({ announcement: name() + ' disconnected' });
	});
});

function cookieToObject(cookie) {
  var obj = {};
  var tokens = cookie.split("; ");

  for (var i=0; i<tokens.length; i++) {
    var token = tokens[i];
    var parts = token.split("=");
    obj[parts[0]] = parts[1];
  }
  return obj;
}
