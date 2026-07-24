this.Translator = (function() {
  function Translator(app) {
    this.app = app;
    this.lang = "en";
  }

  Translator.prototype.get = function(text) {
    return text;
  };

  return Translator;

})();
