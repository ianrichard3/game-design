this.GitPanel = (function() {
  function GitPanel(app) {
    this.app = app;
    this.app.appui.setAction("git-refresh", (function(_this) {
      return function() {
        return _this.refresh();
      };
    })(this));
    this.app.appui.setAction("git-init", (function(_this) {
      return function() {
        return _this.init();
      };
    })(this));
    this.app.appui.setAction("git-set-remote", (function(_this) {
      return function() {
        return _this.setRemote();
      };
    })(this));
    this.app.appui.setAction("git-commit", (function(_this) {
      return function() {
        return _this.commit();
      };
    })(this));
    this.app.appui.setAction("git-push", (function(_this) {
      return function() {
        return _this.push();
      };
    })(this));
    this.app.appui.setAction("git-pull", (function(_this) {
      return function() {
        return _this.pull();
      };
    })(this));
  }

  GitPanel.prototype.projectOpened = function() {
    return this.reset();
  };

  GitPanel.prototype.reset = function() {
    document.getElementById("git-commit-message").value = "";
    document.getElementById("git-remote-url").value = "";
    document.getElementById("git-changed-files").innerHTML = "";
    document.getElementById("git-log-list").innerHTML = "";
    this.showError("");
    return this.updatePanelVisibility();
  };

  GitPanel.prototype.updatePanelVisibility = function() {
    var linked;
    linked = this.app.project.local_folder != null;
    document.getElementById("git-panel-unlinked").style.display = linked ? "none" : "block";
    document.getElementById("git-panel-linked").style.display = linked ? "block" : "none";
    if (linked) {
      this.refresh();
      return this.loadLog();
    }
  };

  GitPanel.prototype.showError = function(text) {
    return document.getElementById("git-panel-error").innerText = text || "";
  };

  GitPanel.prototype.send = function(msg, callback) {
    msg.project = this.app.project.id;
    return this.app.client.sendRequest(msg, (function(_this) {
      return function(result) {
        if (result.error != null) {
          _this.showError(result.error);
        } else {
          _this.showError("");
        }
        if (callback != null) {
          return callback(result);
        }
      };
    })(this));
  };

  GitPanel.prototype.refresh = function() {
    return this.send({
      name: "git_status"
    }, (function(_this) {
      return function(result) {
        var addLine, ahead_behind, f, i, j, k, l, len, len1, len2, len3, len4, list, m, ref, ref1, ref2, ref3, ref4;
        if (result.error != null) {
          return;
        }
        document.getElementById("git-branch").innerText = _this.app.translator.get("Branch: %BRANCH%").replace("%BRANCH%", result.branch || "-");
        ahead_behind = "";
        if (result.ahead > 0) {
          ahead_behind += _this.app.translator.get("%N% ahead").replace("%N%", result.ahead) + " ";
        }
        if (result.behind > 0) {
          ahead_behind += _this.app.translator.get("%N% behind").replace("%N%", result.behind);
        }
        document.getElementById("git-ahead-behind").innerText = ahead_behind;
        list = document.getElementById("git-changed-files");
        list.innerHTML = "";
        addLine = function(type, file) {
          var div;
          div = document.createElement("div");
          div.classList.add(type);
          div.innerHTML = "<i class=\"fa\"></i> " + file;
          return list.appendChild(div);
        };
        ref = result.not_added || [];
        for (i = 0, len = ref.length; i < len; i++) {
          f = ref[i];
          addLine("create", f);
        }
        ref1 = result.modified || [];
        for (j = 0, len1 = ref1.length; j < len1; j++) {
          f = ref1[j];
          addLine("sync", f);
        }
        ref2 = result.created || [];
        for (k = 0, len2 = ref2.length; k < len2; k++) {
          f = ref2[k];
          addLine("upgrade", f);
        }
        ref3 = result.deleted || [];
        for (l = 0, len3 = ref3.length; l < len3; l++) {
          f = ref3[l];
          addLine("delete", f);
        }
        ref4 = result.conflicted || [];
        for (m = 0, len4 = ref4.length; m < len4; m++) {
          f = ref4[m];
          addLine("downgrade", f);
        }
        if (list.innerHTML === "") {
          return list.innerHTML = "<div>" + (_this.app.translator.get("Working tree clean")) + "</div>";
        }
      };
    })(this));
  };

  GitPanel.prototype.init = function() {
    return this.send({
      name: "git_init"
    }, (function(_this) {
      return function(result) {
        if (result.error == null) {
          return _this.refresh();
        }
      };
    })(this));
  };

  GitPanel.prototype.setRemote = function() {
    var url;
    url = document.getElementById("git-remote-url").value.trim();
    if (url.length === 0) {
      return;
    }
    return this.send({
      name: "git_set_remote",
      remote_name: "origin",
      url: url
    }, (function(_this) {
      return function(result) {
        if (result.error == null) {
          return _this.refresh();
        }
      };
    })(this));
  };

  GitPanel.prototype.commit = function() {
    var message;
    message = document.getElementById("git-commit-message").value.trim();
    if (message.length === 0) {
      return this.showError(this.app.translator.get("Enter a commit message first"));
    }
    return this.send({
      name: "git_commit",
      message: message
    }, (function(_this) {
      return function(result) {
        if (result.error == null) {
          document.getElementById("git-commit-message").value = "";
          _this.refresh();
          return _this.loadLog();
        }
      };
    })(this));
  };

  GitPanel.prototype.push = function() {
    return this.send({
      name: "git_push"
    }, (function(_this) {
      return function(result) {
        if (result.error == null) {
          return _this.refresh();
        }
      };
    })(this));
  };

  GitPanel.prototype.pull = function() {
    return this.send({
      name: "git_pull"
    }, (function(_this) {
      return function(result) {
        if (result.error == null) {
          return _this.refresh();
        }
      };
    })(this));
  };

  GitPanel.prototype.loadLog = function() {
    return this.send({
      name: "git_log"
    }, (function(_this) {
      return function(result) {
        var date, div, entry, i, len, list, ref, results;
        if (result.error != null) {
          return;
        }
        list = document.getElementById("git-log-list");
        list.innerHTML = "";
        ref = result.entries || [];
        results = [];
        for (i = 0, len = ref.length; i < len; i++) {
          entry = ref[i];
          div = document.createElement("div");
          div.classList.add("gitlogentry");
          date = new Date(entry.date).toLocaleString();
          div.innerHTML = "<span class=\"hash\">" + (entry.hash.substring(0, 7)) + "</span> <span class=\"message\">" + entry.message + "</span> <span class=\"meta\">" + entry.author + " - " + date + "</span>";
          results.push(list.appendChild(div));
        }
        return results;
      };
    })(this));
  };

  return GitPanel;

})();
