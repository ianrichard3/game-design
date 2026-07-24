class @Translator
  constructor:(@content)->

  get:(language,text)-> text

  getTranslator:()->
    get:(text)-> text

module.exports = @Translator
