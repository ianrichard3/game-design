var App, app;

app = null;

window.addEventListener("load", function() {
  return app = new App();
});

App = (function() {
  function App() {
    this.languages = {
      microscript2: LANGUAGE_MICROSCRIPT2
    };
    this.translator = new Translator(this);
    this.app_state = new AppState(this);
    this.appui = new AppUI(this);
    this.client = new Client(this);
    this.about = new About(this);
    this.documentation = new Documentation(this);
    this.editor = new Editor(this);
    this.doc_editor = new DocEditor(this);
    this.sprite_editor = new SpriteEditor(this);
    this.map_editor = new MapEditor(this);
    this.assets_manager = new AssetsManager(this);
    this.sound_editor = new SoundEditor(this);
    this.music_editor = new MusicEditor(this);
    this.runwindow = new RunWindow(this);
    this.debug = new Debug(this);
    this.options = new Options(this);
    this.lib_manager = new LibManager(this);
    this.git_panel = new GitPanel(this);
    this.connected = false;
    this.client.start();
  }

  App.prototype.createProject = function(title, slug, options, callback) {
    if ((options != null) && typeof options === "function" && (callback == null)) {
      callback = options;
      options = {
        language: "microscript_v2"
      };
    }
    return this.client.sendRequest({
      name: "create_project",
      title: title,
      slug: slug,
      type: options.type,
      graphics: options.graphics,
      language: options.language,
      libs: options.libs
    }, (function(_this) {
      return function(msg) {
        switch (msg.name) {
          case "error":
            console.error(msg.error);
            if (msg.error != null) {
              alert(_this.translator.get(msg.error));
            }
            break;
          case "project_created":
            _this.getProjectList(function(list) {
              var i, len, p, results;
              _this.projects = list;
              _this.appui.updateProjects();
              results = [];
              for (i = 0, len = list.length; i < len; i++) {
                p = list[i];
                if (p.id === msg.id) {
                  _this.openProject(p);
                  if (callback != null) {
                    results.push(callback());
                  } else {
                    results.push(void 0);
                  }
                } else {
                  results.push(void 0);
                }
              }
              return results;
            });
        }
      };
    })(this));
  };

  App.prototype.importProject = function(file) {
    var reader;
    if (this.importing) {
      return;
    }
    console.info("importing " + file.name);
    reader = new FileReader();
    reader.addEventListener("load", (function(_this) {
      return function() {
        if (!file.name.toLowerCase().endsWith(".zip")) {
          return;
        }
        _this.importing = true;
        return _this.client.sendUpload({
          name: "import_project"
        }, reader.result, (function(msg) {
          console.log("[ZIP] " + msg.name);
          switch (msg.name) {
            case "error":
              _this.appui.showNotification(_this.translator.get(msg.error));
              _this.appui.resetImportButton();
              return _this.importing = false;
            case "project_imported":
              _this.updateProjectList(msg.id);
              _this.appui.showNotification(_this.translator.get("Project imported successfully"));
              _this.appui.resetImportButton();
              _this.importing = false;
              return _this.lib_manager.resetLibs();
          }
        }), function(progress) {
          return _this.appui.setImportProgress(progress);
        });
      };
    })(this));
    return reader.readAsArrayBuffer(file);
  };

  App.prototype.updateProjectList = function(open_when_fetched) {
    return this.getProjectList((function(_this) {
      return function(list) {
        var i, len, p, ref, results;
        _this.projects = list;
        _this.appui.updateProjects();
        if (open_when_fetched != null) {
          ref = _this.projects;
          results = [];
          for (i = 0, len = ref.length; i < len; i++) {
            p = ref[i];
            if (p.id === open_when_fetched) {
              _this.openProject(p);
              break;
            } else {
              results.push(void 0);
            }
          }
          return results;
        }
      };
    })(this));
  };

  App.prototype.getProjectList = function(callback) {
    return this.client.sendRequest({
      name: "get_project_list"
    }, (function(_this) {
      return function(msg) {
        if (callback != null) {
          return callback(msg.list);
        }
      };
    })(this));
  };

  App.prototype.openProject = function(project, useraction) {
    if (useraction == null) {
      useraction = true;
    }
    this.project = new Project(this, project);
    this.appui.setProject(this.project, useraction);
    this.editor.setCode("");
    this.editor.projectOpened();
    this.sprite_editor.projectOpened();
    this.map_editor.projectOpened();
    this.sound_editor.projectOpened();
    this.music_editor.projectOpened();
    this.assets_manager.projectOpened();
    this.runwindow.projectOpened();
    this.debug.projectOpened();
    this.options.projectOpened();
    this.lib_manager.projectOpened();
    this.git_panel.projectOpened();
    return this.project.load();
  };

  App.prototype.deleteProject = function(project) {
    return this.client.sendRequest({
      name: "delete_project",
      project: project.id
    }, (function(_this) {
      return function(msg) {
        return _this.updateProjectList();
      };
    })(this));
  };

  App.prototype.projectTitleExists = function(title) {
    var i, len, p, ref;
    if (!this.projects) {
      return false;
    }
    ref = this.projects;
    for (i = 0, len = ref.length; i < len; i++) {
      p = ref[i];
      if (p.title === title) {
        return true;
      }
    }
    return false;
  };

  App.prototype.cloneProject = function(project) {
    var count, title;
    title = project.title + (" (" + (this.translator.get("copy")) + ")");
    count = 1;
    while (this.projectTitleExists(title)) {
      count += 1;
      title = project.title + (" (" + (this.translator.get("copy")) + " " + count + ")");
    }
    return this.client.sendRequest({
      name: "clone_project",
      project: project.id,
      title: title
    }, (function(_this) {
      return function(msg) {
        _this.appui.setMainSection("projects");
        _this.appui.backToProjectList();
        _this.updateProjectList();
        return _this.appui.showNotification(_this.translator.get("Project cloned! Here is your copy."));
      };
    })(this));
  };

  App.prototype.writeProjectFile = function(project_id, file, content, callback) {
    return this.client.sendRequest({
      name: "write_project_file",
      project: project_id,
      file: file,
      content: content
    }, (function(_this) {
      return function(msg) {};
    })(this));
  };

  App.prototype.readProjectFile = function(project_id, file, callback) {
    return this.client.sendRequest({
      name: "read_project_file",
      project: project_id,
      file: file
    }, (function(_this) {
      return function(msg) {
        return callback(msg.content);
      };
    })(this));
  };

  App.prototype.userConnected = function(nick) {
    this.appui.userConnected(nick);
    return this.updateProjectList();
  };

  App.prototype.serverMessage = function(msg) {
    switch (msg.name) {
      case "project_list":
        this.projects = msg.list;
        return this.appui.updateProjects();
      case "project_file_locked":
        if ((this.project != null) && msg.project === this.project.id) {
          return this.project.fileLocked(msg);
        }
        break;
      case "project_file_update":
        if ((this.project != null) && msg.project === this.project.id) {
          return this.project.fileUpdated(msg);
        }
        break;
      case "project_file_deleted":
        if ((this.project != null) && msg.project === this.project.id) {
          return this.project.fileDeleted(msg);
        }
        break;
      case "project_options_updated":
        if ((this.project != null) && msg.project === this.project.id) {
          this.project.optionsUpdated(msg);
          this.options.projectOpened();
          return this.lib_manager.projectOpened();
        }
        break;
      case "show_error":
        return this.appui.showNotification(this.translator.get(msg.error));
    }
  };

  App.prototype.getUserSetting = function(setting) {
    if ((this.user != null) && (this.user.settings != null)) {
      return this.user.settings[setting];
    } else {
      return null;
    }
  };

  App.prototype.setHomeState = function() {
    return history.replaceState(null, "microStudio", "/");
  };

  App.prototype.setState = function(state) {};

  return App;

})();

if (navigator.serviceWorker != null) {
  navigator.serviceWorker.register("/app_sw.js", {
    scope: location.pathname
  }).then(function(reg) {
    return console.log('Registration succeeded. Scope is' + reg.scope);
  })["catch"](function(error) {
    return console.log('Registration failed with' + error);
  });
}
