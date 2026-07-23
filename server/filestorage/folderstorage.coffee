fs = require "fs"
path = require "path"

# Same interface as FileStorage (list/read/write/delete/deleteFolder), but rooted
# on a real, human-readable folder instead of the sharded internal files/ tree.
#
# Paths passed in by callers always look like "<owner.id>/<project.id>/<folder>/<name>"
# (matching FileStorage's convention) ; the leading two segments are stripped since a
# FolderStorage instance already belongs to a single project. Dash-joined flat names
# (microStudio's own convention for nested UI folders, e.g. "characters-player.png")
# are mapped to real nested directories ("characters/player.png") using the same
# convention already used by the project export/import zip feature.
#
# Per-file properties (sprite frames/fps, sound trim points, et. ) have nowhere to live
# on a plain filesystem, so they're kept as a "<name>.<ext>.json" sidecar next to the
# asset. Thumbnails (waveforms/previews, regenerable, not meant for git) are written
# under a gitignored ".microstudio/thumbnails" folder instead of alongside real assets.
SELF_WRITE_WINDOW = 2000

class @FolderStorage
  constructor:(@folder)->
    if not fs.existsSync(@folder)
      fs.mkdirSync(@folder,{recursive:true})
    @thumbnails = "#{@folder}/.microstudio/thumbnails"
    @recent_writes = {}
    @ensureGitignore()

  # records the mtime resulting from our own write, so the watcher can tell its
  # own writes apart from a genuine external edit that happens to land in the
  # same short time window (e.g. an IDE save immediately followed by a real
  # external edit of the same file)
  markSelfWrite:(realPath,callback)->
    fs.stat realPath,(err,stat)=>
      @recent_writes[realPath] = {time:Date.now(),mtime:if stat? then stat.mtimeMs else null}
      callback?()

  markSelfDelete:(realPath)->
    @recent_writes[realPath] = {time:Date.now(),mtime:null,deleted:true}

  # callback(true) if realPath's current on-disk state still matches what we
  # last wrote/deleted ourselves within the self-write window - i.e. this is an
  # echo of our own write, not an independent external change
  consumeSelfWrite:(realPath,callback)->
    mark = @recent_writes[realPath]
    delete @recent_writes[realPath]
    return callback(false) if not mark? or (Date.now()-mark.time)>=SELF_WRITE_WINDOW

    if mark.deleted
      fs.stat realPath,(err,stat)=> callback(not stat?)
    else
      fs.stat realPath,(err,stat)=> callback(stat? and stat.mtimeMs==mark.mtime)

  ensureGitignore:()->
    file = "#{@folder}/.gitignore"
    try
      if not fs.existsSync(file)
        fs.writeFileSync file,".microstudio/\n"
      else
        content = fs.readFileSync(file,"utf8")
        lines = content.split("\n").map (l)=> l.trim()
        if lines.indexOf(".microstudio/")<0 and lines.indexOf(".microstudio")<0
          separator = if content.length>0 and not content.endsWith("\n") then "\n" else ""
          fs.appendFileSync file,"#{separator}.microstudio/\n"
    catch err
      console.error err

  isAuxFolder:(folder)-> folder.endsWith("_th")

  rootFor:(folder)-> if @isAuxFolder(folder) then @thumbnails else @folder

  dashesToSlashes:(name)-> name.split("-").join("/")
  slashesToDashes:(name)-> name.split("/").join("-")

  stripPrefix:(file)->
    s = file.split("/")
    s.splice(0,2)
    s.join("/")

  # rel = "sprites/characters-player.png" -> real path under the correct root,
  # with the dashed name expanded into real subdirectories
  realPathForFile:(rel)->
    i = rel.indexOf("/")
    return "#{@folder}/#{rel}" if i<0

    folder = rel.substring(0,i)
    name = rel.substring(i+1)
    dot = name.lastIndexOf(".")
    base = if dot<0 then name else name.substring(0,dot)
    ext = if dot<0 then "" else name.substring(dot)

    "#{@rootFor(folder)}/#{folder}/#{@dashesToSlashes(base)}#{ext}"

  sidecarPath:(realPath)-> "#{realPath}.json"

  list:(file,callback)->
    rel = @stripPrefix file
    base = "#{@rootFor(rel)}/#{rel}"
    result = []

    walk = (dir,prefix,done)=>
      fs.readdir dir,{withFileTypes:true},(err,entries)=>
        return done() if err? or not entries?
        entries = entries.filter (e)=> not e.name.startsWith(".")
        names = (e.name for e in entries when not e.isDirectory())
        files = (e for e in entries when not e.isDirectory())
        dirs = (e for e in entries when e.isDirectory())

        for e in files
          isSidecar = e.name.endsWith(".json") and names.indexOf(e.name.slice(0,-5))>=0
          result.push "#{prefix}#{e.name}" if not isSidecar

        return done() if dirs.length==0
        pending = dirs.length
        for d in dirs
          do (d)=>
            walk "#{dir}/#{d.name}","#{prefix}#{@slashesToDashes(d.name)}-",()=>
              pending -= 1
              done() if pending==0

    walk base,"",()=> callback(result)

  read:(file,encoding,callback)->
    real = @realPathForFile(@stripPrefix file)
    fs.readFile real,(err,data)=>
      if data? and not err?
        switch encoding
          when "base64" then callback data.toString "base64"
          when "binary" then callback data
          else callback data.toString "utf8"
      else
        callback(null)

  readProperties:(file,callback)->
    real = @realPathForFile(@stripPrefix file)
    fs.readFile @sidecarPath(real),(err,data)=>
      if data? and not err?
        try
          callback(JSON.parse data.toString "utf8")
        catch e
          callback({})
      else
        callback({})

  write:(file,content,callback)->
    real = @realPathForFile(@stripPrefix file)
    fs.mkdir path.dirname(real),{recursive:true},()=>
      fs.writeFile real,content,()=>
        @markSelfWrite real,()=> callback() if callback?

  writeProperties:(file,properties,callback)->
    real = @realPathForFile(@stripPrefix file)
    fs.mkdir path.dirname(real),{recursive:true},()=>
      sidecar = @sidecarPath(real)
      fs.writeFile sidecar,JSON.stringify(properties or {}),()=>
        @markSelfWrite sidecar,()=> callback() if callback?

  delete:(file,callback)->
    real = @realPathForFile(@stripPrefix file)
    fs.unlink real,()=>
      @markSelfDelete(real)
      fs.unlink @sidecarPath(real),()=>
        @markSelfDelete @sidecarPath(real)
        @pruneEmptyDirs path.dirname(real)
        callback() if callback?

  pruneEmptyDirs:(dir)->
    return if dir.length<=@folder.length or dir==@thumbnails
    fs.readdir dir,(err,entries)=>
      if not err? and entries? and entries.length==0
        fs.rmdir dir,(err)=>
          @pruneEmptyDirs path.dirname(dir) if not err?

  deleteFolder:(file,callback)->
    rel = @stripPrefix file
    real = "#{@rootFor(rel)}/#{rel}"
    fs.rm real,{recursive:true,force:true},()=>
      callback() if callback?

  mkdirs:(folder,callback)->
    real = "#{@rootFor(folder)}/#{folder}"
    fs.mkdir real,{recursive:true},()=>
      callback() if callback?

module.exports = @FolderStorage
