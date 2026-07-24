pug = require "pug"
fs = require "fs"
ProjectManager = require __dirname+"/session/projectmanager.js"
{Jimp,JimpMime,ResizeStrategy} = require "jimp"
Concatenator = require __dirname+"/concatenator.js"
Fonts = require __dirname+"/fonts.js"
ExportFeatures = require __dirname+"/app/exportfeatures.js"


class @WebApp
  constructor:(@server,@app)->
    @code = ""
    fs.readFile "../templates/play/manifest.json",(err,data)=>
      @manifest_template = data

    #@app.get /^\/[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*\/[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/,(req,res)=>
    #  redir = req.protocol+'://' + req.get('host') + req.url+"/"
    #  console.info "redirecting to: "+redir
    #  redir = res.redirect(redir)

    @concatenator = new Concatenator @
    @fonts = new Fonts

    @export_features = new ExportFeatures @

    @home_page = {}

    @reserved = ["documentation","projects","about"]
    home_exp = "^(\\/|\\/documentation|\\/documentation\\/.*|\\/projects|\\/projects\\/.*|\\/about|\\/about\\/.*)$"


    console.info "home_exp = #{home_exp}"

    @app.get new RegExp(home_exp), (req,res)=>
      lang = "en"


      if not @home_funk? or not @server.use_cache
        @home_funk = pug.compileFile "../templates/home.pug"

      s = req.path.split("/")
      if s[1] == "about"      
        res.setHeader( "Cross-Origin-Embedder-Policy", "require-corp" )
        res.setHeader( "Cross-Origin-Opener-Policy", "same-origin" )

      if not @home_page[lang]? or not @server.use_cache
        #console.info "generating home page #{lang}"
        translator = @server.content.translator.getTranslator(lang)
        @home_page[lang] = @home_funk
          name: "microStudio"
          javascript_files: @concatenator.getHomeJSFiles()
          css_files: @concatenator.getHomeCSSFiles()
          translator: translator
          language: lang
          optional_libs: @concatenator.optional_libs
          language_engines: @concatenator.language_engines
          title: "microStudio - "+translator.get("Game Engine")
          description: translator.get("A local game engine for code and assets.")
          long_description: translator.get("A local, code-centric game engine with integrated creative tools.")
          poster: "/img/microstudio.jpg"

      res.send @home_page[lang]

    # /user/project[/code/]
    @app.get /^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+\/?)?)?$/,(req,res)=>
      access = @getProjectAccess req,res
      if not access?
        return  # 404 is already sent

      user = access.user
      project = access.project

      if req.path.charAt(req.path.length-1) != "/"
        redir = req.protocol+'://' + req.get("host") + req.url+"/"
        console.info "redirecting to: "+redir
        return res.redirect(redir)

      file = "#{user.id}/#{project.id}/ms/main.ms"

      encoding = "text"

      manager = @getProjectManager(project)

      jsfiles = @concatenator.getPlayerJSFiles(project.graphics)

      for lib in project.libs
        l = @concatenator.findOptionalLib lib
        if l
          jsfiles.push l.lib

      prog_lang = project.language
      if @concatenator.language_engines[prog_lang]?
        jsfiles = jsfiles.concat @concatenator.language_engines[prog_lang].scripts
        jsfiles = jsfiles.concat @concatenator.language_engines[prog_lang].lib

      pathcode = if project.public then project.slug else "#{project.slug}/#{project.code}"
      poster = if project.files? and project.files["sprites/poster.png"]?
        "https://microstudio.io/#{user.nick}/#{pathcode}/sprites/poster.png"
      else
        "https://microstudio.io/#{user.nick}/#{pathcode}/icon512.png"

      manager.listFiles "ms",(sources)=>
        manager.listFiles "sprites",(sprites)=>
          manager.listFiles "maps",(maps)=>
            manager.listFiles "sounds",(sounds)=>
              manager.listFiles "music",(music)=>
                manager.listFiles "assets",(assets)=>
                  resources = JSON.stringify
                    sources: sources
                    images: sprites
                    maps: maps
                    sounds: sounds
                    music: music
                    assets: assets

                  resources = "var resources = #{resources};\n"

                  if not @play_funk? or not @server.use_cache
                    @play_funk = pug.compileFile "../templates/play/play.pug"
                  pf = @play_funk

                  res.send pf
                    user: user
                    javascript_files: jsfiles
                    fonts: @fonts.fonts
                    debug: req.query? and req.query.debug?
                    language: project.language
                    translator: @server.content.translator.getTranslator(@getLanguage(req))
                    game:
                      name: project.slug
                      pathcode: pathcode
                      title: project.title
                      author: user.nick
                      resources: resources
                      orientation: project.orientation
                      aspect: project.aspect
                      graphics: project.graphics
                      libs: JSON.stringify(project.libs)
                      description: project.description
                      poster: poster

    @app.get /^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/manifest.json$/,(req,res)=>
      access = @getProjectAccess req,res
      return if not access?

      user = access.user
      project = access.project

      manager = @getProjectManager(project)
      iconversion = manager.getFileVersion("sprites/icon.png")

      path = if project.public then "/#{user.nick}/#{project.slug}/" else "/#{user.nick}/#{project.slug}/#{project.code}/"

      res.setHeader("Content-Type", "application/json")
      s = req.path.split("/")
      mani = @manifest_template.toString().replace(/SCOPE/g,path)
      mani = mani.toString().replace("APPNAME",project.title)
      mani = mani.toString().replace("APPSHORTNAME",project.title)
      mani = mani.toString().replace("ORIENTATION",project.orientation)
      mani = mani.toString().replace(/USER/g,user.nick)
      mani = mani.toString().replace(/PROJECT/g,project.slug)
      mani = mani.toString().replace(/ICONVERSION/g,iconversion)
      mani = mani.replace("START_URL",path)
      res.send mani

    @app.get /^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/sw.js$/,(req,res)=>
      access = @getProjectAccess req,res
      return if not access?

      user = access.user
      project = access.project

      fs.readFile "../static/sw.js",(err,data)=>
        res.setHeader("Content-Type", "application/javascript")
        res.send data

    @app.get /^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/icon[0-9]+.png$/,(req,res)=>
      access = @getProjectAccess req,res
      return if not access?

      user = access.user
      project = access.project

      size = req.path.split("icon")
      size = size[size.length-1]
      size = Math.min(1024,size.split(".")[0]|0)

      project.getStorage().read "#{user.id}/#{project.id}/sprites/icon.png","binary",(iconData)=>
        if not iconData?
          @return404( req, res )
          return

        Jimp.read(iconData)
        .then (img)=>
          img.resize(
            w: size
            h: size
            mode: ResizeStrategy.NEAREST_NEIGHBOR
          ).getBuffer(JimpMime.png)
          .then (buffer)=>
            res.setHeader "Content-Type", "image/png"
            res.send buffer
          .catch (err)=>
            console.error err
            @return404(req,res)
        .catch (err)=>
          console.error err
          @return404(req,res)

    # source files for player
    @app.get /^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/ms\/[A-Za-z0-9_-]+.ms$/,(req,res)=>
      s = req.path.split("/")
      access = @getProjectAccess req,res
      return if not access?

      user = access.user
      project = access.project
      ms = s[s.length-1]

      project.getStorage().read "#{user.id}/#{project.id}/ms/#{ms}","text",(content)=>
        if content?
          res.setHeader("Content-Type", "application/javascript")
          res.send content
        else
          console.info "couldn't read file: #{req.path}"
          res.status(404).send("Error 404")

    # asset thumbnail
    @app.get /^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/(assets_th|sounds_th|music_th)\/[A-Za-z0-9_-]+.png$/,(req,res)=>
      s = req.path.split("/")
      access = @getProjectAccess req,res
      return if not access?

      user = access.user
      project = access.project
      folder = s[s.length-2]
      asset = s[s.length-1]

      #console.info "loading #{user.id}/#{project.id}/#{folder}/#{asset}"

      project.getStorage().read "#{user.id}/#{project.id}/#{folder}/#{asset}","binary",(content)=>
        if content?
          res.setHeader("Content-Type", "image/png")
          res.send content
        else
          console.info "couldn't read file: #{req.path}"
          res.status(404).send("Error 404")

    # image files for player ; should be deprecated in favor of /sprites/
    @app.get /^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/[A-Za-z0-9_]+.png$/,(req,res)=>
      s = req.path.split("/")
      access = @getProjectAccess req,res
      return if not access?

      user = access.user
      project = access.project
      image = s[s.length-1]

      project.getStorage().read "#{user.id}/#{project.id}/sprites/#{image}","binary",(content)=>
        if content?
          res.setHeader("Content-Type", "image/png")
          res.send content
        else
          console.info "couldn't read file: #{req.path}"
          res.status(404).send("Error 404")

    # image files for player and all
    @app.get /^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/sprites\/[A-Za-z0-9_-]+.png$/,(req,res)=>
      s = req.path.split("/")
      access = @getProjectAccess req,res
      return if not access?

      user = access.user
      project = access.project
      image = s[s.length-1]

      project.getStorage().read "#{user.id}/#{project.id}/sprites/#{image}","binary",(content)=>
        if content?
          res.setHeader("Content-Type", "image/png")
          res.send content
        else
          console.info "couldn't read file: #{req.path}"
          res.status(404).send("Error 404")

    # map files for player
    @app.get /^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/maps\/[A-Za-z0-9_-]+.json$/,(req,res)=>
      s = req.path.split("/")
      access = @getProjectAccess req,res
      return if not access?

      user = access.user
      project = access.project
      map = s[s.length-1]

      project.getStorage().read "#{user.id}/#{project.id}/maps/#{map}","text",(content)=>
        if content?
          res.setHeader("Content-Type", "application/json")
          res.send content
        else
          console.info "couldn't read file: #{req.path}"
          res.status(404).send("Error 404")

    # sound files for player and all
    @app.get /^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/sounds\/[A-Za-z0-9_-]+.(wav|ogg|flac)$/,(req,res)=>
      s = req.path.split("/")
      access = @getProjectAccess req,res
      return if not access?

      user = access.user
      project = access.project
      sound = s[s.length-1]
      ext = sound.split(".")[1]

      project.getStorage().read "#{user.id}/#{project.id}/sounds/#{sound}","binary",(content)=>
        if content?
          res.setHeader("Content-Type", "audio/#{ext}")
          res.send content
        else
          console.info "couldn't read file: #{req.path}"
          res.status(404).send("Error 404")


    # music files for player and all
    @app.get /^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/music\/[A-Za-z0-9_-]+.(mp3|ogg|flac)$/,(req,res)=>
      s = req.path.split("/")
      access = @getProjectAccess req,res
      return if not access?

      user = access.user
      project = access.project
      music = s[s.length-1]
      ext = music.split(".")[1]

      project.getStorage().read "#{user.id}/#{project.id}/music/#{music}","binary",(content)=>
        if content?
          res.setHeader("Content-Type", "audio/#{ext}")
          res.send content
        else
          console.info "couldn't read file: #{req.path}"
          res.status(404).send("Error 404")


    # asset files
    @app.get /^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/assets\/[A-Za-z0-9_-]+.(jpg|png|ttf|txt|csv|json|md|wasm)$/,(req,res)=>
      s = req.path.split("/")
      access = @getProjectAccess req,res
      return if not access?

      user = access.user
      project = access.project
      asset = s[s.length-1]

      project.getStorage().read "#{user.id}/#{project.id}/assets/#{asset}","binary",(content)=>
        if content?
          switch asset.split(".")[1]
            when "jpg" then res.setHeader("Content-Type", "image/jpg")
            when "png" then res.setHeader("Content-Type", "image/png")
            when "ttf" then res.setHeader("Content-Type", "application/font-sfnt")
            when "txt" then res.setHeader("Content-Type", "text/plain")
            when "csv" then res.setHeader("Content-Type", "text/csv")
            when "json" then res.setHeader("Content-Type", "application/json")
            when "wasm" then res.setHeader("Content-Type", "application/wasm")

          res.send content
        else
          console.info "couldn't read file: #{req.path}"
          res.status(404).send("Error 404")

    # doc files
    @app.get /^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/doc\/[A-Za-z0-9_]+.md$/,(req,res)=>
      s = req.path.split("/")
      access = @getProjectAccess req,res
      return if not access?

      user = access.user
      project = access.project
      doc = s[s.length-1]

      project.getStorage().read "#{user.id}/#{project.id}/doc/#{doc}","text",(content)=>
        if content?
          res.setHeader("Content-Type", "text/markdown")
          res.send content
        else
          console.info "couldn't read file: #{req.path}"
          res.status(404).send("Error 404")

    @app.use (req,res)=>
      @return404(req,res)

  return404:(req,res)->
    if not @err404_funk? or not @server.use_cache
      @err404_funk = pug.compileFile "../templates/404.pug"

    res.status(404).send @err404_funk {}

  getLanguage:(request)-> "en"

  getProjectAccess:(req,res)->
    s = req.path.split("/")
    user = s[1]
    project = s[2]
    code = s[3]

    user = @server.content.findUserByNick(user)
    if not user?
      @return404(req,res)
      return null

    project = user.findProjectBySlug project
    if not project?
      @return404(req,res)
      return null

    if project.public or project.code == code
      return { user: user, project: project }

    @return404(req,res)
    return null

  getProjectManager:(project)->
    if not project.manager?
      new ProjectManager project
    project.manager

  roundRect: (context,x, y, w, h, r)->
    r = w / 2 if (w < 2 * r)
    r = h / 2 if (h < 2 * r)
    context.beginPath()
    context.moveTo(x+r, y)
    context.arcTo(x+w, y,   x+w, y+h, r)
    context.arcTo(x+w, y+h, x,   y+h, r)
    context.arcTo(x,   y+h, x,   y,   r)
    context.arcTo(x,   y,   x+w, y,   r)
    context.closePath()

  fillRoundRect: (context,x, y, w, h, r)->
    @roundRect context,x,y,w,h,r
    context.fill()

module.exports = @WebApp
