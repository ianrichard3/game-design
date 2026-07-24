var Content, DB, FileStorage, Session, WebApp, WebSocket, compression, express, fs, path, process,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

compression = require("compression");

express = require("express");

fs = require("fs");

path = require("path");

DB = require(__dirname + "/db/db.js");

FileStorage = require(__dirname + "/filestorage/filestorage.js");

Content = require(__dirname + "/content/content.js");

WebApp = require(__dirname + "/webapp.js");

Session = require(__dirname + "/session/session.js");

WebSocket = require("ws");

process = require("process");

this.Server = (function() {
  function Server(config, callback) {
    this.config = config != null ? config : {};
    this.callback = callback;
    this.exit = bind(this.exit, this);
    process.chdir(__dirname);
    this.app_data = this.config.app_data || "..";
    this.PORT = this.config.port;
    if (!(typeof this.PORT === "number" && this.PORT >= 0 && this.PORT <= 65535 && this.PORT % 1 === 0)) {
      this.PORT = 8089;
    }
    this.create();
  }

  Server.prototype.create = function() {
    var app, static_files;
    app = express();
    static_files = "../static";
    this.date_started = Date.now();
    app.use(compression());
    app.use(express["static"](static_files));
    app.use("/microstudio.wiki", express["static"]("../microstudio.wiki", {
      dotfiles: "ignore"
    }));
    app.use("/lib/fontlib/ubuntu", express["static"]("node_modules/@fontsource/ubuntu"));
    app.use("/lib/fontlib/ubuntu-mono", express["static"]("node_modules/@fontsource/ubuntu-mono"));
    app.use("/lib/fontlib/source-sans-pro", express["static"]("node_modules/@fontsource/source-sans-pro"));
    app.use("/lib/fontlib/fontawesome", express["static"]("node_modules/@fortawesome/fontawesome-free"));
    app.use("/lib/ace", express["static"]("node_modules/ace-builds/src-min"));
    app.use("/lib/marked/marked.js", express["static"]("node_modules/marked/marked.min.js"));
    app.use("/lib/dompurify/purify.js", express["static"]("node_modules/dompurify/dist/purify.min.js"));
    app.use("/lib/jquery/jquery.js", express["static"]("node_modules/jquery/dist/jquery.min.js"));
    app.use("/lib/jquery-ui", express["static"]("node_modules/jquery-ui-dist"));
    app.use("/lib/wavefile", express["static"]("node_modules/wavefile/dist"));
    app.use("/lib/lamejs/lame.min.js", express["static"]("node_modules/lamejs/lame.min.js"));
    return this.db = new DB(this.app_data + "/data", (function(_this) {
      return function(db) {
        _this.use_cache = false;
        return _this.httpserver = require("http").createServer(app).listen(_this.PORT, "127.0.0.1", function() {
          _this.PORT = _this.httpserver.address().port;
          _this.start(app, db);
          console.info("local server running on port " + _this.PORT);
          if (_this.callback != null) {
            return _this.callback();
          }
        });
      };
    })(this));
  };

  Server.prototype.start = function(app, db) {
    this.active_users = 0;
    this.io = new WebSocket.Server({
      server: this.httpserver,
      maxPayload: 1000000000
    });
    this.sessions = [];
    this.io.on("connection", (function(_this) {
      return function(socket, request) {
        socket.request = request;
        socket.remoteAddress = request.connection.remoteAddress;
        return _this.sessions.push(new Session(_this, socket));
      };
    })(this));
    console.info("MAX PAYLOAD = " + this.io.options.maxPayload);
    this.session_check = setInterval(((function(_this) {
      return function() {
        return _this.sessionCheck();
      };
    })(this)), 10000);
    this.content = new Content(this, db, new FileStorage(this.app_data + "/files"));
    this.webapp = new WebApp(this, app);
    process.on('SIGINT', (function(_this) {
      return function() {
        console.log("caught INT signal");
        return _this.exit();
      };
    })(this));
    process.on('SIGTERM', (function(_this) {
      return function() {
        console.log("caught TERM signal");
        return _this.exit();
      };
    })(this));
    return this.exitcheck = setInterval(((function(_this) {
      return function() {
        if (fs.existsSync("exit")) {
          _this.exit();
          fs.unlinkSync("exit");
        }
        if (fs.existsSync("update")) {
          _this.webapp.concatenator.refresh();
          return fs.unlinkSync("update");
        }
      };
    })(this)), 2000);
  };

  Server.prototype.exit = function() {
    var base, finish, finished;
    if (this.exited) {
      return;
    }
    this.exited = true;
    clearInterval(this.exitcheck);
    clearInterval(this.session_check);
    if (this.io != null) {
      this.io.clients.forEach((function(_this) {
        return function(socket) {
          return socket.terminate();
        };
      })(this));
      this.io.close();
    }
    if (this.content != null) {
      this.content.close();
    }
    if (this.db != null) {
      this.db.close();
    }
    finished = false;
    finish = function() {
      if (finished) {
        return;
      }
      finished = true;
      return process.exit(0);
    };
    if (this.httpserver != null) {
      this.httpserver.close(finish);
      if (typeof (base = this.httpserver).closeAllConnections === "function") {
        base.closeAllConnections();
      }
    }
    return setTimeout(finish, 1000);
  };

  Server.prototype.sessionCheck = function() {
    var i, len, ref, s;
    ref = this.sessions;
    for (i = 0, len = ref.length; i < len; i++) {
      s = ref[i];
      if (s != null) {
        s.timeCheck();
      }
    }
  };

  Server.prototype.sessionClosed = function(session) {
    var index;
    index = this.sessions.indexOf(session);
    if (index >= 0) {
      return this.sessions.splice(index, 1);
    }
  };

  Server.prototype.localFoldersEnabled = function() {
    return true;
  };

  Server.prototype.pathIsWithin = function(root, candidate) {
    var relative;
    relative = path.relative(path.resolve(root), path.resolve(candidate));
    return relative === "" || (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
  };

  Server.prototype.browseProjectFolders = function(folder) {
    var code, drive, entries, entry, entry_path, err, i, internal_data, internal_files, j, len, names, parent, requested, resolved, root, stat;
    if (!this.localFoldersEnabled()) {
      return {
        error: "Local project folders are not enabled on this server"
      };
    }
    root = path.resolve(this.config.projects_root || path.parse(process.cwd()).root);
    requested = folder || root;
    if (typeof requested !== "string" || requested.length === 0 || requested.length > 1000) {
      return {
        error: "invalid path"
      };
    }
    if (!path.isAbsolute(requested)) {
      return {
        error: "path must be absolute"
      };
    }
    try {
      root = fs.realpathSync(root);
      resolved = fs.realpathSync(path.resolve(requested));
    } catch (error) {
      err = error;
      return {
        error: "folder does not exist or cannot be read"
      };
    }
    if (this.config.projects_root && !this.pathIsWithin(root, resolved)) {
      return {
        error: "path must be inside " + root
      };
    }
    try {
      stat = fs.statSync(resolved);
      if (!stat.isDirectory()) {
        return {
          error: "not a folder"
        };
      }
      names = fs.readdirSync(resolved, {
        withFileTypes: true
      });
    } catch (error) {
      err = error;
      return {
        error: "folder cannot be read"
      };
    }
    internal_files = path.resolve(this.app_data + "/files");
    internal_data = path.resolve(this.app_data + "/data");
    entries = [];
    for (i = 0, len = names.length; i < len; i++) {
      entry = names[i];
      if (!entry.isDirectory()) {
        continue;
      }
      if (entry.name === ".git" || entry.name === "node_modules") {
        continue;
      }
      entry_path = path.join(resolved, entry.name);
      if (this.pathIsWithin(internal_files, entry_path) || this.pathIsWithin(internal_data, entry_path)) {
        continue;
      }
      entries.push({
        name: entry.name,
        path: entry_path
      });
    }
    if (process.platform === "win32" && !this.config.projects_root && resolved === path.parse(resolved).root) {
      for (code = j = 65; j <= 90; code = ++j) {
        drive = String.fromCharCode(code) + ":\\";
        if (fs.existsSync(drive)) {
          entries.push({
            name: drive,
            path: drive
          });
        }
      }
    }
    entries.sort(function(a, b) {
      return a.name.localeCompare(b.name);
    });
    parent = resolved === path.parse(resolved).root || (root === resolved && this.config.projects_root) ? null : path.dirname(resolved);
    return {
      root: root,
      path: resolved,
      parent: parent,
      entries: entries
    };
  };

  Server.prototype.checkProjectFolder = function(folder) {
    var err, i, internal, internal_data, internal_files, len, parent_err, ref, resolved, root;
    if (!this.localFoldersEnabled()) {
      return {
        error: "Local project folders are not enabled on this server"
      };
    }
    if (typeof folder !== "string" || folder.length === 0 || folder.length > 1000) {
      return {
        error: "invalid path"
      };
    }
    if (!path.isAbsolute(folder)) {
      return {
        error: "path must be absolute"
      };
    }
    resolved = path.resolve(folder);
    try {
      resolved = fs.realpathSync(resolved);
    } catch (error) {
      err = error;
      try {
        resolved = path.join(fs.realpathSync(path.dirname(resolved)), path.basename(resolved));
      } catch (error) {
        parent_err = error;
        resolved = path.resolve(folder);
      }
    }
    if (fs.existsSync(resolved)) {
      try {
        if (!fs.statSync(resolved).isDirectory()) {
          return {
            error: "path is not a folder"
          };
        }
        fs.accessSync(resolved, fs.constants.R_OK | fs.constants.W_OK);
      } catch (error) {
        err = error;
        return {
          error: "folder cannot be accessed"
        };
      }
    }
    if (this.config.projects_root) {
      root = path.resolve(this.config.projects_root);
      try {
        root = fs.realpathSync(root);
      } catch (error) {
        err = error;
        root = path.resolve(this.config.projects_root);
      }
      if (!this.pathIsWithin(root, resolved)) {
        return {
          error: "path must be inside " + root
        };
      }
    }
    internal_files = path.resolve(this.app_data + "/files");
    internal_data = path.resolve(this.app_data + "/data");
    ref = [internal_files, internal_data];
    for (i = 0, len = ref.length; i < len; i++) {
      internal = ref[i];
      try {
        internal = fs.realpathSync(internal);
      } catch (error) {
        err = error;
        continue;
      }
      if (this.pathIsWithin(internal, resolved)) {
        return {
          error: "cannot use microStudio's internal storage folder"
        };
      }
    }
    return {
      resolved: resolved
    };
  };

  return Server;

})();

module.exports = this.Server;
