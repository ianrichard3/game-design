fs = require "fs"

class @Concatenator
  constructor:(@webapp)->
    @webapp.app.get /^\/all.js$/, (req,res)=>
      res.setHeader("Content-Type", "text/javascript")
      res.send @webapp_js_concat

    @webapp.app.get /^\/all.css$/, (req,res)=>
      res.setHeader("Content-Type", "text/css")
      res.send @webapp_css_concat

    @webapp.app.get /^\/play.js$/, (req,res)=>
      res.setHeader("Content-Type", "text/javascript")
      res.send @player_js_concat

    @alt_players = {}

    @optional_libs =
      matterjs:
        title: "matter.js - 2D physics engine"
        lib: "/lib/matterjs/v017/matter.min.js"
        lib_path: "../static/lib/matterjs/v017/matter.min.js"
        versions:
          matterjs_v017:
            name: "version 0.17"
            lib: "/lib/matterjs/v017/matter.min.js"
            lib_path: "../static/lib/matterjs/v017/matter.min.js"
            original: true

          matterjs_v018:
            name: "version 0.18"
            lib: "/lib/matterjs/v018/matter.min.js"
            lib_path: "../static/lib/matterjs/v018/matter.min.js"

          matterjs_v019:
            name: "version 0.19"
            lib: "/lib/matterjs/v019/matter.min.js"
            lib_path: "../static/lib/matterjs/v019/matter.min.js"
            default: true

      cannonjs:
        title: "cannon.js - 3D physics engine"
        lib: "/lib/cannonjs/v06/cannon.min.js"
        lib_path: "../static/lib/cannonjs/v06/cannon.min.js"


    @language_engines =
      microscript_v2:
        title: "microScript 2.0"
        scripts: [ "/js/languages/microscript/v2/compiler.js",
          "/js/languages/microscript/v2/parser.js",
          "/js/languages/microscript/v2/processor.js",
          "/js/languages/microscript/v2/program.js",
          "/js/languages/microscript/v2/routine.js",
          "/js/languages/microscript/v2/runner.js",
          "/js/languages/microscript/v2/token.js",
          "/js/languages/microscript/v2/tokenizer.js",
          "/js/languages/microscript/v2/transpiler.js" ]
        lib: []

    @webapp_css = [
      "/css/style.css"
      "/css/doc.css"
      "/css/code.css"
      "/css/debug.css"
      "/css/assets.css"
      "/css/sprites.css"
      "/css/sounds.css"
      "/css/synth.css"
      "/css/music.css"
      "/css/maps.css"
      "/css/options.css"
      "/css/git.css"
      "/css/media.css"
      "/css/terminal.css"
      "/css/md.css"
      "/css/common.css"
    ]

    @webapp_js = [
      "/js/languages/microscript/random.js"

      "/js/languages/microscript/v2/parser.js",
      "/js/languages/microscript/v2/program.js",
      "/js/languages/microscript/v2/token.js",
      "/js/languages/microscript/v2/tokenizer.js",

      "/js/languages/microscript/microscript.js"

      "/js/client/client.js"

      "/js/util/confirm.js"
      "/js/util/canvas2d.js"
      "/js/util/regexlib.js"
      "/js/util/inputvalidator.js"
      "/js/util/translator.js"

      "/js/manager.js"
      "/js/folderview.js"

      "/js/about/about.js"
      "/js/doc/documentation.js"
      "/js/doceditor/doceditor.js"
      "/js/editor/editor.js"
      "/js/editor/runwindow.js"
      "/js/editor/projectaccess.js"
      "/js/editor/rulercanvas.js"
      "/js/editor/valuetool.js"
      "/js/editor/libmanager.js"

      "/js/options/options.js"
      "/js/git/gitpanel.js"

      "/js/spriteeditor/drawtool.js"
      "/js/spriteeditor/spritelist.js"
      "/js/spriteeditor/spriteeditor.js"
      "/js/spriteeditor/colorpicker.js"
      "/js/spriteeditor/spriteview.js"
      "/js/spriteeditor/animationpanel.js"
      "/js/spriteeditor/autopalette.js"
      "/js/spriteeditor/sprite.js"
      "/js/spriteeditor/spriteframe.js"

      "/js/mapeditor/mapview.js"
      "/js/mapeditor/mapeditor.js"
      "/js/mapeditor/tilepicker.js"
      "/js/mapeditor/map.js"

      "/js/assets/assetsmanager.js"
      "/js/assets/imageviewer.js"
      "/js/assets/textviewer.js"
      "/js/assets/fontviewer.js"

      "/js/sound/soundeditor.js"
      "/js/sound/soundthumbnailer.js"

      "/js/music/musiceditor.js"

      "/js/util/undo.js"
      "/js/util/random.js"
      "/js/util/splitbar.js"
      "/js/util/pixelartscaler.js"

      "/js/runtime/microvm.js"

      "/js/debug/debug.js"
      "/js/debug/watch.js"
      "/js/debug/timemachine.js"
      "/js/terminal/terminal.js"

      "/js/project/project.js"
      "/js/project/projectfolder.js"
      "/js/project/projectsource.js"
      "/js/project/projectsprite.js"
      "/js/project/projectmap.js"
      "/js/project/projectasset.js"
      "/js/project/projectsound.js"
      "/js/project/projectmusic.js"

      "/js/appui/floatingwindow.js"
      "/js/appui/appui.js"
      "/js/app.js"
      "/js/appstate.js"

    ]

    @player_js = [
      '/js/util/canvas2d.js'

      "/js/languages/microscript/random.js"
      "/js/runtime/microvm.js"
      '/js/runtime/runtime.js'
      '/js/runtime/watcher.js'
      '/js/runtime/projectinterface.js'
      '/js/runtime/timemachine.js'
      '/js/runtime/screen.js'
      '/js/runtime/assetmanager.js'
      '/js/runtime/keyboard.js'
      '/js/runtime/gamepad.js'
      '/js/runtime/sprite.js'
      '/js/runtime/msimage.js'
      '/js/runtime/map.js'
      "/js/runtime/audio/audio.js"
      "/js/runtime/audio/beeper.js"
      "/js/runtime/audio/sound.js"
      "/js/runtime/audio/music.js"
      '/js/play/player.js'
      '/js/play/playerclient.js'
    ]

    @refresh()

  refresh:()->
    @concat(@webapp_js,"webapp_js_concat")
    @concat(@player_js,"player_js_concat")
    @concat(@webapp_css,"webapp_css_concat")

  getHomeJSFiles:()->
    if @webapp.server.use_cache and @webapp_js_concat?
      ["/all.js"]
    else
      @webapp_js

  getHomeCSSFiles:()->
    if @webapp.server.use_cache and @webapp_css_concat?
      ["/all.css"]
    else
      @webapp_css

  getPlayerJSFiles:()->
    if @webapp.server.use_cache and @player_js_concat?
      ["/play.js"]
    else
      @player_js

  getEngineExport:()-> @player_js_concat

  findOptionalLib:(lib)->
    if typeof lib != "string"
      return false
    
    id = lib.split("_")[0]
    l = @optional_libs[id]
    if l?
      if id == lib or not l.versions? or not l.versions[lib]?
        return l
      else
        return l.versions[lib]
    else
      return false

  concat:(files,variable,callback)->
    list = (f for f in files)
    res = ""
    funk = ()=>
      if list.length>0
        f = list.splice(0,1)[0]
        f = "../static"+f
        fs.readFile f,(err,data)=>
          if data? and not err?
            res += data+"\n"
            funk()
          else if err
            console.info err
      else
        @[variable] = res
        callback() if callback?

    funk()

module.exports = @Concatenator
