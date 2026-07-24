app = null

window.addEventListener "load",()->
  app = new App()

class App
  constructor:()->
    @languages =
      microscript2: LANGUAGE_MICROSCRIPT2

    @translator = new Translator @
    @app_state = new AppState @

    @appui = new AppUI @
    @client = new Client @

    @about = new About @

    @documentation = new Documentation @
    @editor = new Editor @
    @doc_editor = new DocEditor @
    @sprite_editor = new SpriteEditor @
    @map_editor = new MapEditor @
    @assets_manager = new AssetsManager @
    @sound_editor = new SoundEditor @
    @music_editor = new MusicEditor @
    @runwindow = new RunWindow @
    @debug = new Debug @
    @options = new Options @
    @lib_manager = new LibManager @
    @git_panel = new GitPanel @
    @connected = false
    @client.start()

  createProject:(title,slug,options,callback)->
    if options? and typeof options == "function" and not callback?
      callback = options
      options =
        language: "microscript_v2"

    @client.sendRequest {
      name: "create_project"
      title: title
      slug: slug
      type: options.type
      graphics: options.graphics
      language: options.language
      libs: options.libs
    },(msg)=>
      switch msg.name
        when "error"
          console.error msg.error
          alert @translator.get(msg.error) if msg.error?

        when "project_created"
          @getProjectList (list)=>
            @projects = list
            @appui.updateProjects()
            for p in list
              if p.id == msg.id
                @openProject p
                callback() if callback?

      return

  importProject:(file)->
    return if @importing
    console.info "importing #{file.name}"
    reader = new FileReader()
    reader.addEventListener "load",()=>
      # return if not reader.result.startsWith("data:application/x-zip-compressed;base64,")
      # mime-type returned by browser may vary ; let's just check ZIP extension
      return if not file.name.toLowerCase().endsWith(".zip")
      @importing = true

      @client.sendUpload {
        name: "import_project"
      },reader.result,((msg)=>
        console.log "[ZIP] #{msg.name}"
        switch msg.name
          when "error"
            @appui.showNotification @translator.get msg.error
            @appui.resetImportButton()
            @importing = false

          when "project_imported"
            @updateProjectList(msg.id)
            @appui.showNotification @translator.get "Project imported successfully"
            @appui.resetImportButton()
            @importing = false
            @lib_manager.resetLibs()

      ),(progress)=>
        @appui.setImportProgress(progress)

    reader.readAsArrayBuffer(file)

  updateProjectList:(open_when_fetched)->
    @getProjectList (list)=>
      @projects = list
      @appui.updateProjects()
      if open_when_fetched?
        for p in @projects
          if p.id == open_when_fetched
            @openProject p
            break

  getProjectList:(callback)->
    @client.sendRequest {
      name: "get_project_list"
    },(msg)=>
      callback(msg.list) if callback?

  openProject:(project,useraction = true)->
    @project = new Project @,project
    @appui.setProject(@project,useraction)
    @editor.setCode("")
    @editor.projectOpened()
    @sprite_editor.projectOpened()
    @map_editor.projectOpened()
    @sound_editor.projectOpened()
    @music_editor.projectOpened()
    @assets_manager.projectOpened()
    @runwindow.projectOpened()
    @debug.projectOpened()
    @options.projectOpened()
    @lib_manager.projectOpened()
    @git_panel.projectOpened()
    @project.load()

  deleteProject:(project)->
    @client.sendRequest {
      name: "delete_project"
      project: project.id
    },(msg)=>
      @updateProjectList()

  projectTitleExists:(title)->
    return false if not @projects
    for p in @projects
      return true if p.title == title
    false

  cloneProject:(project)->
    title = project.title + " (#{@translator.get("copy")})"
    count = 1
    while @projectTitleExists(title)
      count += 1
      title = project.title + " (#{@translator.get("copy")} #{count})"

    @client.sendRequest {
      name: "clone_project"
      project: project.id
      title: title
    },(msg)=>
      @appui.setMainSection("projects")
      @appui.backToProjectList()
      @updateProjectList()
      @appui.showNotification(@translator.get("Project cloned! Here is your copy."))

  writeProjectFile:(project_id,file,content,callback)->
    @client.sendRequest {
      name:"write_project_file"
      project: project_id
      file:file
      content: content
    },(msg)=>

  readProjectFile:(project_id,file,callback)->
    @client.sendRequest {
      name:"read_project_file"
      project: project_id
      file: file
    },(msg)=>
      callback msg.content

  #listProjectFiles:(project_id,folder,callback)->
  #  @client.sendRequest {
  #    name:"list_project_files"
  #    project: project_id
  #    folder: folder
  #  },(msg)=>
  #    callback msg.content

  userConnected:(nick)->
    @appui.userConnected(nick)
    @updateProjectList()

  serverMessage:(msg)->
    switch msg.name
      when "project_list"
        @projects = msg.list
        @appui.updateProjects()
      when "project_file_locked"
        if @project? and msg.project == @project.id
          @project.fileLocked(msg)
      when "project_file_update"
        if @project? and msg.project == @project.id
          @project.fileUpdated(msg)
      when "project_file_deleted"
        if @project? and msg.project == @project.id
          @project.fileDeleted(msg)
      when "project_options_updated"
        if @project? and msg.project == @project.id
          @project.optionsUpdated(msg)
          @options.projectOpened()
          @lib_manager.projectOpened()
      when "show_error"
        @appui.showNotification(@translator.get(msg.error))

  getUserSetting:(setting)->
    if @user? and @user.settings?
      @user.settings[setting]
    else
      null

  setHomeState:()->
    history.replaceState null,"microStudio","/"

  setState:(state)->

if navigator.serviceWorker?
  navigator.serviceWorker.register("/app_sw.js", { scope: location.pathname }).then((reg)->
    console.log('Registration succeeded. Scope is' + reg.scope)
  ).catch (error)->
    console.log('Registration failed with' + error)
