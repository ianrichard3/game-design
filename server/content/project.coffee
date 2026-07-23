Comments = require __dirname+"/comments.js"
FolderStorage = require __dirname+"/../filestorage/folderstorage.js"
JobQueue = require __dirname+"/../app/jobqueue.js"

fs = require "fs"

CONTENT_FOLDERS = ["ms","sprites","maps","sounds","music","assets","doc"]
AUX_FOLDERS = ["ms","sprites","maps","sounds","sounds_th","music","music_th","assets","assets_th","doc"]
isTextFile = (name)-> name.endsWith(".ms") or name.endsWith(".json") or name.endsWith(".md")


class @Project
  constructor:(@content,@record)->
    data = @record.get()
    @deleted = data.deleted
    if @deleted
      if data.slug?
        @record.set
          deleted: true

    if not @deleted
      @id = data.id
      @local_folder = data.local_folder or null
      @title = data.title
      @slug = data.slug
      @code = data.code or @createCode()
      @tags = data.tags or []
      @flags = data.flags or {}
      @description = data.description or ""
      @likes = 0
      if data.public
        data.public = false
        @record.set data
      @public = false
      @unlisted = data.unlisted
      @date_created = data.date_created
      @last_modified = data.last_modified
      @first_published = data.first_published or 0
      @orientation = data.orientation or "any"
      @aspect = data.aspect or "free"
      @graphics = data.graphics or "M1"
      @language = data.language or "microscript_v1_i"
      @platforms = data.platforms or ["computer","phone","tablet"]
      @controls = data.controls or ["touch","mouse"]
      @libs = data.libs or []
      @tabs = data.tabs
      @plugins = data.plugins
      @libraries = data.libraries
      @properties = data.properties or {}
      @type = if data.type in ["app","library"] then data.type else "app"
      @users = []
      @comments = new Comments @,data.comments
      if not @deleted
        @owner = @content.users[data.owner]
        if @owner?
          @owner.addProject @

      if data.files? and not @deleted
        @files = data.files
      else
        @files = {}

      @update_project_size = true
      @checkStringField "title", 100
      @checkStringField "slug", 100
      @checkStringField "code", 200
      @checkStringField "description", 10000

  checkStringField:( field, size )->
    if typeof @[field] == "string"
      if @[field].length > size
        console.info( "field "+field+" oversize: " + @[field].length )
        @set( field, @[field].substring( 0, size ) )


  createCode:()->
    letters = "ABCDEFGHJKMNPRSTUVWXYZ23456789"
    code = ""
    for i in [0..7] by 1
      code += ""+letters.charAt(Math.floor(Math.random()*letters.length))
    @set("code",code)
    code

  touch:()->
    @last_modified = Date.now()
    data = @record.get()
    data.last_modified = @last_modified
    @record.set data

  set:(prop,value,update_local=true)->
    data = @record.get()
    data[prop] = value
    @record.set(data)
    @[prop] = value if update_local
    @writeLocalMetadata() if @local_folder and prop != "files"

  setTitle:(title)->
    if title? and title.trim().length>0 and title.length<50
      @set "title",title
      true
    else
      false

  setSlug:(slug)->
    if slug? and /^([a-z0-9_][a-z0-9_-]{0,29})$/.test(slug)
      return false if @owner.findProjectBySlug(slug)?
      @set "slug",slug
      true
    else
      false

  setCode:(code)->
    if code? and /^([a-zA-Z0-9_][a-zA-Z0-9_-]{0,29})$/.test(code)
      @set "code",code
      true
    else
      false

  setType:(type)->
    return false if type not in ["app","library"]
    @set "type",type
    true

  setOrientation:(orientation)->
    @set "orientation",orientation

  setAspect:(aspect)->
    @set "aspect",aspect

  setGraphics:(graphics)->
    @set "graphics",graphics

  setFlag:(flag,value)->
    if value
      @flags[flag] = value
    else
      delete @flags[flag]
    @set "flags",@flags

  setProperty:(prop,value)->
    if value?
      @properties[prop] = value
    else
      delete @properties[prop]
    @set "properties",@properties
    
  delete:()->
    @deleted = true
    @record.set
      deleted: true
    @content.projectDeleted @
    if @local_folder
      # a linked project's storage is the user's own folder (their git repo) -
      # deleting the project must never touch it, just stop watching it
      @manager?.stopFolderWatcher()
    else
      folder = "#{@owner.id}/#{@id}"
      @content.files.deleteFolder folder

    delete @manager

    return

  getFileInfo:(file)->
    @files[file] || {}

  setFileInfo:(file,key,value)->
    info = @getFileInfo(file)
    info[key] = value
    @files[file] = info
    @set "files",@files
    @update_project_size = true

  deleteFileInfo:(file)->
    delete @files[file]
    @set "files",@files
    @update_project_size = true

  getSize:()->
    if @update_project_size
      @updateProjectSize()

    @byte_size

  updateProjectSize:()->
    @byte_size = 0
    @update_project_size = false
    for key,file of @files
      if file.size?
        @byte_size += file.size
    return

  filenameChanged:(previous,next)->
    if @files[previous]?
      @files[next] = @files[previous]
      delete @files[previous]
      @set "files",@files

  fileDeleted:(file)->
    if @files[file]
      delete @files[file]
      @set "files",@files

  # Storage backend for this project's files: the shared internal FileStorage,
  # unless this project is linked to a local folder, in which case that folder
  # is the single source of truth for its files.
  getStorage:()->
    if @local_folder
      if not @folder_storage? or @folder_storage.folder != @local_folder
        @folder_storage = new FolderStorage @local_folder
      @folder_storage
    else
      @content.files

  localMetadata:()->
    owner: @owner.nick
    title: @title
    slug: @slug
    tags: @tags
    orientation: @orientation
    aspect: @aspect
    platforms: @platforms
    controls: @controls
    type: @type
    language: @language
    graphics: @graphics
    libs: @libs
    tabs: @tabs
    plugins: @plugins
    libraries: @libraries
    date_created: @date_created
    description: @description

  # Debounced: option changes can fire once per keystroke (e.g. editing the
  # title), and unordered concurrent writes to the same project.json would
  # otherwise race ; collapsing rapid-fire calls into one write avoids that.
  writeLocalMetadata:()->
    return if not @local_folder
    clearTimeout @local_metadata_timer if @local_metadata_timer?
    @local_metadata_timer = setTimeout (()=>
      @local_metadata_timer = null
      return if not @local_folder
      fs.writeFile "#{@local_folder}/project.json",JSON.stringify(@localMetadata(),null,2),()=>
    ),500

  # Links this project to a real folder on disk, which becomes its storage from
  # then on. An empty (or new) folder is populated from the project's current
  # files ; a folder that already looks like a microStudio project (and whose
  # project currently has no files of its own, e.g. after a git clone) is
  # adopted instead. Refuses anything ambiguous rather than risk data loss.
  setLocalFolder:(folder,callback)->
    return callback("A folder link/unlink operation is already in progress") if @folder_op_in_progress
    check = @content.server.checkProjectFolder(folder)
    return callback(check.error) if check.error

    folder = check.resolved

    exists = fs.existsSync(folder)
    entries = if exists then fs.readdirSync(folder).filter((e)=> e!=".git" and e!=".DS_Store") else []
    hasOwnFiles = false
    for k of @files
      hasOwnFiles = true
      break

    finish = ()=>
      @manager?.stopFolderWatcher()
      @local_folder = folder
      @folder_storage = null
      @set "local_folder",folder
      @manager?.startFolderWatcher()
      @folder_op_in_progress = false
      callback(null)

    @folder_op_in_progress = true

    if entries.length==0
      dest = new FolderStorage folder
      @exportToFolder dest,()=>
        @writeLocalMetadata()
        finish()
    else if not hasOwnFiles
      @importFromFolder (new FolderStorage folder),()=> finish()
    else
      @folder_op_in_progress = false
      callback("Target folder must be empty, or the project must have no files yet")

  unlinkLocalFolder:(callback)->
    return callback(null) if not @local_folder
    return callback("A folder link/unlink operation is already in progress") if @folder_op_in_progress

    @folder_op_in_progress = true
    src = @getStorage()
    dest = @content.files
    queue = new JobQueue ()=>
      @manager?.stopFolderWatcher()
      @local_folder = null
      @folder_storage = null
      @set "local_folder",null
      @folder_op_in_progress = false
      callback(null)

    for folder in AUX_FOLDERS
      do (folder)=>
        queue.add ()=>
          src.list "#{@owner.id}/#{@id}/#{folder}",(files)=>
            files = files or []
            filequeue = new JobQueue ()=> queue.next()
            for f in files
              do (f)=>
                filequeue.add ()=>
                  full = "#{@owner.id}/#{@id}/#{folder}/#{f}"
                  encoding = if isTextFile(f) then "utf8" else "binary"
                  src.read full,encoding,(content)=>
                    if content?
                      dest.write full,content,()=> filequeue.next()
                    else
                      console.error "unlinkLocalFolder: failed to read #{full}, skipping"
                      filequeue.next()
            filequeue.start()
    queue.start()

  exportToFolder:(dest,callback)->
    # source from whatever storage is currently authoritative for this project
    # (internal storage, or another folder if it's already linked elsewhere) -
    # never assume internal storage, or re-linking an already-linked project
    # would silently export stale/empty data over the destination
    src = @getStorage()
    queue = new JobQueue ()=> callback()

    for folder in AUX_FOLDERS
      do (folder)=>
        queue.add ()=>
          src.list "#{@owner.id}/#{@id}/#{folder}",(files)=>
            files = files or []
            filequeue = new JobQueue ()=> queue.next()
            for f in files
              do (f)=>
                filequeue.add ()=>
                  full = "#{@owner.id}/#{@id}/#{folder}/#{f}"
                  encoding = if isTextFile(f) then "utf8" else "binary"
                  src.read full,encoding,(content)=>
                    if not content?
                      console.error "exportToFolder: failed to read #{full}, skipping"
                      return filequeue.next()
                    dest.write full,content,()=>
                      props = @getFileInfo("#{folder}/#{f}").properties
                      if props? and Object.keys(props).length>0
                        dest.writeProperties full,props,()=> filequeue.next()
                      else
                        filequeue.next()
            filequeue.start()
    queue.start()

  importFromFolder:(src,callback)->
    queue = new JobQueue ()=> callback()

    for folder in CONTENT_FOLDERS
      do (folder)=>
        queue.add ()=>
          src.list "#{@owner.id}/#{@id}/#{folder}",(files)=>
            files = files or []
            filequeue = new JobQueue ()=> queue.next()
            for f in files
              do (f)=>
                filequeue.add ()=>
                  rel = "#{folder}/#{f}"
                  full = "#{@owner.id}/#{@id}/#{rel}"
                  encoding = if isTextFile(f) then "utf8" else "binary"
                  src.read full,encoding,(content)=>
                    if not content?
                      console.error "importFromFolder: failed to read #{full}, skipping"
                      return filequeue.next()
                    @setFileInfo rel,"size",content.length
                    @setFileInfo rel,"version",1
                    src.readProperties full,(props)=>
                      @setFileInfo rel,"properties",(props or {})
                      filequeue.next()
            filequeue.start()
    queue.start()

  updateFileSizes:(callback)->
    source = "../files/"+@content.files.sanitize "#{@owner.id}/#{@id}/ms"
    sprites = "../files/"+@content.files.sanitize "#{@owner.id}/#{@id}/sprites"
    maps = "../files/"+@content.files.sanitize "#{@owner.id}/#{@id}/maps"

    list = []

    process = ()=>
      if list.length>0
        f = list.splice(0,1)[0]
        file = "../files/"+@content.files.sanitize "#{@owner.id}/#{@id}/#{f}"
        fs.lstat file,(err,stat)=>
          if stat? and stat.size?
            @setFileInfo f,"size",stat.size
          setTimeout (()=>process()),0
      else
        callback() if callback?

    fs.readdir source,(err,files)=>
      if files
        for f in files
          list.push "ms/#{f}"
      fs.readdir sprites,(err,files)=>
        if files
          for f in files
            list.push "sprites/#{f}"
        fs.readdir maps,(err,files)=>
          if files
            for f in files
              list.push "maps/#{f}"
          process()


module.exports = @Project
