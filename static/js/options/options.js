this.Options = (function() {
  function Options(app) {
    var advanced, fn, input, j, len, list;
    this.app = app;
    this.textInput("projectoption-name", (function(_this) {
      return function(value) {
        return _this.optionChanged("title", value);
      };
    })(this));
    this.project_slug_validator = new InputValidator(document.getElementById("projectoption-slug"), document.getElementById("project-slug-button"), null, (function(_this) {
      return function(value) {
        return _this.optionChanged("slug", value[0]);
      };
    })(this));
    this.project_code_validator = new InputValidator(document.getElementById("projectoption-code"), document.getElementById("project-code-button"), null, (function(_this) {
      return function(value) {
        return _this.optionChanged("code", value[0]);
      };
    })(this));
    this.selectInput("projectoption-orientation", (function(_this) {
      return function(value) {
        return _this.orientationChanged(value);
      };
    })(this));
    this.selectInput("projectoption-aspect", (function(_this) {
      return function(value) {
        return _this.aspectChanged(value);
      };
    })(this));
    this.selectInput("projectoption-type", (function(_this) {
      return function(value) {
        return _this.typeChanged(value);
      };
    })(this));
    this.selectInput("projectoption-graphics", (function(_this) {
      return function(value) {
        return _this.graphicsChanged(value);
      };
    })(this));
    this.selectInput("projectoption-language", (function(_this) {
      return function(value) {
        return _this.languageChanged(value);
      };
    })(this));
    advanced = document.getElementById("advanced-project-options-button");
    advanced.addEventListener("click", (function(_this) {
      return function() {
        if (advanced.classList.contains("open")) {
          advanced.classList.remove("open");
          document.getElementById("advanced-project-options").style.display = "none";
          return advanced.childNodes[1].innerText = _this.app.translator.get("Show advanced options");
        } else {
          advanced.classList.add("open");
          document.getElementById("advanced-project-options").style.display = "block";
          return advanced.childNodes[1].innerText = _this.app.translator.get("Hide advanced options");
        }
      };
    })(this));
    list = document.querySelectorAll("#project-option-libs input");
    fn = (function(_this) {
      return function(input) {
        var id, key, option, ref, value, version_e;
        id = input.id.split("-");
        id = id[id.length - 1];
        if (ms_optional_libs[id] != null) {
          version_e = document.getElementById("project-option-lib-" + id + "-version");
          if (ms_optional_libs[id].versions != null) {
            ref = ms_optional_libs[id].versions;
            for (key in ref) {
              value = ref[key];
              option = document.createElement("option");
              option.value = key;
              option.innerText = value.name;
              version_e.appendChild(option);
            }
            _this.selectInput(version_e.id, function(value) {
              _this.addLib(value);
              return _this.libsChanged();
            });
          } else {
            version_e.style.display = "none";
          }
        }
        return input.addEventListener("change", function() {
          if (input.checked) {
            _this.addLib(id);
            return _this.libsChanged();
          } else {
            _this.removeLib(id);
            return _this.libsChanged();
          }
        });
      };
    })(this);
    for (j = 0, len = list.length; j < len; j++) {
      input = list[j];
      fn(input);
    }
    this.library_tip = document.querySelector("#project-option-type .library");
    this.app.appui.setAction("project-local-folder-link", (function(_this) {
      return function() {
        return _this.linkLocalFolder();
      };
    })(this));
    this.app.appui.setAction("project-local-folder-unlink", (function(_this) {
      return function() {
        return _this.unlinkLocalFolder();
      };
    })(this));
    this.app.appui.setAction("project-export-html", (function(_this) {
      return function() {
        var path, project;
        project = _this.app.project;
        path = "/" + project.owner.nick + "/" + project.slug + "/" + project.code + "/publish/html/?v=" + (Date.now());
        return window.location = path;
      };
    })(this));
    document.getElementById("project-local-folder-input").addEventListener("keyup", (function(_this) {
      return function(event) {
        if (event.keyCode === 13) {
          return _this.linkLocalFolder();
        }
      };
    })(this));
  }

  Options.prototype.textInput = function(element, action) {
    var e;
    e = document.getElementById(element);
    return e.addEventListener("input", (function(_this) {
      return function(event) {
        return action(e.value);
      };
    })(this));
  };

  Options.prototype.selectInput = function(element, action) {
    var e;
    e = document.getElementById(element);
    return e.addEventListener("change", (function(_this) {
      return function(event) {
        return action(e.options[e.selectedIndex].value);
      };
    })(this));
  };

  Options.prototype.checkInput = function(element, action) {
    var e;
    e = document.getElementById(element);
    return e.addEventListener("change", (function(_this) {
      return function(event) {
        return action(e.checked);
      };
    })(this));
  };

  Options.prototype.projectOpened = function() {
    document.getElementById("projectoptions-icon").src = this.app.project.getFullURL() + "icon.png";
    document.getElementById("projectoption-name").value = this.app.project.title;
    this.project_slug_validator.set(this.app.project.slug);
    document.getElementById("projectoption-slugprefix").innerText = location.origin + ("/" + this.app.project.owner.nick + "/");
    document.getElementById("projectoption-orientation").value = this.app.project.orientation;
    document.getElementById("projectoption-aspect").value = this.app.project.aspect;
    document.getElementById("projectoption-type").value = this.app.project.type || "app";
    document.getElementById("projectoption-graphics").value = "M1";
    document.getElementById("projectoption-language").value = "microscript_v2";
    this.library_tip.style.display = this.app.project.type === "library" ? "block" : "none";
    this.updateOptionalLibs();
    this.updateSecretCodeLine();
    this.updateLocalFolderUI();
    return this.app.project.addListener(this);
  };

  Options.prototype.updateOptionalLibs = function() {
    var checked, e, id, input, j, k, key, len, len1, lib, list, optlib, ref, results, v, value, version;
    list = document.querySelectorAll("#project-option-libs input");
    results = [];
    for (j = 0, len = list.length; j < len; j++) {
      input = list[j];
      input.checked = false;
      id = input.id;
      id = id.split("-");
      id = id[id.length - 1];
      e = document.getElementById("project-option-lib-" + id);
      v = document.getElementById("project-option-lib-" + id + "-version");
      checked = false;
      version = null;
      optlib = null;
      ref = this.app.project.libs;
      for (k = 0, len1 = ref.length; k < len1; k++) {
        lib = ref[k];
        if (lib.startsWith(id)) {
          checked = true;
          version = lib;
          optlib = ms_optional_libs[id];
        }
      }
      e.checked = checked;
      if (checked && (optlib.versions != null)) {
        v.style.display = "inline-block";
        if (optlib.versions[version] != null) {
          results.push(v.value = version);
        } else {
          results.push((function() {
            var ref1, results1;
            ref1 = optlib.versions;
            results1 = [];
            for (key in ref1) {
              value = ref1[key];
              if (value.original) {
                results1.push(v.value = key);
              } else {
                results1.push(void 0);
              }
            }
            return results1;
          })());
        }
      } else {
        results.push(v.style.display = "none");
      }
    }
    return results;
  };

  Options.prototype.updateSecretCodeLine = function() {
    this.project_code_validator.set(this.app.project.code);
    return document.getElementById("projectoption-codeprefix").innerText = location.origin + ("/" + this.app.project.owner.nick + "/" + this.app.project.slug + "/");
  };

  Options.prototype.updateLocalFolderUI = function() {
    var linked, unlinked;
    linked = document.getElementById("project-local-folder-linked");
    unlinked = document.getElementById("project-local-folder-unlinked");
    document.getElementById("project-local-folder-error").innerText = "";
    if (this.app.project.local_folder) {
      linked.style.display = "block";
      unlinked.style.display = "none";
      return document.getElementById("project-local-folder-path").innerText = this.app.project.local_folder;
    } else {
      linked.style.display = "none";
      unlinked.style.display = "block";
      return document.getElementById("project-local-folder-input").value = "";
    }
  };

  Options.prototype.linkLocalFolder = function() {
    var folder;
    folder = document.getElementById("project-local-folder-input").value.trim();
    if (folder.length === 0) {
      return;
    }
    return this.app.client.sendRequest({
      name: "set_project_local_folder",
      project: this.app.project.id,
      folder: folder
    }, (function(_this) {
      return function(msg) {
        if (msg.name === "error") {
          return document.getElementById("project-local-folder-error").innerText = msg.error;
        } else {
          _this.app.project.local_folder = msg.folder;
          _this.updateLocalFolderUI();
          return _this.app.git_panel.updatePanelVisibility();
        }
      };
    })(this));
  };

  Options.prototype.unlinkLocalFolder = function() {
    return this.app.client.sendRequest({
      name: "unlink_project_local_folder",
      project: this.app.project.id
    }, (function(_this) {
      return function(msg) {
        if (msg.name === "error") {
          return document.getElementById("project-local-folder-error").innerText = msg.error;
        } else {
          _this.app.project.local_folder = null;
          _this.updateLocalFolderUI();
          return _this.app.git_panel.updatePanelVisibility();
        }
      };
    })(this));
  };

  Options.prototype.projectUpdate = function(name) {
    var icon;
    if (name === "spritelist") {
      icon = this.app.project.getSprite("icon");
      if (icon != null) {
        return icon.addImage(document.getElementById("projectoptions-icon"), 160);
      }
    }
  };

  Options.prototype.update = function() {
    var storage;
    storage = this.app.appui.displayByteSize(this.app.project.getSize());
    return document.getElementById("projectoption-storage-used").innerText = storage;
  };

  Options.prototype.optionChanged = function(name, value) {
    if ((value.trim != null) && value.trim().length === 0) {
      return;
    }
    switch (name) {
      case "title":
        this.app.project.setTitle(value);
        break;
      case "slug":
        if (value !== RegexLib.slugify(value)) {
          value = RegexLib.slugify(value);
          this.project_slug_validator.set(value);
        }
        if (value.length === 0 || value === this.app.project.slug) {
          return;
        }
        this.app.project.setSlug(value);
        this.updateSecretCodeLine();
        break;
      case "code":
        this.app.project.setCode(value);
    }
    return this.app.client.sendRequest({
      name: "set_project_option",
      project: this.app.project.id,
      option: name,
      value: value
    }, (function(_this) {
      return function(msg) {
        if (msg.name === "error" && (msg.value != null)) {
          switch (name) {
            case "title":
              document.getElementById("projectoption-name").value = msg.value;
              return _this.app.project.setTitle(msg.value);
            case "slug":
              _this.project_slug_validator.set(msg.value);
              _this.app.project.setSlug(msg.value);
              return _this.updateSecretCodeLine();
          }
        }
      };
    })(this));
  };

  Options.prototype.orientationChanged = function(value) {
    this.app.project.setOrientation(value);
    return this.app.client.sendRequest({
      name: "set_project_option",
      project: this.app.project.id,
      option: "orientation",
      value: value
    }, (function(_this) {
      return function(msg) {};
    })(this));
  };

  Options.prototype.aspectChanged = function(value) {
    this.app.project.setAspect(value);
    return this.app.client.sendRequest({
      name: "set_project_option",
      project: this.app.project.id,
      option: "aspect",
      value: value
    }, (function(_this) {
      return function(msg) {};
    })(this));
  };

  Options.prototype.typeChanged = function(value) {
    this.app.project.setType(value);
    this.library_tip.style.display = value === "library" ? "block" : "none";
    this.app.client.sendRequest({
      name: "set_project_option",
      project: this.app.project.id,
      option: "type",
      value: value
    }, (function(_this) {
      return function(msg) {};
    })(this));
    return this.app.lib_manager.resetLibs();
  };

  Options.prototype.graphicsChanged = function(value) {
    this.app.project.setGraphics("M1");
    this.app.debug.updateDebuggerVisibility();
    return this.app.client.sendRequest({
      name: "set_project_option",
      project: this.app.project.id,
      option: "graphics",
      value: "M1"
    }, (function(_this) {
      return function(msg) {};
    })(this));
  };

  Options.prototype.fixLib = function(lib) {
    var key, ref, value;
    if ((ms_optional_libs[lib] != null) && ms_optional_libs[lib].versions) {
      ref = ms_optional_libs[lib].versions;
      for (key in ref) {
        value = ref[key];
        if (value["default"]) {
          return key;
        }
      }
    }
    return lib;
  };

  Options.prototype.addLib = function(lib) {
    this.removeLib(lib);
    return this.app.project.libs.push(this.fixLib(lib));
  };

  Options.prototype.removeLib = function(lib) {
    var i, id, j, l, ref, results;
    id = lib.split("_")[0];
    results = [];
    for (i = j = ref = this.app.project.libs.length - 1; j >= 0; i = j += -1) {
      l = this.app.project.libs[i];
      if (l.split("_")[0] === id) {
        results.push(this.app.project.libs.splice(i, 1));
      } else {
        results.push(void 0);
      }
    }
    return results;
  };

  Options.prototype.libsChanged = function() {
    this.optionChanged("libs", this.app.project.libs);
    return this.updateOptionalLibs();
  };

  Options.prototype.languageChanged = function(value) {
    return this.setLanguage("microscript_v2");
  };

  Options.prototype.setLanguage = function(value) {
    this.app.project.setLanguage(value);
    this.app.editor.updateLanguage();
    this.app.debug.updateDebuggerVisibility();
    return this.app.client.sendRequest({
      name: "set_project_option",
      project: this.app.project.id,
      option: "language",
      value: value
    }, (function(_this) {
      return function(msg) {};
    })(this));
  };

  Options.prototype.setType = function(type) {
    if (type !== this.app.project.type) {
      console.info("setting type to " + type);
      this.app.project.setType(type);
      return this.app.client.sendRequest({
        name: "set_project_option",
        project: this.app.project.id,
        option: "type",
        value: type
      }, (function(_this) {
        return function(msg) {};
      })(this));
    }
  };

  return Options;

})();
