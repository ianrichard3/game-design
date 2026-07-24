this.AppState = (function() {
  function AppState(app) {
    this.app = app;
    window.addEventListener("popstate", (function(_this) {
      return function(event) {
        return _this.popState();
      };
    })(this));
  }

  AppState.prototype.pushState = function(name, path, obj) {
    if (obj == null) {
      obj = {};
    }
    console.info("pushing state\nname=" + name + "\npath=" + path);
    if ((history.state != null) && history.state.name !== name) {
      obj.name = name;
      return history.pushState(obj, "", path);
    }
  };

  AppState.prototype.popState = function() {
    var i, len, p, project, ref, ref1, s;
    if (history.state != null) {
      s = history.state.name.split(".");
      if ((ref = history.state.name) === "documentation" || ref === "about" || ref === "projects") {
        if (history.state.name === "projects") {
          if (this.app.project && this.app.project.pending_changes.length > 0) {
            history.forward();
            alert("Please wait while saving your changes...");
          } else {
            this.app.appui.backToProjectList();
          }
        }
        return this.app.appui.setMainSection((function(p) {
          return {
            "documentation": "help"
          }[p] || p;
        })(history.state.name));
      } else if (history.state.name === "home") {
        return this.app.appui.setMainSection("projects");
      } else if (history.state.name.startsWith("project.") && (s[1] != null) && (s[2] != null)) {
        project = s[1];
        if ((this.app.project == null) || this.app.project.slug !== project) {
          if (this.app.projects) {
            ref1 = this.app.projects;
            for (i = 0, len = ref1.length; i < len; i++) {
              p = ref1[i];
              if (p.slug === project) {
                this.app.openProject(p, false);
                break;
              }
            }
          }
        }
        this.app.appui.setMainSection("projects");
        return this.app.appui.setSection(s[2]);
      } else if (history.state.name.startsWith("documentation")) {
        s = history.state.name.split(".");
        if (s[1]) {
          this.app.documentation.setSection(s[1]);
          return this.app.appui.setMainSection("help");
        } else {
          return this.app.appui.setMainSection("help");
        }
      }
    }
  };

  AppState.prototype.stateInitialized = function() {
    console.info("state initialized");
    return this.app.documentation.stateInitialized();
  };

  AppState.prototype.initState = function() {
    var i, len, p, path, ref, s;
    ref = ["about", "documentation"];
    for (i = 0, len = ref.length; i < len; i++) {
      p = ref[i];
      if (location.pathname.startsWith("/" + p + "/") || location.pathname === ("/" + p)) {
        history.replaceState({
          name: p
        }, "", location.pathname);
        if (p === "documentation") {
          path = location.pathname.split("/");
          if (path[2]) {
            this.app.documentation.setSection(path[2], null, null, false);
          }
        }
        this.app.appui.setMainSection(((function(_this) {
          return function(p) {
            return {
              "documentation": "help"
            }[p] || p;
          };
        })(this))(p));
        this.stateInitialized();
        return;
      }
    }
    s = location.pathname.split("/");
    if (location.pathname.startsWith("/projects/") && s[2] && s[3]) {
      history.replaceState({
        name: "project." + s[2] + "." + s[3]
      }, "", location.pathname);
    } else {
      this.app.appui.setMainSection("projects");
      history.replaceState({
        name: "projects"
      }, "", "/projects/");
    }
    return this.stateInitialized();
  };

  AppState.prototype.projectsFetched = function() {
    if ((history.state != null) && (history.state.name != null)) {
      if (history.state.name.startsWith("project.")) {
        return this.popState();
      }
    }
  };

  return AppState;

})();
