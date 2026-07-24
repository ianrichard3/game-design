ProjectManager = require __dirname+"/projectmanager.js"
JSZip = require "jszip"

class @Session
  constructor:(@server,@socket)->
    #console.info "new session"
    @content = @server.content
    return @socket.close() if not @content?
    @translator = @content.translator.getTranslator("en")
    @user = null
    @last_active = Date.now()

    @socket.on "message",(msg)=>
      #console.info "received msg: #{msg}"

      @messageReceived msg

      @last_active = Date.now()

    @socket.on "close",()=>
      @server.sessionClosed @
      @disconnected()

    @socket.on "error",(err)=>
      if @user
        console.error "WS ERROR for user #{@user.id} - #{@user.nick}"
      else
        console.error "WS ERROR"

      console.error err

    @commands = {}
    @register "ping",(msg)=>
      @send({name:"pong"})

    @register "token",(msg)=>@checkToken(msg)

    @register "create_project",(msg)=>@createProject(msg)
    @register "import_project",(msg)=>@importProject(msg)
    @register "set_project_option",(msg)=>@setProjectOption(msg)
    @register "set_project_property",(msg)=>@setProjectProperty(msg)
    @register "delete_project",(msg)=>@deleteProject(msg)
    @register "get_project_list",(msg)=>@getProjectList(msg)
    @register "update_code",(msg)=>@updateCode(msg)
    @register "lock_project_file",(msg)=>@lockProjectFile(msg)
    @register "write_project_file",(msg)=>@writeProjectFile(msg)
    @register "read_project_file",(msg)=>@readProjectFile(msg)
    @register "rename_project_file",(msg)=>@renameProjectFile(msg)
    @register "delete_project_file",(msg)=>@deleteProjectFile(msg)
    @register "list_project_files",(msg)=>@listProjectFiles(msg)
    @register "list_public_project_files",(msg)=>@listPublicProjectFiles(msg)
    @register "read_public_project_file",(msg)=>@readPublicProjectFile(msg)
    @register "listen_to_project",(msg)=>@listenToProject(msg)
    @register "get_file_versions",(msg)=>@getFileVersions(msg)

    @register "set_project_local_folder",(msg)=>@setProjectLocalFolder(msg)
    @register "unlink_project_local_folder",(msg)=>@unlinkProjectLocalFolder(msg)

    @register "git_status",(msg)=>@gitStatus(msg)
    @register "git_init",(msg)=>@gitInit(msg)
    @register "git_set_remote",(msg)=>@gitSetRemote(msg)
    @register "git_commit",(msg)=>@gitCommit(msg)
    @register "git_push",(msg)=>@gitPush(msg)
    @register "git_pull",(msg)=>@gitPull(msg)
    @register "git_log",(msg)=>@gitLog(msg)

    @register "clone_project",(msg)=>@cloneProject(msg)

    @register "backup_complete",(msg)=>@backupComplete(msg)

    @register "upload_request",(msg)=>@uploadRequest(msg)

  register:(name,callback)->
    @commands[name] = callback

  disconnected:()->
    try
      if @project? and @project.manager?
        @project.manager.removeSession @
        @project.manager.removeListener @
      if @user?
        @user.removeListener @
    catch err
      console.error err

  setCurrentProject:(project)->
    if project != @project or not @project.manager?
      if @project? and @project.manager?
        @project.manager.removeSession @
      @project = project
      if not @project.manager?
        new ProjectManager @project
      @project.manager.addUser @

  messageReceived:(msg)->
    if typeof msg != "string"
      return @bufferReceived msg

    #console.info msg
    try
      msg = JSON.parse msg
      if msg.name?
        c = @commands[msg.name]
        c(msg) if c?
    catch err
      console.info err

  sendCodeUpdated:(file,code)->
    @send
      name: "code_updated"
      file: file
      code: code
    return

  sendProjectFileUpdated:(type,file,version,data,properties)->
    @send
      name: "project_file_updated"
      type: type
      file: file
      version: version
      data: data
      properties: properties

  sendProjectFileDeleted:(type,file)->
    @send
      name: "project_file_deleted"
      type: type
      file: file

  getUserInfo:()->
    return
      size: @user.getTotalSize()
      max_storage: @user.max_storage

  checkToken:(data)->
    @user = @content.local_user
    @user.addListener @
    @send
      name: "token_valid"
      nick: @user.nick
      email: @user.email
      flags: if not @user.flags.censored then @user.flags else {}
      info: @getUserInfo()
      settings: @user.settings
      notifications: @user.notifications
      request_id: data.request_id
    @user.notifications = []
    @user.set "last_active",Date.now()

  send:(data)->
    @socket.send JSON.stringify data

  sendError:(error,request_id)->
    @send
      name: "error"
      error: error
      request_id: request_id

  requireOwnedProject:(data)->
    return null if not @user?
    project = @content.projects[data.project] if data.project?
    return null if not project? or project.owner != @user
    @setCurrentProject project
    project

  setProjectLocalFolder:(data)->
    return @sendError("not connected",data.request_id) if not @user?
    return @sendError("no folder",data.request_id) if typeof data.folder != "string"

    project = @requireOwnedProject(data)
    return @sendError("access denied",data.request_id) if not project?

    project.setLocalFolder data.folder,(err)=>
      if err
        @sendError(err,data.request_id)
      else
        @send
          name: "set_project_local_folder"
          folder: project.local_folder
          request_id: data.request_id

  unlinkProjectLocalFolder:(data)->
    return @sendError("not connected",data.request_id) if not @user?

    project = @requireOwnedProject(data)
    return @sendError("access denied",data.request_id) if not project?

    project.unlinkLocalFolder (err)=>
      if err
        @sendError(err,data.request_id)
      else
        @send
          name: "unlink_project_local_folder"
          request_id: data.request_id

  gitStatus:(data)->
    return @sendError("not connected",data.request_id) if not @user?
    project = @requireOwnedProject(data)
    return @sendError("access denied",data.request_id) if not project?
    project.manager.getGitManager().status (result)=>
      result.name = "git_status"
      result.request_id = data.request_id
      @send result

  gitInit:(data)->
    return @sendError("not connected",data.request_id) if not @user?
    project = @requireOwnedProject(data)
    return @sendError("access denied",data.request_id) if not project?
    project.manager.getGitManager().init (result)=>
      result.name = "git_init"
      result.request_id = data.request_id
      @send result

  gitSetRemote:(data)->
    return @sendError("not connected",data.request_id) if not @user?
    project = @requireOwnedProject(data)
    return @sendError("access denied",data.request_id) if not project?
    project.manager.getGitManager().setRemote data.remote_name or "origin",data.url,(result)=>
      result.name = "git_set_remote"
      result.request_id = data.request_id
      @send result

  gitCommit:(data)->
    return @sendError("not connected",data.request_id) if not @user?
    project = @requireOwnedProject(data)
    return @sendError("access denied",data.request_id) if not project?
    project.manager.getGitManager().commit data.message,(result)=>
      result.name = "git_commit"
      result.request_id = data.request_id
      @send result

  gitPush:(data)->
    return @sendError("not connected",data.request_id) if not @user?
    project = @requireOwnedProject(data)
    return @sendError("access denied",data.request_id) if not project?
    project.manager.getGitManager().push (result)=>
      result.name = "git_push"
      result.request_id = data.request_id
      @send result

  gitPull:(data)->
    return @sendError("not connected",data.request_id) if not @user?
    project = @requireOwnedProject(data)
    return @sendError("access denied",data.request_id) if not project?
    project.manager.getGitManager().pull (result)=>
      result.name = "git_pull"
      result.request_id = data.request_id
      @send result

  gitLog:(data)->
    return @sendError("not connected",data.request_id) if not @user?
    project = @requireOwnedProject(data)
    return @sendError("access denied",data.request_id) if not project?
    project.manager.getGitManager().log (result)=>
      result.name = "git_log"
      result.request_id = data.request_id
      @send result

  importProject:(data)->
    return @sendError("Bad request") if not data.request_id?
    return @sendError("not connected",data.request_id) if not @user?
    #return @sendError("wrong data") if not data.zip_data? or typeof data.zip_data != "string"

    #split = data.zip_data.split(",")
    #return @sendError("unrecognized data") if not split[1]?
    buffer = data.data #Buffer.from(split[1],'base64')

    return @sendError("storage space exceeded",data.request_id) if buffer.byteLength>@user.max_storage-@user.getTotalSize()

    zip = new JSZip
    projectFileName = "project.json"
    zip.loadAsync(buffer).then ((contents) =>
      if not zip.file(projectFileName)?
        @sendError("[ZIP] Missing #{projectFileName}; import aborted",data.request_id)
        console.log "[ZIP] Missing #{projectFileName}; import aborted"
        return

      zip.file(projectFileName).async("string").then ((text) =>
        try
          projectInfo = JSON.parse(text)
        catch err
          @sendError("Incorrect JSON data",data.request_id)
          console.error err
          return

        @content.createProject @user,projectInfo,((project)=>
          @setCurrentProject project
          project.manager.importFiles contents,()=>
            project.set "files",projectInfo.files or {}
            @send
              name:"project_imported"
              id: project.id
              request_id: data.request_id
          ),true
      ),()=>
        @sendError("Malformed ZIP file",data.request_id)
    ),()=>
      @sendError("Malformed ZIP file",data.request_id)

  createProject:(data)->
    return @sendError("not connected") if not @user?

    @content.createProject @user,data,(project)=>
      @send
        name:"project_created"
        id: project.id
        request_id: data.request_id

  cloneProject:(data)->
    return @sendError("not connected") if not @user?
    return @sendError("") if not data.project?

    project = @server.content.projects[data.project]
    if project?
      manager = @getProjectManager project
      if manager.canRead(@user)
        @content.createProject @user,{
          title: data.title or project.title
          slug: project.slug
          public: false
        },((clone)=>
          clone.setType project.type
          clone.setOrientation project.orientation
          clone.setAspect project.aspect
          clone.set "language",project.language
          clone.setGraphics project.graphics
          clone.set "libs",project.libs
          clone.set "libraries",project.libraries
          clone.set "files",JSON.parse JSON.stringify project.files
          man = @getProjectManager(project)

          folders = ["ms","sprites","maps","sounds","sounds_th","music","music_th","assets","assets_th","doc"]
          files = []
          funk = ()=>
            if folders.length>0
              folder = folders.splice(0,1)[0]
              man.listFiles folder,(list)=>
                for f in list
                  files.push
                    file: f.file
                    folder: folder
                funk()
            else if files.length>0
              f = files.splice(0,1)[0]
              src = "#{project.owner.id}/#{project.id}/#{f.folder}/#{f.file}"
              dest = "#{clone.owner.id}/#{clone.id}/#{f.folder}/#{f.file}"
              project.getStorage().read src,"binary",(content)=>
                if content?
                  clone.getStorage().write dest,content,()=>
                    funk()
                else
                  funk()
            else
              @send
                name:"project_created"
                id: clone.id
                request_id: data.request_id

          funk()),true

  getProjectManager:(project)->
    if not project.manager?
      new ProjectManager project
    project.manager

  setProjectOption:(data)->
    return @sendError("not connected") if not @user?
    return @sendError("no value") if not data.value?

    project = @user.findProject(data.project)
    if project?
      switch data.option
        when "title"
          if not project.setTitle data.value
            @send
              name:"error"
              value: project.title
              request_id: data.request_id

        when "slug"
          if not project.setSlug data.value
            @send
              name:"error"
              value: project.slug
              request_id: data.request_id

        when "description"
          project.set "description",data.value

        when "code"
          if not project.setCode data.value
            @send
              name:"error"
              value: project.code
              request_id: data.request_id

        when "platforms"
          project.setPlatforms data.value if Array.isArray data.value

        when "libs"
          if Array.isArray data.value
            for v in data.value
              return if typeof v != "string" or v.length>100 or data.value.length>20

            project.set "libs",data.value

        when "libraries"
          if typeof data.value == "object"
            project.set "libraries",data.value

        when "type"
          @content.setProjectType project,data.value if typeof data.value == "string"

        when "orientation"
          project.setOrientation data.value if typeof data.value == "string"

        when "aspect"
          project.setAspect data.value if typeof data.value == "string"

        when "graphics"
          project.setGraphics data.value if typeof data.value == "string"

        when "unlisted"
          project.set "unlisted",if data.value then true else false

        when "language"
          project.setLanguage data.value if typeof data.value == "string"

      if project.manager?
        project.manager.propagateOptions @

      project.touch()


  setProjectProperty:(data)->
    return @sendError("not connected") if not @user?
    return @sendError("no project") if not data.project?
    return @sendError("no property") if not data.property?

    project = @user.findProject(data.project)
    if project?
      project.setProperty data.property,data.value

  deleteProject:(data)->
    return @sendError("not connected") if not @user?

    project = @user.findProject(data.project)
    if project?
      @user.deleteProject project
      @send
        name:"project_deleted"
        id: project.id
        request_id: data.request_id

  getProjectList:(data)->
    return @sendError("not connected") if not @user?

    source = @user.listProjects()
    list = []
    for p in source
      if not p.deleted
        list.push
          id: p.id
          owner:
            id: p.owner.id
            nick: p.owner.nick
          title: p.title
          slug: p.slug
          code: p.code
          description: p.description
          tags: p.tags
          flags: p.flags
          poster: p.files? and p.files["sprites/poster.png"]?
          platforms: p.platforms
          controls: p.controls
          type: p.type
          orientation: p.orientation
          aspect: p.aspect
          graphics: p.graphics
          language: p.language
          libs: p.libs
          libraries: p.libraries
          properties: p.properties
          date_created: p.date_created
          last_modified: p.last_modified
          public: p.public
          unlisted: p.unlisted
          size: p.getSize()
          local_folder: p.local_folder

    @send
      name: "project_list"
      list: list
      request_id: if data? then data.request_id else undefined

  lockProjectFile:(data)->
    return @sendError("not connected") if not @user?
    #console.info JSON.stringify data

    project = @content.projects[data.project] if data.project?
    if project?
      @setCurrentProject project
      project.manager.lockFile(@,data.file)

  writeProjectFile:(data)->
    return @sendError("not connected") if not @user?

    project = @content.projects[data.project] if data.project?
    if project?
      @setCurrentProject project
      project.manager.writeProjectFile(@,data)

  renameProjectFile:(data)->
    return @sendError("not connected") if not @user?

    project = @content.projects[data.project] if data.project?
    if project?
      @setCurrentProject project
      project.manager.renameProjectFile(@,data)

  deleteProjectFile:(data)->
    return @sendError("not connected") if not @user?

    project = @content.projects[data.project] if data.project?
    if project?
      @setCurrentProject project
      project.manager.deleteProjectFile(@,data)

  readProjectFile:(data)->
    #console.info "session.readProjectFile "+JSON.stringify data
    return @sendError("not connected") if not @user?

    project = @content.projects[data.project] if data.project?
    if project?
      @setCurrentProject project
      project.manager.readProjectFile(@,data)

  listProjectFiles:(data)->
    return @sendError("not connected") if not @user?

    project = @content.projects[data.project] if data.project?
    if project?
      @setCurrentProject project
      project.manager.listProjectFiles @,data

  listPublicProjectFiles:(data)->
    project = @content.projects[data.project] if data.project?
    if project?
      manager = @getProjectManager project
      manager.listProjectFiles @,data

  readPublicProjectFile:(data)->
    project = @content.projects[data.project] if data.project?
    if project? and project.public
      manager = @getProjectManager project
      project.manager.readProjectFile(@,data)

  listenToProject:(data)->
    user = data.user
    project = data.project
    if user? and project?
      user = @content.findUserByNick(user)
      if user?
        project = user.findProjectBySlug(project)
        if project?
          if @project? and @project.manager?
            @project.manager.removeListener @

          @project = project
          new ProjectManager @project if not @project.manager?
          @project.manager.addListener @

  getFileVersions:(data)->
    user = data.user
    project = data.project
    if user? and project?
      user = @content.findUserByNick(user)
      if user?
        project = user.findProjectBySlug(project)
        if project?
          new ProjectManager project if not project.manager?
          project.manager.getFileVersions (res)=>
            @send
              name: "project_file_versions"
              data: res
              request_id: data.request_id

  showError:(text)->
    @send
      name: "show_error"
      error: text

  timeCheck:()->
    if Date.now()>@last_active+5*60000 # 5 minutes prevents breaking large assets uploads
      @socket.close()
      @server.sessionClosed @
      @socket.terminate()

    if @upload_request_activity? and Date.now()>@upload_request_activity+60000
      @upload_request_id = -1
      @upload_request_buffers = []

  backupComplete:(msg)->
    if msg.key == @server.config["backup-key"]
      @server.sessionClosed @
      @server.last_backup_time = Date.now()

  uploadRequest:(msg)=>
    return if not @user?
    return @sendError "Bad request" if not msg.size?
    return @sendError "Bad request" if not msg.request_id?
    return @sendError "Bad request" if not msg.request?
    return @sendError "File size limit exceeded" if msg.size>100000000 # 100 Mb max

    @upload_request_id = msg.request_id
    @upload_request_size = msg.size
    @upload_uploaded = 0
    @upload_request_buffers = []
    @upload_request_request = msg.request
    @upload_request_activity = Date.now()

    @send
      name:"upload_request"
      request_id: msg.request_id

  bufferReceived:(buffer)=>
    if buffer.byteLength>=4
      id = buffer.readInt32LE(0)
      if id == @upload_request_id
        len = buffer.byteLength-4

        if len>0 and @upload_uploaded<@upload_request_size
          buf = Buffer.alloc(len)
          buffer.copy buf,0,4,buffer.byteLength
          @upload_request_buffers.push buf
          @upload_uploaded += len
          @upload_request_activity = Date.now()

        if @upload_uploaded >= @upload_request_size
          msg = @upload_request_request
          buf = Buffer.alloc @upload_request_size
          count = 0
          for b in @upload_request_buffers
            b.copy buf,count,0,b.byteLength
            count += b.byteLength

          msg.data = buf
          msg.request_id = id
          try
            if msg.name?
              c = @commands[msg.name]
              c(msg) if c?
          catch error
            console.error error
        else
          @send
            name:"next_chunk"
            request_id: id

module.exports = @Session
