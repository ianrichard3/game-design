this.Translator = (function() {
  function Translator(content) {
    this.content = content;
  }

  Translator.prototype.get = function(language, text) {
    return text;
  };

  Translator.prototype.getTranslator = function() {
    return {
      get: function(text) {
        return text;
      }
    };
  };

  return Translator;

})();

module.exports = this.Translator;
