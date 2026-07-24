var DEFAULT_CODE, Project, Token, Translator, User;

User = require(__dirname + "/user.js");

Project = require(__dirname + "/project.js");

Token = require(__dirname + "/token.js");

Translator = require(__dirname + "/translator.js");

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
    this.translator = new Translator(this);
  }

  Content.prototype.close = function() {};

  Content.prototype.load = function() {
    var id, j, k, l, len, len1, len2, projects, record, ref, token, tokens, user, users;
    users = this.db.list("users");
    for (j = 0, len = users.length; j < len; j++) {
      record = users[j];
      this.loadUser(record);
    }
    if (this.user_count > 1) {
      throw "Error, cannot run local single-user mode if user_count>1";
    } else if (this.user_count === 0) {
      this.local_user = this.createUser({
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
    } else {
      ref = this.users;
      for (id in ref) {
        user = ref[id];
        this.local_user = user;
        break;
      }
    }
    this.local_user.max_storage = 10000000000;
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
      language: "microscript_v2",
      graphics: "M1",
      libs: data.libs,
      libraries: data.libraries,
      description: data.description || ""
    };
    record = this.db.create("projects", d);
    project = this.loadProject(record);
    if (empty) {
      return callback(project);
    } else {
      content = DEFAULT_CODE;
      return this.files.write(owner.id + "/" + project.id + "/ms/main.ms", content, (function(_this) {
        return function() {
          return _this.files.copyFile("../static/img/defaultappicon.png", owner.id + "/" + project.id + "/sprites/icon.png", function() {
            return callback(project);
          });
        };
      })(this));
    }
  };

  return Content;

})();

DEFAULT_CODE = "init = function()\nend\n\nupdate = function()\nend\n\ndraw = function()\nend";

module.exports = this.Content;
