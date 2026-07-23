fs = require "fs"
chokidar = require "chokidar"

CONTENT_FOLDERS = ["ms","sprites","maps","sounds","music","assets","doc"]
VALID_NAME = /^(ms|sprites|maps|sounds|music|doc|assets)\/[a-z0-9_]{1,40}(-[a-z0-9_]{1,40}){0,10}\.(ms|png|json|wav|mp3|ogg|flac|md|glb|obj|jpg|ttf|txt|csv|wasm)$/

# Watches a folder-linked project's real folder on disk and keeps the running
# server (and any connected editor sessions / running game) in sync with edits
# made outside microStudio - a different editor, `git checkout`, `git pull`, etc.
#
# Only active while at least one session has the project open (see
# ProjectManager.addUser/removeSession) ; started with a reconcile pass so
# changes made while the server was stopped (e.g. an offline git pull) are
# picked up as soon as someone opens the project again.
class @FolderWatcher
  constructor:(@project)->
    @storage = @project.getStorage()

  start:(callback)->
    return callback?() if @watcher?
    @reconcile ()=>
      @attachWatcher()
      callback?()

  stop:()->
    if @watcher?
      @watcher.close()
      @watcher = null

  attachWatcher:()->
    @watcher = chokidar.watch @storage.folder,
      cwd: @storage.folder
      ignoreInitial: true
      ignored: (p)->
        base = p.split("/").pop()
        base.startsWith(".") or p.indexOf(".microstudio")>=0 or p.indexOf(".git")>=0
      awaitWriteFinish:
        stabilityThreshold: 300
        pollInterval: 100

    @watcher.on "add",(p)=>@changed(p)
    @watcher.on "change",(p)=>@changed(p)
    @watcher.on "unlink",(p)=>@removed(p)

  # "sprites/characters/player.png" -> "sprites/characters-player.png" ; null if
  # the path doesn't map onto a recognized, validly-named project file
  toDashFile:(relPath)->
    parts = relPath.split("/")
    return null if parts.length<2

    folder = parts[0]
    return null if CONTENT_FOLDERS.indexOf(folder)<0

    filename = parts[parts.length-1]
    dot = filename.lastIndexOf(".")
    return null if dot<0

    dirs = parts.slice(1,parts.length-1)
    base = filename.substring(0,dot)
    ext = filename.substring(dot)
    dashed = dirs.concat([base]).join("-")
    file = "#{folder}/#{dashed}#{ext}"

    if VALID_NAME.test(file) then file else null

  changed:(relPath)->
    file = @toDashFile(relPath)
    return if not file?

    real = @storage.realPathForFile(file)
    fullPath = "#{@project.owner.id}/#{@project.id}/#{file}"

    @storage.consumeSelfWrite real,(isSelf)=>
      return if isSelf

      manager = @project.manager
      return if not manager?

      encoding = if /\.(ms|json|md)$/.test(file) then "utf8" else "base64"
      @storage.read fullPath,encoding,(content)=>
        return if not content?
        @storage.readProperties fullPath,(properties)=>
          size = if encoding=="utf8" then content.length else Buffer.from(content,"base64").length
          version = manager.getFileVersion(file)+1
          manager.setFileVersion file,version
          manager.setFileSize file,size
          if properties? and Object.keys(properties).length>0
            manager.setFileProperties file,properties
          manager.propagateFileChange null,file,version,content,manager.getFileProperties(file)
          @project.touch()

  removed:(relPath)->
    file = @toDashFile(relPath)
    return if not file?

    real = @storage.realPathForFile(file)
    @storage.consumeSelfWrite real,(isSelf)=>
      return if isSelf

      manager = @project.manager
      return if not manager?

      @project.deleteFileInfo(file)
      manager.propagateFileDeleted null,file
      @project.touch()

  # diff on-disk state against the project's cached file metadata (version/size/
  # properties) ; catches up on anything that changed while no session had the
  # project open (server was stopped, or nobody was editing)
  reconcile:(callback)->
    manager = @project.manager
    return callback?() if not manager?

    remaining = CONTENT_FOLDERS.slice()

    processFolder = ()=>
      return callback?() if remaining.length==0
      folder = remaining.splice(0,1)[0]

      @storage.list "#{@project.owner.id}/#{@project.id}/#{folder}",(files)=>
        files = files or []
        # only trust names that would also be accepted by a normal write -
        # otherwise reconcile could register a file the rest of the app (write/
        # rename validation) would refuse to touch
        files = (f for f in files when VALID_NAME.test("#{folder}/#{f}"))
        onDisk = {}
        onDisk[folder+"/"+f] = true for f in files

        for filepath of @project.files
          if filepath.indexOf(folder+"/")==0 and not onDisk[filepath]?
            @project.deleteFileInfo(filepath)

        return processFolder() if files.length==0

        pending = files.length
        checkDone = ()=>
          pending -= 1
          processFolder() if pending==0

        for f in files
          do (f)=>
            rel = folder+"/"+f
            real = @storage.realPathForFile(rel)
            fs.stat real,(err,stat)=>
              return checkDone() if err? or not stat?

              info = @project.getFileInfo(rel)
              if info.size != stat.size
                manager.setFileVersion rel,(manager.getFileVersion(rel)+1)
                manager.setFileSize rel,stat.size
                @storage.readProperties "#{@project.owner.id}/#{@project.id}/#{rel}",(props)=>
                  manager.setFileProperties rel,props if props? and Object.keys(props).length>0
                  checkDone()
              else
                checkDone()

    processFolder()

module.exports = @FolderWatcher
