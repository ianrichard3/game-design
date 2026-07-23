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
        return this.app.appui.setMainSection("home");
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
      } else if (history.state.name.startsWith("user.") && (s[1] != null)) {
        switch (s[1]) {
          case "settings":
            this.app.appui.setMainSection("usersettings");
            return this.app.user_settings.setSection("settings");
          case "profile":
            this.app.appui.setMainSection("usersettings");
            return this.app.user_settings.setSection("profile");
          case "progress":
            this.app.appui.setMainSection("usersettings");
            return this.app.user_settings.setSection("progress");
        }
      }
    }
  };

  AppState.prototype.stateInitialized = function() {
    console.info("state initialized");
    return this.app.documentation.stateInitialized();
  };

  AppState.prototype.initState = function() {
    var i, len, p, path, project, ref, s, tab;
    if (location.pathname.startsWith("/login/")) {
      path = this.app.translator.lang !== "en" ? "/" + this.app.translator.lang + "/" : "/";
      history.replaceState({
        name: "home"
      }, "", path);
      this.app.appui.setMainSection("home");
      this.app.appui.showLoginPanel();
    } else {
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
      if (this.app.user != null) {
        s = location.pathname.split("/");
        if (location.pathname.startsWith("/projects/") && s[2] && s[3]) {
          project = s[2];
          tab = s[3];
          history.replaceState({
            name: "project." + s[2] + "." + s[3]
          }, "", location.pathname);
        } else if (location.pathname.startsWith("/user/") && s[2]) {
          switch (s[2]) {
            case "settings":
              this.app.appui.setMainSection("usersettings");
              this.app.user_settings.setSection("settings");
              break;
            case "profile":
              this.app.appui.setMainSection("usersettings");
              this.app.user_settings.setSection("profile");
              break;
            case "progress":
              this.app.appui.setMainSection("usersettings");
              this.app.user_settings.setSection("progress");
          }
        } else {
          this.app.appui.setMainSection("projects");
          history.replaceState({
            name: "projects"
          }, "", "/projects/");
        }
      } else {
        path = this.app.translator.lang !== "en" ? "/" + this.app.translator.lang + "/" : "/";
        history.replaceState({
          name: "home"
        }, "", path);
        this.app.appui.setMainSection("home");
      }
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
