class @Options
  constructor:(@app)->
    @textInput "projectoption-name",(value)=>@optionChanged("title",value)

    @project_slug_validator = new InputValidator document.getElementById("projectoption-slug"),
      document.getElementById("project-slug-button"),
      null,
      (value)=>
        @optionChanged("slug",value[0])

    @project_code_validator = new InputValidator document.getElementById("projectoption-code"),
      document.getElementById("project-code-button"),
      null,
      (value)=>
        @optionChanged("code",value[0])

    @selectInput "projectoption-orientation",(value)=>@orientationChanged(value)
    @selectInput "projectoption-aspect",(value)=>@aspectChanged(value)
    @selectInput "projectoption-type",(value)=>@typeChanged(value)
    @selectInput "projectoption-graphics",(value)=>@graphicsChanged(value)
    @selectInput "projectoption-language",(value)=>@languageChanged(value)

    advanced = document.getElementById("advanced-project-options-button")
    advanced.addEventListener "click",()=>
      if advanced.classList.contains "open"
        advanced.classList.remove "open"
        document.getElementById("advanced-project-options").style.display = "none"
        advanced.childNodes[1].innerText = @app.translator.get "Show advanced options"
      else
        advanced.classList.add "open"
        document.getElementById("advanced-project-options").style.display = "block"
        advanced.childNodes[1].innerText = @app.translator.get "Hide advanced options"

    list = document.querySelectorAll("#project-option-libs input")
    for input in list
      do(input)=>
        id = input.id.split("-")
        id = id[id.length-1]

        if ms_optional_libs[id]?
          version_e = document.getElementById("project-option-lib-#{id}-version")
          if ms_optional_libs[id].versions?
            for key,value of ms_optional_libs[id].versions
              option = document.createElement("option")
              option.value = key
              option.innerText = value.name
              version_e.appendChild(option)

            @selectInput version_e.id,(value)=>
              @addLib(value)
              @libsChanged()
          else
            version_e.style.display = "none"
            
        input.addEventListener "change",()=>
          if input.checked
            @addLib id
            @libsChanged()
          else
            @removeLib id
            @libsChanged()

    @library_tip = document.querySelector "#project-option-type .library"

    @app.appui.setAction "project-local-folder-link",()=>
      @linkLocalFolder()

    @app.appui.setAction "project-local-folder-unlink",()=>
      @unlinkLocalFolder()

    @app.appui.setAction "project-export-html",()=>
      project = @app.project
      path = "/#{project.owner.nick}/#{project.slug}/#{project.code}/publish/html/?v=#{Date.now()}"
      window.location = path

    document.getElementById("project-local-folder-input").addEventListener "keyup",(event)=>
      @linkLocalFolder() if event.keyCode == 13

  textInput:(element,action)->
    e = document.getElementById(element)
    e.addEventListener "input",(event)=>action(e.value)

  selectInput:(element,action)->
    e = document.getElementById(element)
    e.addEventListener "change",(event)=>action(e.options[e.selectedIndex].value)

  checkInput:(element,action)->
    e = document.getElementById(element)
    e.addEventListener "change",(event)=>action(e.checked)

  projectOpened:()->
    document.getElementById("projectoptions-icon").src = @app.project.getFullURL()+"icon.png"
    #document.getElementById("projectoptions-icon").setAttribute("src","#{@app.project.getFullURL()}icon.png")
    document.getElementById("projectoption-name").value = @app.project.title
    @project_slug_validator.set @app.project.slug

    document.getElementById("projectoption-slugprefix").innerText = location.origin+"/#{@app.project.owner.nick}/"
    document.getElementById("projectoption-orientation").value = @app.project.orientation
    document.getElementById("projectoption-aspect").value = @app.project.aspect
    document.getElementById("projectoption-type").value = @app.project.type or "app"
    document.getElementById("projectoption-graphics").value = "M1"
    document.getElementById("projectoption-language").value = "microscript_v2"

    @library_tip.style.display = if @app.project.type == "library" then "block" else "none"

    @updateOptionalLibs()

    @updateSecretCodeLine()
    @updateLocalFolderUI()
    @app.project.addListener @
  updateOptionalLibs:()->
    list = document.querySelectorAll("#project-option-libs input")
    for input in list
      input.checked = false
      id = input.id
      id = id.split("-")
      id = id[id.length-1]

      e = document.getElementById "project-option-lib-#{id}"
      v = document.getElementById "project-option-lib-#{id}-version"

      checked = false
      version = null
      optlib = null
      for lib in @app.project.libs
        if lib.startsWith(id)
          checked = true
          version = lib
          optlib = ms_optional_libs[id]
      
      e.checked = checked

      if checked and optlib.versions?
        v.style.display = "inline-block"
        if optlib.versions[version]?
          v.value = version
        else
          for key,value of optlib.versions
            if value.original
              v.value = key
      else
        v.style.display = "none"
          

  updateSecretCodeLine:()->
    @project_code_validator.set @app.project.code
    document.getElementById("projectoption-codeprefix").innerText = location.origin+"/#{@app.project.owner.nick}/#{@app.project.slug}/"

  updateLocalFolderUI:()->
    linked = document.getElementById("project-local-folder-linked")
    unlinked = document.getElementById("project-local-folder-unlinked")
    document.getElementById("project-local-folder-error").innerText = ""

    if @app.project.local_folder
      linked.style.display = "block"
      unlinked.style.display = "none"
      document.getElementById("project-local-folder-path").innerText = @app.project.local_folder
    else
      linked.style.display = "none"
      unlinked.style.display = "block"
      document.getElementById("project-local-folder-input").value = ""

  linkLocalFolder:()->
    folder = document.getElementById("project-local-folder-input").value.trim()
    return if folder.length == 0

    @app.client.sendRequest {
      name: "set_project_local_folder"
      project: @app.project.id
      folder: folder
    },(msg)=>
      if msg.name == "error"
        document.getElementById("project-local-folder-error").innerText = msg.error
      else
        @app.project.local_folder = msg.folder
        @updateLocalFolderUI()
        @app.git_panel.updatePanelVisibility()

  unlinkLocalFolder:()->
    @app.client.sendRequest {
      name: "unlink_project_local_folder"
      project: @app.project.id
    },(msg)=>
      if msg.name == "error"
        document.getElementById("project-local-folder-error").innerText = msg.error
      else
        @app.project.local_folder = null
        @updateLocalFolderUI()
        @app.git_panel.updatePanelVisibility()

  projectUpdate:(name)->
    if name == "spritelist"
      icon = @app.project.getSprite("icon")
      if icon?
        icon.addImage document.getElementById("projectoptions-icon"),160

  update:()->
    storage = @app.appui.displayByteSize @app.project.getSize()
    document.getElementById("projectoption-storage-used").innerText = storage

  optionChanged:(name,value)->
    return if value.trim? and value.trim().length == 0
    switch name
      when "title"
        @app.project.setTitle value
      when "slug"
        if value != RegexLib.slugify value
          value = RegexLib.slugify value
          @project_slug_validator.set value

        return if value.length == 0 or value == @app.project.slug
        @app.project.setSlug value
        @updateSecretCodeLine()

      when "code"
        @app.project.setCode value

    @app.client.sendRequest {
      name: "set_project_option"
      project: @app.project.id
      option: name
      value: value
    },(msg)=>
      if msg.name == "error" and msg.value?
        switch name
          when "title"
            document.getElementById("projectoption-name").value = msg.value
            @app.project.setTitle msg.value
          when "slug"
            @project_slug_validator.set msg.value
            @app.project.setSlug msg.value
            @updateSecretCodeLine()

  orientationChanged:(value)->
    @app.project.setOrientation(value)
    @app.client.sendRequest {
      name: "set_project_option"
      project: @app.project.id
      option: "orientation"
      value: value
    },(msg)=>

  aspectChanged:(value)->
    @app.project.setAspect(value)
    @app.client.sendRequest {
      name: "set_project_option"
      project: @app.project.id
      option: "aspect"
      value: value
    },(msg)=>

  typeChanged:(value)->
    @app.project.setType(value)
    @library_tip.style.display = if value == "library" then "block" else "none"
    @app.client.sendRequest {
      name: "set_project_option"
      project: @app.project.id
      option: "type"
      value: value
    },(msg)=>

    @app.lib_manager.resetLibs()

  graphicsChanged:(value)->
    @app.project.setGraphics("M1")
    @app.debug.updateDebuggerVisibility()
    @app.client.sendRequest {
      name: "set_project_option"
      project: @app.project.id
      option: "graphics"
      value: "M1"
    },(msg)=>

  fixLib:(lib)->
    if ms_optional_libs[lib]? and ms_optional_libs[lib].versions
      for key,value of ms_optional_libs[lib].versions
        if value.default
          return key

    return lib

  addLib:(lib)->
    @removeLib(lib)
    @app.project.libs.push @fixLib(lib)
  
  removeLib:(lib)->
    id = lib.split("_")[0]
    for i in [@app.project.libs.length-1..0] by -1
      l = @app.project.libs[i]
      if l.split("_")[0] == id
        @app.project.libs.splice(i,1)
    
  libsChanged:()->
    @optionChanged("libs",@app.project.libs)
    @updateOptionalLibs()

  languageChanged:(value)->
    @setLanguage("microscript_v2")

  setLanguage:(value)->
    @app.project.setLanguage(value)
    @app.editor.updateLanguage()
    @app.debug.updateDebuggerVisibility()
    @app.client.sendRequest {
      name: "set_project_option"
      project: @app.project.id
      option: "language"
      value: value
    },(msg)=>

  setType:(type)->
    if type != @app.project.type
      console.info("setting type to #{type}")
      @app.project.setType(type)
      @app.client.sendRequest {
        name: "set_project_option"
        project: @app.project.id
        option: "type"
        value: type
      },(msg)=>
