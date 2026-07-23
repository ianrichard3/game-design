this.Publish = (function() {
  function Publish(app) {
    this.app = app;
  }

  Publish.prototype.loadProject = function(project) {
    var button;
    button = document.querySelector("#html-export .publish-button");
    return button.onclick = (function(_this) {
      return function() {
        var location;
        location = "/" + project.owner.nick + "/" + project.slug + "/";
        if (!project["public"]) {
          location += project.code + "/";
        }
        return window.location = location + "publish/html/?v=" + Date.now();
      };
    })(this);
  };

  return Publish;

})();
