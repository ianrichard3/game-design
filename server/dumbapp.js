var BanIP, Session, WebSocket, compression, cookieParser, express, fs, morgan, path, process;

compression = require("compression");

express = require("express");

cookieParser = require('cookie-parser');

fs = require("fs");

path = require("path");

WebSocket = require("ws");

process = require("process");

morgan = require("morgan");

BanIP = require(__dirname + "/banip.js");

Session = (function() {
  function Session(server, socket1) {
    this.server = server;
    this.socket = socket1;
    this.socket.on("message", (function(_this) {
      return function(msg) {
        if (msg.length) {
          return console.info("received ws message from " + _this.socket.remoteAddress + ", length = " + msg.length);
        }
      };
    })(this));
    this.socket.on("close", (function(_this) {
      return function() {};
    })(this));
    this.socket.on("error", (function(_this) {
      return function(err) {
        return console.error(err);
      };
    })(this));
  }

  return Session;

})();

this.DumbApp = (function() {
  function DumbApp(config, callback) {
    this.config = config != null ? config : {};
    this.callback = callback;
    process.chdir(__dirname);
    this.config = {
      realm: "local"
    };
    if (this.config.realm === "production") {
      this.PORT = 443;
      this.PROD = true;
    } else if (this.config.standalone) {
      this.PORT = this.config.port || 0;
    } else {
      this.PORT = this.config.port || 8089;
      this.PROD = false;
    }
    this.ban_ip = new BanIP(this);
    this.create();
  }

  DumbApp.prototype.create = function() {
    var accessLogStream, app;
    app = express();
    app.set('trust proxy', true);
    if (fs.existsSync(path.join(__dirname, "../logs"))) {
      accessLogStream = fs.createWriteStream(path.join(__dirname, "../logs/access.log"), {
        flags: 'a'
      });
      app.use(morgan('combined', {
        stream: accessLogStream
      }));
    }
    app.use((function(_this) {
      return function(req, res, next) {
        console.info(req.get("host") + " : " + req.ip + " : " + req.path);
        return res.status(200).send(req.path);
      };
    })(this));
    if (this.PROD) {
      return require('greenlock-express').init({
        packageRoot: __dirname,
        configDir: "./greenlock.d",
        maintainerEmail: "contact@microstudio.dev",
        cluster: false
      }).ready((function(_this) {
        return function(glx) {
          _this.httpserver = glx.httpsServer();
          _this.use_cache = true;
          glx.serveApp(app);
          return _this.start(app);
        };
      })(this));
    } else {
      this.httpserver = require("http").createServer(app).listen(this.PORT);
      this.use_cache = false;
      return this.start(app);
    }
  };

  DumbApp.prototype.start = function(app) {
    this.io = new WebSocket.Server({
      server: this.httpserver,
      maxPayload: 40000000
    });
    this.io.on("connection", (function(_this) {
      return function(socket, request) {
        socket.request = request;
        socket.remoteAddress = request.headers['x-forwarded-for'];
        return new Session(_this, socket);
      };
    })(this));
    return console.info("MAX PAYLOAD = " + this.io.options.maxPayload);
  };

  return DumbApp;

})();

module.exports = new this.DumbApp();
