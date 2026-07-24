var JSZip, ProjectManager,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

ProjectManager = require(__dirname + "/projectmanager.js");

JSZip = require("jszip");

this.Session = (function() {
  function Session(server, socket) {
    this.server = server;
    this.socket = socket;
    this.bufferReceived = bind(this.bufferReceived, this);
    this.uploadRequest = bind(this.uploadRequest, this);
    this.content = this.server.content;
    if (this.content == null) {
      return this.socket.close();
    }
    this.translator = this.content.translator.getTranslator("en");
    this.user = null;
    this.last_active = Date.now();
    this.socket.on("message", (function(_this) {
      return function(msg) {
        _this.messageReceived(msg);
        return _this.last_active = Date.now();
      };
    })(this));
    this.socket.on("close", (function(_this) {
      return function() {
        _this.server.sessionClosed(_this);
        return _this.disconnected();
      };
    })(this));
    this.socket.on("error", (function(_this) {
      return function(err) {
        if (_this.user) {
          console.error("WS ERROR for user " + _this.user.id + " - " + _this.user.nick);
        } else {
          console.error("WS ERROR");
        }
        return console.error(err);
      };
    })(this));
    this.commands = {};
    this.register("ping", (function(_this) {
      return function(msg) {
        return _this.send({
          name: "pong"
        });
      };
    })(this));
    this.register("token", (function(_this) {
      return function(msg) {
        return _this.checkToken(msg);
      };
    })(this));
    this.register("create_project", (function(_this) {
      return function(msg) {
        return _this.createProject(msg);
      };
    })(this));
    this.register("import_project", (function(_this) {
      return function(msg) {
        return _this.importProject(msg);
      };
    })(this));
    this.register("set_project_option", (function(_this) {
      return function(msg) {
        return _this.setProjectOption(msg);
      };
    })(this));
    this.register("set_project_property", (function(_this) {
      return function(msg) {
        return _this.setProjectProperty(msg);
      };
    })(this));
    this.register("delete_project", (function(_this) {
      return function(msg) {
        return _this.deleteProject(msg);
      };
    })(this));
    this.register("get_project_list", (function(_this) {
      return function(msg) {
        return _this.getProjectList(msg);
      };
    })(this));
    this.register("update_code", (function(_this) {
      return function(msg) {
        return _this.updateCode(msg);
      };
    })(this));
    this.register("lock_project_file", (function(_this) {
      return function(msg) {
        return _this.lockProjectFile(msg);
      };
    })(this));
    this.register("write_project_file", (function(_this) {
      return function(msg) {
        return _this.writeProjectFile(msg);
      };
    })(this));
    this.register("read_project_file", (function(_this) {
      return function(msg) {
        return _this.readProjectFile(msg);
      };
    })(this));
    this.register("rename_project_file", (function(_this) {
      return function(msg) {
        return _this.renameProjectFile(msg);
      };
    })(this));
    this.register("delete_project_file", (function(_this) {
      return function(msg) {
        return _this.deleteProjectFile(msg);
      };
    })(this));
    this.register("list_project_files", (function(_this) {
      return function(msg) {
        return _this.listProjectFiles(msg);
      };
    })(this));
    this.register("list_public_project_files", (function(_this) {
      return function(msg) {
        return _this.listPublicProjectFiles(msg);
      };
    })(this));
    this.register("read_public_project_file", (function(_this) {
      return function(msg) {
        return _this.readPublicProjectFile(msg);
      };
    })(this));
    this.register("listen_to_project", (function(_this) {
      return function(msg) {
        return _this.listenToProject(msg);
      };
    })(this));
    this.register("get_file_versions", (function(_this) {
      return function(msg) {
        return _this.getFileVersions(msg);
      };
    })(this));
    this.register("set_project_local_folder", (function(_this) {
      return function(msg) {
        return _this.setProjectLocalFolder(msg);
      };
    })(this));
    this.register("unlink_project_local_folder", (function(_this) {
      return function(msg) {
        return _this.unlinkProjectLocalFolder(msg);
      };
    })(this));
    this.register("git_status", (function(_this) {
      return function(msg) {
        return _this.gitStatus(msg);
      };
    })(this));
    this.register("git_init", (function(_this) {
      return function(msg) {
        return _this.gitInit(msg);
      };
    })(this));
    this.register("git_set_remote", (function(_this) {
      return function(msg) {
        return _this.gitSetRemote(msg);
      };
    })(this));
    this.register("git_commit", (function(_this) {
      return function(msg) {
        return _this.gitCommit(msg);
      };
    })(this));
    this.register("git_push", (function(_this) {
      return function(msg) {
        return _this.gitPush(msg);
      };
    })(this));
    this.register("git_pull", (function(_this) {
      return function(msg) {
        return _this.gitPull(msg);
      };
    })(this));
    this.register("git_log", (function(_this) {
      return function(msg) {
        return _this.gitLog(msg);
      };
    })(this));
    this.register("clone_project", (function(_this) {
      return function(msg) {
        return _this.cloneProject(msg);
      };
    })(this));
    this.register("backup_complete", (function(_this) {
      return function(msg) {
        return _this.backupComplete(msg);
      };
    })(this));
    this.register("upload_request", (function(_this) {
      return function(msg) {
        return _this.uploadRequest(msg);
      };
    })(this));
  }

  Session.prototype.register = function(name, callback) {
    return this.commands[name] = callback;
  };

  Session.prototype.disconnected = function() {
    var err;
    try {
      if ((this.project != null) && (this.project.manager != null)) {
        this.project.manager.removeSession(this);
        this.project.manager.removeListener(this);
      }
      if (this.user != null) {
        return this.user.removeListener(this);
      }
    } catch (error1) {
      err = error1;
      return console.error(err);
    }
  };

  Session.prototype.setCurrentProject = function(project) {
    if (project !== this.project || (this.project.manager == null)) {
      if ((this.project != null) && (this.project.manager != null)) {
        this.project.manager.removeSession(this);
      }
      this.project = project;
      if (this.project.manager == null) {
        new ProjectManager(this.project);
      }
      return this.project.manager.addUser(this);
    }
  };

  Session.prototype.messageReceived = function(msg) {
    var c, err;
    if (typeof msg !== "string") {
      return this.bufferReceived(msg);
    }
    try {
      msg = JSON.parse(msg);
      if (msg.name != null) {
        c = this.commands[msg.name];
        if (c != null) {
          return c(msg);
        }
      }
    } catch (error1) {
      err = error1;
      return console.info(err);
    }
  };

  Session.prototype.sendCodeUpdated = function(file, code) {
    this.send({
      name: "code_updated",
      file: file,
      code: code
    });
  };

  Session.prototype.sendProjectFileUpdated = function(type, file, version, data, properties) {
    return this.send({
      name: "project_file_updated",
      type: type,
      file: file,
      version: version,
      data: data,
      properties: properties
    });
  };

  Session.prototype.sendProjectFileDeleted = function(type, file) {
    return this.send({
      name: "project_file_deleted",
      type: type,
      file: file
    });
  };

  Session.prototype.getUserInfo = function() {
    return {
      size: this.user.getTotalSize(),
      max_storage: this.user.max_storage
    };
  };

  Session.prototype.checkToken = function(data) {
    this.user = this.content.local_user;
    this.user.addListener(this);
    this.send({
      name: "token_valid",
      nick: this.user.nick,
      email: this.user.email,
      flags: !this.user.flags.censored ? this.user.flags : {},
      info: this.getUserInfo(),
      settings: this.user.settings,
      notifications: this.user.notifications,
      request_id: data.request_id
    });
    this.user.notifications = [];
    return this.user.set("last_active", Date.now());
  };

  Session.prototype.send = function(data) {
    return this.socket.send(JSON.stringify(data));
  };

  Session.prototype.sendError = function(error, request_id) {
    return this.send({
      name: "error",
      error: error,
      request_id: request_id
    });
  };

  Session.prototype.requireOwnedProject = function(data) {
    var project;
    if (this.user == null) {
      return null;
    }
    if (data.project != null) {
      project = this.content.projects[data.project];
    }
    if ((project == null) || project.owner !== this.user) {
      return null;
    }
    this.setCurrentProject(project);
    return project;
  };

  Session.prototype.setProjectLocalFolder = function(data) {
    var project;
    if (this.user == null) {
      return this.sendError("not connected", data.request_id);
    }
    if (typeof data.folder !== "string") {
      return this.sendError("no folder", data.request_id);
    }
    project = this.requireOwnedProject(data);
    if (project == null) {
      return this.sendError("access denied", data.request_id);
    }
    return project.setLocalFolder(data.folder, (function(_this) {
      return function(err) {
        if (err) {
          return _this.sendError(err, data.request_id);
        } else {
          return _this.send({
            name: "set_project_local_folder",
            folder: project.local_folder,
            request_id: data.request_id
          });
        }
      };
    })(this));
  };

  Session.prototype.unlinkProjectLocalFolder = function(data) {
    var project;
    if (this.user == null) {
      return this.sendError("not connected", data.request_id);
    }
    project = this.requireOwnedProject(data);
    if (project == null) {
      return this.sendError("access denied", data.request_id);
    }
    return project.unlinkLocalFolder((function(_this) {
      return function(err) {
        if (err) {
          return _this.sendError(err, data.request_id);
        } else {
          return _this.send({
            name: "unlink_project_local_folder",
            request_id: data.request_id
          });
        }
      };
    })(this));
  };

  Session.prototype.gitStatus = function(data) {
    var project;
    if (this.user == null) {
      return this.sendError("not connected", data.request_id);
    }
    project = this.requireOwnedProject(data);
    if (project == null) {
      return this.sendError("access denied", data.request_id);
    }
    return project.manager.getGitManager().status((function(_this) {
      return function(result) {
        result.name = "git_status";
        result.request_id = data.request_id;
        return _this.send(result);
      };
    })(this));
  };

  Session.prototype.gitInit = function(data) {
    var project;
    if (this.user == null) {
      return this.sendError("not connected", data.request_id);
    }
    project = this.requireOwnedProject(data);
    if (project == null) {
      return this.sendError("access denied", data.request_id);
    }
    return project.manager.getGitManager().init((function(_this) {
      return function(result) {
        result.name = "git_init";
        result.request_id = data.request_id;
        return _this.send(result);
      };
    })(this));
  };

  Session.prototype.gitSetRemote = function(data) {
    var project;
    if (this.user == null) {
      return this.sendError("not connected", data.request_id);
    }
    project = this.requireOwnedProject(data);
    if (project == null) {
      return this.sendError("access denied", data.request_id);
    }
    return project.manager.getGitManager().setRemote(data.remote_name || "origin", data.url, (function(_this) {
      return function(result) {
        result.name = "git_set_remote";
        result.request_id = data.request_id;
        return _this.send(result);
      };
    })(this));
  };

  Session.prototype.gitCommit = function(data) {
    var project;
    if (this.user == null) {
      return this.sendError("not connected", data.request_id);
    }
    project = this.requireOwnedProject(data);
    if (project == null) {
      return this.sendError("access denied", data.request_id);
    }
    return project.manager.getGitManager().commit(data.message, (function(_this) {
      return function(result) {
        result.name = "git_commit";
        result.request_id = data.request_id;
        return _this.send(result);
      };
    })(this));
  };

  Session.prototype.gitPush = function(data) {
    var project;
    if (this.user == null) {
      return this.sendError("not connected", data.request_id);
    }
    project = this.requireOwnedProject(data);
    if (project == null) {
      return this.sendError("access denied", data.request_id);
    }
    return project.manager.getGitManager().push((function(_this) {
      return function(result) {
        result.name = "git_push";
        result.request_id = data.request_id;
        return _this.send(result);
      };
    })(this));
  };

  Session.prototype.gitPull = function(data) {
    var project;
    if (this.user == null) {
      return this.sendError("not connected", data.request_id);
    }
    project = this.requireOwnedProject(data);
    if (project == null) {
      return this.sendError("access denied", data.request_id);
    }
    return project.manager.getGitManager().pull((function(_this) {
      return function(result) {
        result.name = "git_pull";
        result.request_id = data.request_id;
        return _this.send(result);
      };
    })(this));
  };

  Session.prototype.gitLog = function(data) {
    var project;
    if (this.user == null) {
      return this.sendError("not connected", data.request_id);
    }
    project = this.requireOwnedProject(data);
    if (project == null) {
      return this.sendError("access denied", data.request_id);
    }
    return project.manager.getGitManager().log((function(_this) {
      return function(result) {
        result.name = "git_log";
        result.request_id = data.request_id;
        return _this.send(result);
      };
    })(this));
  };

  Session.prototype.importProject = function(data) {
    var buffer, projectFileName, zip;
    if (data.request_id == null) {
      return this.sendError("Bad request");
    }
    if (this.user == null) {
      return this.sendError("not connected", data.request_id);
    }
    buffer = data.data;
    if (buffer.byteLength > this.user.max_storage - this.user.getTotalSize()) {
      return this.sendError("storage space exceeded", data.request_id);
    }
    zip = new JSZip;
    projectFileName = "project.json";
    return zip.loadAsync(buffer).then(((function(_this) {
      return function(contents) {
        if (zip.file(projectFileName) == null) {
          _this.sendError("[ZIP] Missing " + projectFileName + "; import aborted", data.request_id);
          console.log("[ZIP] Missing " + projectFileName + "; import aborted");
          return;
        }
        return zip.file(projectFileName).async("string").then((function(text) {
          var err, projectInfo;
          try {
            projectInfo = JSON.parse(text);
          } catch (error1) {
            err = error1;
            _this.sendError("Incorrect JSON data", data.request_id);
            console.error(err);
            return;
          }
          return _this.content.createProject(_this.user, projectInfo, (function(project) {
            _this.setCurrentProject(project);
            return project.manager.importFiles(contents, function() {
              project.set("files", projectInfo.files || {});
              return _this.send({
                name: "project_imported",
                id: project.id,
                request_id: data.request_id
              });
            });
          }), true);
        }), function() {
          return _this.sendError("Malformed ZIP file", data.request_id);
        });
      };
    })(this)), (function(_this) {
      return function() {
        return _this.sendError("Malformed ZIP file", data.request_id);
      };
    })(this));
  };

  Session.prototype.createProject = function(data) {
    if (this.user == null) {
      return this.sendError("not connected");
    }
    return this.content.createProject(this.user, data, (function(_this) {
      return function(project) {
        return _this.send({
          name: "project_created",
          id: project.id,
          request_id: data.request_id
        });
      };
    })(this));
  };

  Session.prototype.cloneProject = function(data) {
    var manager, project;
    if (this.user == null) {
      return this.sendError("not connected");
    }
    if (data.project == null) {
      return this.sendError("");
    }
    project = this.server.content.projects[data.project];
    if (project != null) {
      manager = this.getProjectManager(project);
      if (manager.canRead(this.user)) {
        return this.content.createProject(this.user, {
          title: data.title || project.title,
          slug: project.slug,
          "public": false
        }, ((function(_this) {
          return function(clone) {
            var files, folders, funk, man;
            clone.setType(project.type);
            clone.setOrientation(project.orientation);
            clone.setAspect(project.aspect);
            clone.set("language", project.language);
            clone.setGraphics(project.graphics);
            clone.set("libs", project.libs);
            clone.set("libraries", project.libraries);
            clone.set("files", JSON.parse(JSON.stringify(project.files)));
            man = _this.getProjectManager(project);
            folders = ["ms", "sprites", "maps", "sounds", "sounds_th", "music", "music_th", "assets", "assets_th", "doc"];
            files = [];
            funk = function() {
              var dest, f, folder, src;
              if (folders.length > 0) {
                folder = folders.splice(0, 1)[0];
                return man.listFiles(folder, function(list) {
                  var f, i, len1;
                  for (i = 0, len1 = list.length; i < len1; i++) {
                    f = list[i];
                    files.push({
                      file: f.file,
                      folder: folder
                    });
                  }
                  return funk();
                });
              } else if (files.length > 0) {
                f = files.splice(0, 1)[0];
                src = project.owner.id + "/" + project.id + "/" + f.folder + "/" + f.file;
                dest = clone.owner.id + "/" + clone.id + "/" + f.folder + "/" + f.file;
                return project.getStorage().read(src, "binary", function(content) {
                  if (content != null) {
                    return clone.getStorage().write(dest, content, function() {
                      return funk();
                    });
                  } else {
                    return funk();
                  }
                });
              } else {
                return _this.send({
                  name: "project_created",
                  id: clone.id,
                  request_id: data.request_id
                });
              }
            };
            return funk();
          };
        })(this)), true);
      }
    }
  };

  Session.prototype.getProjectManager = function(project) {
    if (project.manager == null) {
      new ProjectManager(project);
    }
    return project.manager;
  };

  Session.prototype.setProjectOption = function(data) {
    var i, len1, project, ref, v;
    if (this.user == null) {
      return this.sendError("not connected");
    }
    if (data.value == null) {
      return this.sendError("no value");
    }
    project = this.user.findProject(data.project);
    if (project != null) {
      switch (data.option) {
        case "title":
          if (!project.setTitle(data.value)) {
            this.send({
              name: "error",
              value: project.title,
              request_id: data.request_id
            });
          }
          break;
        case "slug":
          if (!project.setSlug(data.value)) {
            this.send({
              name: "error",
              value: project.slug,
              request_id: data.request_id
            });
          }
          break;
        case "description":
          project.set("description", data.value);
          break;
        case "code":
          if (!project.setCode(data.value)) {
            this.send({
              name: "error",
              value: project.code,
              request_id: data.request_id
            });
          }
          break;
        case "platforms":
          if (Array.isArray(data.value)) {
            project.setPlatforms(data.value);
          }
          break;
        case "libs":
          if (Array.isArray(data.value)) {
            ref = data.value;
            for (i = 0, len1 = ref.length; i < len1; i++) {
              v = ref[i];
              if (typeof v !== "string" || v.length > 100 || data.value.length > 20) {
                return;
              }
            }
            project.set("libs", data.value);
          }
          break;
        case "libraries":
          if (typeof data.value === "object") {
            project.set("libraries", data.value);
          }
          break;
        case "type":
          if (typeof data.value === "string") {
            this.content.setProjectType(project, data.value);
          }
          break;
        case "orientation":
          if (typeof data.value === "string") {
            project.setOrientation(data.value);
          }
          break;
        case "aspect":
          if (typeof data.value === "string") {
            project.setAspect(data.value);
          }
          break;
        case "graphics":
          if (typeof data.value === "string") {
            project.setGraphics(data.value);
          }
          break;
        case "unlisted":
          project.set("unlisted", data.value ? true : false);
          break;
        case "language":
          if (typeof data.value === "string") {
            project.setLanguage(data.value);
          }
      }
      if (project.manager != null) {
        project.manager.propagateOptions(this);
      }
      return project.touch();
    }
  };

  Session.prototype.setProjectProperty = function(data) {
    var project;
    if (this.user == null) {
      return this.sendError("not connected");
    }
    if (data.project == null) {
      return this.sendError("no project");
    }
    if (data.property == null) {
      return this.sendError("no property");
    }
    project = this.user.findProject(data.project);
    if (project != null) {
      return project.setProperty(data.property, data.value);
    }
  };

  Session.prototype.deleteProject = function(data) {
    var project;
    if (this.user == null) {
      return this.sendError("not connected");
    }
    project = this.user.findProject(data.project);
    if (project != null) {
      this.user.deleteProject(project);
      return this.send({
        name: "project_deleted",
        id: project.id,
        request_id: data.request_id
      });
    }
  };

  Session.prototype.getProjectList = function(data) {
    var i, len1, list, p, source;
    if (this.user == null) {
      return this.sendError("not connected");
    }
    source = this.user.listProjects();
    list = [];
    for (i = 0, len1 = source.length; i < len1; i++) {
      p = source[i];
      if (!p.deleted) {
        list.push({
          id: p.id,
          owner: {
            id: p.owner.id,
            nick: p.owner.nick
          },
          title: p.title,
          slug: p.slug,
          code: p.code,
          description: p.description,
          tags: p.tags,
          flags: p.flags,
          poster: (p.files != null) && (p.files["sprites/poster.png"] != null),
          platforms: p.platforms,
          controls: p.controls,
          type: p.type,
          orientation: p.orientation,
          aspect: p.aspect,
          graphics: p.graphics,
          language: p.language,
          libs: p.libs,
          libraries: p.libraries,
          properties: p.properties,
          date_created: p.date_created,
          last_modified: p.last_modified,
          "public": p["public"],
          unlisted: p.unlisted,
          size: p.getSize(),
          local_folder: p.local_folder
        });
      }
    }
    return this.send({
      name: "project_list",
      list: list,
      request_id: data != null ? data.request_id : void 0
    });
  };

  Session.prototype.lockProjectFile = function(data) {
    var project;
    if (this.user == null) {
      return this.sendError("not connected");
    }
    if (data.project != null) {
      project = this.content.projects[data.project];
    }
    if (project != null) {
      this.setCurrentProject(project);
      return project.manager.lockFile(this, data.file);
    }
  };

  Session.prototype.writeProjectFile = function(data) {
    var project;
    if (this.user == null) {
      return this.sendError("not connected");
    }
    if (data.project != null) {
      project = this.content.projects[data.project];
    }
    if (project != null) {
      this.setCurrentProject(project);
      return project.manager.writeProjectFile(this, data);
    }
  };

  Session.prototype.renameProjectFile = function(data) {
    var project;
    if (this.user == null) {
      return this.sendError("not connected");
    }
    if (data.project != null) {
      project = this.content.projects[data.project];
    }
    if (project != null) {
      this.setCurrentProject(project);
      return project.manager.renameProjectFile(this, data);
    }
  };

  Session.prototype.deleteProjectFile = function(data) {
    var project;
    if (this.user == null) {
      return this.sendError("not connected");
    }
    if (data.project != null) {
      project = this.content.projects[data.project];
    }
    if (project != null) {
      this.setCurrentProject(project);
      return project.manager.deleteProjectFile(this, data);
    }
  };

  Session.prototype.readProjectFile = function(data) {
    var project;
    if (this.user == null) {
      return this.sendError("not connected");
    }
    if (data.project != null) {
      project = this.content.projects[data.project];
    }
    if (project != null) {
      this.setCurrentProject(project);
      return project.manager.readProjectFile(this, data);
    }
  };

  Session.prototype.listProjectFiles = function(data) {
    var project;
    if (this.user == null) {
      return this.sendError("not connected");
    }
    if (data.project != null) {
      project = this.content.projects[data.project];
    }
    if (project != null) {
      this.setCurrentProject(project);
      return project.manager.listProjectFiles(this, data);
    }
  };

  Session.prototype.listPublicProjectFiles = function(data) {
    var manager, project;
    if (data.project != null) {
      project = this.content.projects[data.project];
    }
    if (project != null) {
      manager = this.getProjectManager(project);
      return manager.listProjectFiles(this, data);
    }
  };

  Session.prototype.readPublicProjectFile = function(data) {
    var manager, project;
    if (data.project != null) {
      project = this.content.projects[data.project];
    }
    if ((project != null) && project["public"]) {
      manager = this.getProjectManager(project);
      return project.manager.readProjectFile(this, data);
    }
  };

  Session.prototype.listenToProject = function(data) {
    var project, user;
    user = data.user;
    project = data.project;
    if ((user != null) && (project != null)) {
      user = this.content.findUserByNick(user);
      if (user != null) {
        project = user.findProjectBySlug(project);
        if (project != null) {
          if ((this.project != null) && (this.project.manager != null)) {
            this.project.manager.removeListener(this);
          }
          this.project = project;
          if (this.project.manager == null) {
            new ProjectManager(this.project);
          }
          return this.project.manager.addListener(this);
        }
      }
    }
  };

  Session.prototype.getFileVersions = function(data) {
    var project, user;
    user = data.user;
    project = data.project;
    if ((user != null) && (project != null)) {
      user = this.content.findUserByNick(user);
      if (user != null) {
        project = user.findProjectBySlug(project);
        if (project != null) {
          if (project.manager == null) {
            new ProjectManager(project);
          }
          return project.manager.getFileVersions((function(_this) {
            return function(res) {
              return _this.send({
                name: "project_file_versions",
                data: res,
                request_id: data.request_id
              });
            };
          })(this));
        }
      }
    }
  };

  Session.prototype.showError = function(text) {
    return this.send({
      name: "show_error",
      error: text
    });
  };

  Session.prototype.timeCheck = function() {
    if (Date.now() > this.last_active + 5 * 60000) {
      this.socket.close();
      this.server.sessionClosed(this);
      this.socket.terminate();
    }
    if ((this.upload_request_activity != null) && Date.now() > this.upload_request_activity + 60000) {
      this.upload_request_id = -1;
      return this.upload_request_buffers = [];
    }
  };

  Session.prototype.backupComplete = function(msg) {
    if (msg.key === this.server.config["backup-key"]) {
      this.server.sessionClosed(this);
      return this.server.last_backup_time = Date.now();
    }
  };

  Session.prototype.uploadRequest = function(msg) {
    if (this.user == null) {
      return;
    }
    if (msg.size == null) {
      return this.sendError("Bad request");
    }
    if (msg.request_id == null) {
      return this.sendError("Bad request");
    }
    if (msg.request == null) {
      return this.sendError("Bad request");
    }
    if (msg.size > 100000000) {
      return this.sendError("File size limit exceeded");
    }
    this.upload_request_id = msg.request_id;
    this.upload_request_size = msg.size;
    this.upload_uploaded = 0;
    this.upload_request_buffers = [];
    this.upload_request_request = msg.request;
    this.upload_request_activity = Date.now();
    return this.send({
      name: "upload_request",
      request_id: msg.request_id
    });
  };

  Session.prototype.bufferReceived = function(buffer) {
    var b, buf, c, count, error, i, id, len, len1, msg, ref;
    if (buffer.byteLength >= 4) {
      id = buffer.readInt32LE(0);
      if (id === this.upload_request_id) {
        len = buffer.byteLength - 4;
        if (len > 0 && this.upload_uploaded < this.upload_request_size) {
          buf = Buffer.alloc(len);
          buffer.copy(buf, 0, 4, buffer.byteLength);
          this.upload_request_buffers.push(buf);
          this.upload_uploaded += len;
          this.upload_request_activity = Date.now();
        }
        if (this.upload_uploaded >= this.upload_request_size) {
          msg = this.upload_request_request;
          buf = Buffer.alloc(this.upload_request_size);
          count = 0;
          ref = this.upload_request_buffers;
          for (i = 0, len1 = ref.length; i < len1; i++) {
            b = ref[i];
            b.copy(buf, count, 0, b.byteLength);
            count += b.byteLength;
          }
          msg.data = buf;
          msg.request_id = id;
          try {
            if (msg.name != null) {
              c = this.commands[msg.name];
              if (c != null) {
                return c(msg);
              }
            }
          } catch (error1) {
            error = error1;
            return console.error(error);
          }
        } else {
          return this.send({
            name: "next_chunk",
            request_id: id
          });
        }
      }
    }
  };

  return Session;

})();

module.exports = this.Session;
