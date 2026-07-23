var simpleGit;

simpleGit = require("simple-git");

this.GitManager = (function() {
  function GitManager(project) {
    this.project = project;
  }

  GitManager.prototype.git = function() {
    return simpleGit(this.project.local_folder);
  };

  GitManager.prototype.requireLinked = function(callback) {
    if (!this.project.local_folder) {
      callback({
        error: "project is not linked to a local folder"
      });
      return false;
    } else {
      return true;
    }
  };

  GitManager.prototype.validRemoteName = function(name) {
    return typeof name === "string" && /^[A-Za-z0-9_.-]{1,50}$/.test(name);
  };

  GitManager.prototype.validRemoteUrl = function(url) {
    return typeof url === "string" && url.length > 0 && url.length < 500 && !/[\x00-\x1f]/.test(url);
  };

  GitManager.prototype.status = function(callback) {
    if (!this.requireLinked(callback)) {
      return;
    }
    return this.git().status().then((function(_this) {
      return function(status) {
        var r;
        return callback({
          ok: true,
          branch: status.current,
          tracking: status.tracking,
          ahead: status.ahead,
          behind: status.behind,
          not_added: status.not_added,
          modified: status.modified,
          created: status.created,
          deleted: status.deleted,
          conflicted: status.conflicted,
          renamed: (function() {
            var i, len, ref, results;
            ref = status.renamed;
            results = [];
            for (i = 0, len = ref.length; i < len; i++) {
              r = ref[i];
              results.push(r.to);
            }
            return results;
          })()
        });
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        return callback({
          error: err.message
        });
      };
    })(this));
  };

  GitManager.prototype.init = function(callback) {
    if (!this.requireLinked(callback)) {
      return;
    }
    return this.git().init().then((function(_this) {
      return function() {
        return callback({
          ok: true
        });
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        return callback({
          error: err.message
        });
      };
    })(this));
  };

  GitManager.prototype.setRemote = function(name, url, callback) {
    var g;
    if (!this.requireLinked(callback)) {
      return;
    }
    if (!this.validRemoteName(name) || !this.validRemoteUrl(url)) {
      return callback({
        error: "invalid remote name or url"
      });
    }
    g = this.git();
    return g.getRemotes().then((function(_this) {
      return function(remotes) {
        var exists;
        exists = remotes.some(function(r) {
          return r.name === name;
        });
        if (exists) {
          return g.remote(["set-url", name, url]);
        } else {
          return g.addRemote(name, url);
        }
      };
    })(this)).then((function(_this) {
      return function() {
        return callback({
          ok: true
        });
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        return callback({
          error: err.message
        });
      };
    })(this));
  };

  GitManager.prototype.commit = function(message, callback) {
    var g;
    if (!this.requireLinked(callback)) {
      return;
    }
    if (typeof message !== "string" || message.trim().length === 0) {
      return callback({
        error: "empty commit message"
      });
    }
    g = this.git();
    return g.add(".").then((function(_this) {
      return function() {
        return g.commit(message.substring(0, 500));
      };
    })(this)).then((function(_this) {
      return function(result) {
        return callback({
          ok: true,
          summary: result.summary
        });
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        return callback({
          error: err.message
        });
      };
    })(this));
  };

  GitManager.prototype.push = function(callback) {
    if (!this.requireLinked(callback)) {
      return;
    }
    return this.git().push().then((function(_this) {
      return function() {
        return callback({
          ok: true
        });
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        return callback({
          error: err.message
        });
      };
    })(this));
  };

  GitManager.prototype.pull = function(callback) {
    if (!this.requireLinked(callback)) {
      return;
    }
    return this.git().pull().then((function(_this) {
      return function() {
        return callback({
          ok: true
        });
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        return callback({
          error: err.message
        });
      };
    })(this));
  };

  GitManager.prototype.log = function(callback) {
    if (!this.requireLinked(callback)) {
      return;
    }
    return this.git().log({
      maxCount: 30
    }).then((function(_this) {
      return function(result) {
        var e;
        return callback({
          ok: true,
          entries: (function() {
            var i, len, ref, results;
            ref = result.all;
            results = [];
            for (i = 0, len = ref.length; i < len; i++) {
              e = ref[i];
              results.push({
                hash: e.hash,
                date: e.date,
                message: e.message,
                author: e.author_name
              });
            }
            return results;
          })()
        });
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        return callback({
          error: err.message
        });
      };
    })(this));
  };

  return GitManager;

})();

module.exports = this.GitManager;
