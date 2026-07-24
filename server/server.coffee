compression = require "compression"
express = require "express"
fs = require "fs"
path = require "path"
DB = require __dirname+"/db/db.js"
FileStorage = require __dirname+"/filestorage/filestorage.js"
Content = require __dirname+"/content/content.js"
WebApp = require __dirname+"/webapp.js"
Session = require __dirname+"/session/session.js"
WebSocket = require "ws"
process = require "process"

class @Server
  constructor:(@config={},@callback)->
    process.chdir __dirname

    @app_data = @config.app_data or ".."

    @PORT = @config.port
    unless typeof @PORT == "number" and @PORT>=0 and @PORT<=65535 and @PORT%1==0
      @PORT = 8089
    @create()

  create:()->
    app = express()
    static_files = "../static"

    @date_started = Date.now()

    app.use(compression())

    app.use(express.static(static_files))
    app.use("/microstudio.wiki",express.static("../microstudio.wiki",{dotfiles:"ignore"}))
    app.use("/lib/fontlib/ubuntu",express.static("node_modules/@fontsource/ubuntu"))
    app.use("/lib/fontlib/ubuntu-mono",express.static("node_modules/@fontsource/ubuntu-mono"))
    app.use("/lib/fontlib/source-sans-pro",express.static("node_modules/@fontsource/source-sans-pro"))
    app.use("/lib/fontlib/fontawesome",express.static("node_modules/@fortawesome/fontawesome-free"))
    app.use("/lib/ace",express.static("node_modules/ace-builds/src-min"))
    app.use("/lib/marked/marked.js",express.static("node_modules/marked/marked.min.js"))
    app.use("/lib/dompurify/purify.js",express.static("node_modules/dompurify/dist/purify.min.js"))
    app.use("/lib/jquery/jquery.js",express.static("node_modules/jquery/dist/jquery.min.js"))
    app.use("/lib/jquery-ui",express.static("node_modules/jquery-ui-dist"))
    app.use("/lib/wavefile",express.static("node_modules/wavefile/dist"))
    app.use("/lib/lamejs/lame.min.js",express.static("node_modules/lamejs/lame.min.js"))

    @db = new DB "#{@app_data}/data",(db)=>
      @use_cache = false
      @httpserver = require("http").createServer(app).listen @PORT,"127.0.0.1",()=>
        @PORT = @httpserver.address().port
        @start(app,db)
        console.info "local server running on port #{@PORT}"
        @callback() if @callback?

  start:(app,db)->
    @active_users = 0

    @io = new WebSocket.Server
      server: @httpserver
      maxPayload: 1000000000

    @sessions = []

    @io.on "connection",(socket,request)=>
      socket.request = request
      socket.remoteAddress = request.connection.remoteAddress
      @sessions.push new Session @,socket

    console.info "MAX PAYLOAD = "+@io.options.maxPayload

    @session_check = setInterval (()=>@sessionCheck()),10000

    @content = new Content @,db,new FileStorage "#{@app_data}/files"
    @webapp = new WebApp @,app

    process.on 'SIGINT', ()=>
      console.log "caught INT signal"
      @exit()

    process.on 'SIGTERM', ()=>
      console.log "caught TERM signal"
      @exit()

    #process.on 'SIGKILL', ()=>
    #  console.log "caught KILL signal"
    #  @exit()

    @exitcheck = setInterval (()=>
      if fs.existsSync("exit")
        @exit()
        fs.unlinkSync("exit")

      if fs.existsSync("update")
        @webapp.concatenator.refresh()
        fs.unlinkSync("update")
    ),2000

  exit:()=>
    return if @exited
    @exited = true

    clearInterval @exitcheck
    clearInterval @session_check

    # Close active websocket clients first. Otherwise chokidar watchers owned by
    # open projects can keep the Node process alive after the HTTP listener is
    # asked to close.
    if @io?
      @io.clients.forEach (socket)=>socket.terminate()
      @io.close()

    @content.close() if @content?
    @db.close() if @db?

    finished = false
    finish = ()->
      return if finished
      finished = true
      process.exit(0)
    if @httpserver?
      @httpserver.close finish
      @httpserver.closeAllConnections?()
    setTimeout finish,1000

  sessionCheck:()->
    for s in @sessions
      if s?
        s.timeCheck()
    return

  sessionClosed:(session)->
    index = @sessions.indexOf(session)
    if index>=0
      @sessions.splice index,1

  localFoldersEnabled:()-> true

  pathIsWithin:(root,candidate)->
    relative = path.relative(path.resolve(root),path.resolve(candidate))
    relative == "" or (relative != ".." and not relative.startsWith("..#{path.sep}") and not path.isAbsolute(relative))

  # Returns a safe, directory-only view for the local-folder picker. The
  # browser is rooted at projects_root when configured, otherwise at the
  # filesystem root so local users can choose folders outside the workspace.
  browseProjectFolders:(folder)->
    return {error:"Local project folders are not enabled on this server"} if not @localFoldersEnabled()

    root = path.resolve(@config.projects_root or path.parse(process.cwd()).root)
    requested = folder or root
    return {error:"invalid path"} if typeof requested != "string" or requested.length==0 or requested.length>1000
    return {error:"path must be absolute"} if not path.isAbsolute(requested)

    try
      root = fs.realpathSync root
      resolved = fs.realpathSync path.resolve(requested)
    catch err
      return {error:"folder does not exist or cannot be read"}

    return {error:"path must be inside #{root}"} if @config.projects_root and not @pathIsWithin(root,resolved)

    try
      stat = fs.statSync resolved
      return {error:"not a folder"} if not stat.isDirectory()
      names = fs.readdirSync resolved,{withFileTypes:true}
    catch err
      return {error:"folder cannot be read"}

    internal_files = path.resolve("#{@app_data}/files")
    internal_data = path.resolve("#{@app_data}/data")
    entries = []
    for entry in names
      continue unless entry.isDirectory()
      continue if entry.name == ".git" or entry.name == "node_modules"
      entry_path = path.join resolved,entry.name
      continue if @pathIsWithin(internal_files,entry_path) or @pathIsWithin(internal_data,entry_path)
      entries.push
        name: entry.name
        path: entry_path

    # A Windows drive root only shows the current drive by default. Include
    # other mounted drives so the picker behaves like a normal folder dialog.
    if process.platform == "win32" and not @config.projects_root and resolved == path.parse(resolved).root
      for code in [65..90]
        drive = String.fromCharCode(code)+":\\"
        if fs.existsSync drive
          entries.push
            name: drive
            path: drive

    entries.sort (a,b)->a.name.localeCompare b.name
    parent = if resolved == path.parse(resolved).root or (root == resolved and @config.projects_root) then null else path.dirname resolved
    {
      root: root
      path: resolved
      parent: parent
      entries: entries
    }

  # Validates a client-supplied folder path before it becomes a project's live storage.
  checkProjectFolder:(folder)->
    return {error:"Local project folders are not enabled on this server"} if not @localFoldersEnabled()
    return {error:"invalid path"} if typeof folder != "string" or folder.length==0 or folder.length>1000
    return {error:"path must be absolute"} if not path.isAbsolute(folder)

    resolved = path.resolve(folder)
    # Resolve existing paths before applying containment checks so a symlink
    # cannot make a folder appear inside projects_root while pointing outside.
    try
      resolved = fs.realpathSync resolved
    catch err
      try
        resolved = path.join(fs.realpathSync(path.dirname(resolved)),path.basename(resolved))
      catch parent_err
        # The folder may be created by FolderStorage below; retain the
        # normalized lexical path when no existing parent can be resolved.
        resolved = path.resolve(folder)

    if fs.existsSync resolved
      try
        return {error:"path is not a folder"} if not fs.statSync(resolved).isDirectory()
        fs.accessSync resolved,fs.constants.R_OK|fs.constants.W_OK
      catch err
        return {error:"folder cannot be accessed"}

    if @config.projects_root
      root = path.resolve(@config.projects_root)
      try
        root = fs.realpathSync root
      catch err
        root = path.resolve(@config.projects_root)
      return {error:"path must be inside #{root}"} if not @pathIsWithin(root,resolved)

    internal_files = path.resolve("#{@app_data}/files")
    internal_data = path.resolve("#{@app_data}/data")
    for internal in [internal_files,internal_data]
      try
        internal = fs.realpathSync internal
      catch err
        continue
      return {error:"cannot use microStudio's internal storage folder"} if @pathIsWithin(internal,resolved)

    {resolved: resolved}

module.exports = @Server
