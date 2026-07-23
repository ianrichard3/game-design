var Cleaner, DEFAULT_CODE, Project, Token, Translator, User, usage;

usage = require("pidusage");

User = require(__dirname + "/user.js");

Project = require(__dirname + "/project.js");

Token = require(__dirname + "/token.js");

Translator = require(__dirname + "/translator.js");

Cleaner = require(__dirname + "/cleaner.js");

this.Content = (function() {
  function Content(server, db, files) {
    this.server = server;
    this.db = db;
    this.files = files;
    this.users = {};
    this.users_by_email = {};
    this.users_by_nick = {};
    this.tokens = {};
    this.projects = {};
    this.project_count = 0;
    this.user_count = 0;
    this.guest_count = 0;
    this.load();
    console.info("Content loaded: " + this.user_count + " users and " + this.project_count + " projects");
    this.log_interval = setInterval(((function(_this) {
      return function() {
        return _this.statusLog();
      };
    })(this)), 6000);
    this.translator = new Translator(this);
    this.cleaner = new Cleaner(this);
  }

  Content.prototype.close = function() {
    clearInterval(this.log_interval);
    if (this.cleaner != null) {
      return this.cleaner.stop();
    }
  };

  Content.prototype.statusLog = function() {
    return usage(process.pid, (function(_this) {
      return function(err, result) {
        if (result == null) {
          return;
        }
        console.info("------------");
        console.info("" + (new Date().toString()));
        console.info("cpu: " + (Math.round(result.cpu)) + "%");
        console.info("memory: " + (Math.round(result.memory / 1000000)) + " mb");
        console.info("users: " + _this.user_count);
        console.info("projects: " + _this.project_count);
        _this.current_cpu = Math.round(result.cpu);
        _this.current_memory = Math.round(result.memory / 1000000);
        _this.server.stats.max("cpu_max", Math.round(result.cpu));
        return _this.server.stats.max("memory_max", _this.current_memory);
      };
    })(this));
  };

  Content.prototype.load = function() {
    var j, k, l, len, len1, len2, projects, record, token, tokens, user, users;
    users = this.db.list("users");
    for (j = 0, len = users.length; j < len; j++) {
      record = users[j];
      this.loadUser(record);
    }
    if (this.server.config.standalone) {
      if (this.user_count > 1) {
        throw "Error, cannot run standalone if user_count>1";
      } else if (this.user_count === 0) {
        user = this.createUser({
          nick: "microstudio",
          email: "standalone@microstudio.dev",
          flags: {
            validated: true
          },
          hash: "---",
          date_created: Date.now(),
          last_active: Date.now(),
          creation_ip: "127.0.0.1"
        });
      }
      this.users[0].max_storage = 10000000000;
    }
    tokens = this.db.list("tokens");
    for (k = 0, len1 = tokens.length; k < len1; k++) {
      token = tokens[k];
      this.loadToken(token);
    }
    projects = this.db.list("projects");
    for (l = 0, len2 = projects.length; l < len2; l++) {
      record = projects[l];
      this.loadProject(record);
    }
  };

  Content.prototype.loadUser = function(record) {
    var data, user;
    data = record.get();
    user = new User(this, record);
    if (user.flags.deleted) {
      return;
    }
    this.users[user.id] = user;
    if (user.email != null) {
      this.users_by_email[user.email] = user;
    } else {
      this.guest_count += 1;
    }
    this.users_by_nick[user.nick] = user;
    this.user_count++;
    return user;
  };

  Content.prototype.loadProject = function(record) {
    var data, project;
    data = record.get();
    project = new Project(this, record);
    if ((project.owner != null) && !project.deleted) {
      this.projects[project.id] = project;
      this.project_count++;
    }
    return project;
  };

  Content.prototype.loadToken = function(record) {
    var data, token;
    data = record.get();
    token = new Token(this, record);
    if (token.user != null) {
      this.tokens[token.value] = token;
    }
    return token;
  };

  Content.prototype.setProjectType = function(project, type) {
    return project.setType(type);
  };

  Content.prototype.projectDeleted = function(project) {
    return this.project_count -= 1;
  };

  Content.prototype.setProjectTags = function(project, tags) {
    return project.set("tags", tags);
  };

  Content.prototype.createUser = function(data) {
    var record;
    record = this.db.create("users", data);
    return this.loadUser(record);
  };

  Content.prototype.createToken = function(user) {
    var chars, i, j, record, value;
    value = "";
    chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (i = j = 0; j <= 31; i = j += 1) {
      value += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    record = this.db.create("tokens", {
      value: value,
      user: user.id,
      date_created: Date.now()
    });
    return this.loadToken(record);
  };

  Content.prototype.findUserByNick = function(nick) {
    return this.users_by_nick[nick];
  };

  Content.prototype.findUserByEmail = function(email) {
    return this.users_by_email[email];
  };

  Content.prototype.changeUserNick = function(user, nick) {
    delete this.users_by_nick[user.nick];
    user.set("nick", nick);
    return this.users_by_nick[nick] = user;
  };

  Content.prototype.changeUserEmail = function(user, email) {
    if (user.email != null) {
      delete this.users_by_email[user.email];
    } else {
      this.guest_count -= 1;
    }
    user.set("email", email);
    return this.users_by_email[email] = user;
  };

  Content.prototype.userDeleted = function(user) {
    delete this.users_by_nick[user.nick];
    if (user.email != null) {
      delete this.users_by_email[user.email];
    } else {
      this.guest_count -= 1;
    }
    return this.user_count -= 1;
  };

  Content.prototype.findToken = function(token) {
    return this.tokens[token];
  };

  Content.prototype.createProject = function(owner, data, callback, empty) {
    var content, count, d, project, record, ref, slug;
    if (empty == null) {
      empty = false;
    }
    slug = data.slug;
    if (owner.findProjectBySlug(slug)) {
      count = 2;
      while (owner.findProjectBySlug(slug + count) != null) {
        count += 1;
      }
      data.slug = slug + count;
    }
    d = {
      title: data.title,
      slug: data.slug,
      tags: [],
      likes: [],
      "public": false,
      date_created: Date.now(),
      last_modified: Date.now(),
      deleted: false,
      owner: owner.id,
      orientation: data.orientation,
      aspect: data.aspect,
      type: (ref = data.type) === "app" || ref === "library" ? data.type : "app",
      language: data.language,
      graphics: data.graphics,
      libs: data.libs,
      tabs: data.tabs,
      plugins: data.plugins,
      libraries: data.libraries,
      description: data.description || ""
    };
    record = this.db.create("projects", d);
    project = this.loadProject(record);
    if (empty) {
      return callback(project);
    } else {
      if ((project.language != null) && (DEFAULT_CODE[project.language] != null)) {
        content = DEFAULT_CODE[project.language];
      } else {
        content = DEFAULT_CODE.microscript;
      }
      return this.files.write(owner.id + "/" + project.id + "/ms/main.ms", content, (function(_this) {
        return function() {
          return _this.files.copyFile("../static/img/defaultappicon.png", owner.id + "/" + project.id + "/sprites/icon.png", function() {
            return callback(project);
          });
        };
      })(this));
    }
  };

  Content.prototype.getConsoleGameList = function() {
    var key, list, p, ref;
    list = [];
    ref = this.projects;
    for (key in ref) {
      p = ref[key];
      if (p["public"] && !p.deleted) {
        list.push({
          author: p.owner.nick,
          slug: p.slug,
          title: p.title
        });
      }
    }
    return list;
  };

  Content.prototype.sendValidationMail = function(user) {
    var subject, text, token, translator;
    if (user.email == null) {
      return;
    }
    token = user.getValidationToken();
    translator = this.translator.getTranslator(user.language);
    subject = translator.get("Microstudio e-mail validation");
    text = translator.get("Thank you for using Microstudio!") + "\n\n";
    text += translator.get("Click on the link below to validate your e-mail address:") + "\n\n";
    text += ("https://microstudio.dev/v/" + user.id + "/" + token) + "\n\n";
    return this.server.mailer.sendMail(user.email, subject, text);
  };

  Content.prototype.sendPasswordRecoveryMail = function(user) {
    var subject, text, token, translator;
    if (user.email == null) {
      return;
    }
    token = user.getValidationToken();
    translator = this.translator.getTranslator(user.language);
    subject = translator.get("Reset your microStudio password");
    text = translator.get("Click on the link below to choose a new microStudio password:") + "\n\n";
    text += ("https://microstudio.dev/pw/" + user.id + "/" + token) + "\n\n";
    return this.server.mailer.sendMail(user.email, subject, text);
  };

  Content.prototype.checkValidationToken = function(user, token) {
    return token === user.getValidationToken();
  };

  Content.prototype.validateEMailAddress = function(user, token) {
    var translator;
    console.info("verifying " + token + " against " + (user.getValidationToken()));
    if ((token != null) && token.length > 0 && this.checkValidationToken(user, token)) {
      user.resetValidationToken();
      user.setFlag("validated", true);
      translator = this.translator.getTranslator(user.language);
      return user.notify(translator.get("Your e-mail address is now validated"));
    }
  };

  return Content;

})();

DEFAULT_CODE = {
  python: "def init():\n  pass\n\ndef update():\n  pass\n\ndef draw():\n  pass",
  javascript: "init = function() {\n}\n\nupdate = function() {\n}\n\ndraw = function() {\n}",
  lua: "init = function()\nend\n\nupdate = function()\nend\n\ndraw = function()\nend",
  microscript: "init = function()\nend\n\nupdate = function()\nend\n\ndraw = function()\nend"
};

module.exports = this.Content;
