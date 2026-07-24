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

    @PORT = @config.port or 8089
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
    if @exited
      process.exit(0)
    @httpserver.close()
    @io.close()
    @db.close()
    @content.close()
    clearInterval @exitcheck
    clearInterval @session_check
    @exited = true
    setTimeout (()=>@exit()),5000

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

  # Validates a client-supplied folder path before it becomes a project's live storage.
  checkProjectFolder:(folder)->
    return {error:"Local project folders are not enabled on this server"} if not @localFoldersEnabled()
    return {error:"invalid path"} if typeof folder != "string" or folder.length==0 or folder.length>1000
    return {error:"path must be absolute"} if not path.isAbsolute(folder)

    resolved = path.resolve(folder)

    if @config.projects_root
      root = path.resolve(@config.projects_root)
      return {error:"path must be inside #{root}"} if resolved != root and not resolved.startsWith(root+path.sep)

    internal_files = path.resolve("#{@app_data}/files")
    internal_data = path.resolve("#{@app_data}/data")
    for internal in [internal_files,internal_data]
      return {error:"cannot use microStudio's internal storage folder"} if resolved==internal or resolved.startsWith(internal+path.sep)

    {resolved: resolved}

module.exports = @Server
