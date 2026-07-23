this.TabManager = (function() {
  function TabManager(app) {
    this.app = app;
    this.initProjectTabSelection();
  }

  TabManager.prototype.projectOpened = function() {
    return this.updateProjectTabs();
  };

  TabManager.prototype.projectClosed = function() {};

  TabManager.prototype.tabOpened = function() {
    return this.updateProjectTabSelection();
  };

  TabManager.prototype.isTabActive = function(tab) {
    var project, tabs;
    project = this.app.project;
    if (!project) {
      return false;
    }
    tabs = project.tabs || {};
    if (tabs[tab] != null) {
      return tabs[tab];
    } else {
      return TabManager.DEFAULT_TABS[tab];
    }
  };

  TabManager.prototype.setTabActive = function(tab, active) {
    var project;
    project = this.app.project;
    if (!project) {
      return;
    }
    if (project.tabs == null) {
      project.tabs = {};
    }
    project.tabs[tab] = active;
    this.updateProjectTabs();
    return this.app.client.sendRequest({
      name: "set_project_option",
      project: project.id,
      option: "tabs",
      value: project.tabs
    }, (function(_this) {
      return function(msg) {};
    })(this));
  };

  TabManager.prototype.updateProjectTabSelection = function() {
    var element, results, tab;
    results = [];
    for (tab in TabManager.DEFAULT_TABS) {
      element = document.getElementById("project-option-active-tab-" + tab);
      if (element != null) {
        results.push(element.checked = this.isTabActive(tab));
      } else {
        results.push(void 0);
      }
    }
    return results;
  };

  TabManager.prototype.updateProjectTabs = function() {
    var element, results, tab;
    results = [];
    for (tab in TabManager.DEFAULT_TABS) {
      element = document.getElementById("menuitem-" + tab);
      results.push(element.style.display = this.isTabActive(tab) ? "block" : element != null ? "none" : void 0);
    }
    return results;
  };

  TabManager.prototype.initProjectTabSelection = function() {
    var results, tab;
    results = [];
    for (tab in TabManager.DEFAULT_TABS) {
      results.push((function(_this) {
        return function(tab) {
          var element;
          element = document.getElementById("project-option-active-tab-" + tab);
          return element.addEventListener("change", function() {
            if (element != null) {
              return _this.setTabActive(tab, element.checked);
            }
          });
        };
      })(this)(tab));
    }
    return results;
  };

  TabManager.DEFAULT_TABS = {
    code: true,
    sprites: true,
    maps: true,
    sounds: true,
    music: true,
    assets: false,
    doc: true,
    publish: true
  };

  return TabManager;

})();
