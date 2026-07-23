class @Publish
  constructor:(@app)->

  loadProject:(project)->
    button = document.querySelector("#html-export .publish-button")
    button.onclick = ()=>
      location = "/#{project.owner.nick}/#{project.slug}/"
      location += project.code+"/" if not project.public
      window.location = location+"publish/html/?v="+Date.now()
