User = require __dirname+"/user.js"
Project = require __dirname+"/project.js"
Token = require __dirname+"/token.js"
Translator = require __dirname+"/translator.js"

class @Content
  constructor:(@server,@db,@files)->
    @users = {}
    @users_by_email = {}
    @users_by_nick = {}

    @tokens = {}

    @projects = {}

    @project_count = 0
    @user_count = 0
    @guest_count = 0

    @load()

    console.info "Content loaded: #{@user_count} users and #{@project_count} projects"

    @translator = new Translator @

  close:()->
    return

  load:()->
    users = @db.list("users")
    for record in users
      @loadUser record

    if @user_count>1
      throw "Error, cannot run local single-user mode if user_count>1"
    else if @user_count == 0
      @local_user = @createUser
        nick: "microstudio"
        email: "standalone@microstudio.dev"
        flags: {validated: true}
        hash: "---"
        date_created: Date.now()
        last_active: Date.now()
        creation_ip: "127.0.0.1"
    else
      for id,user of @users
        @local_user = user
        break

    @local_user.max_storage = 10000000000

    tokens = @db.list("tokens")
    for token in tokens
      @loadToken token

    projects = @db.list("projects")
    for record in projects
      @loadProject record

    return

  loadUser:(record)->
    data = record.get()
    user = new User @,record
    return if user.flags.deleted
    @users[user.id] = user
    if user.email?
      @users_by_email[user.email] = user
    else
      @guest_count += 1
    @users_by_nick[user.nick] = user
    @user_count++
    user

  loadProject:(record)->
    data = record.get()
    project = new Project @,record
    if project.owner? and not project.deleted
      @projects[project.id] = project
      @project_count++
    project

  loadToken:(record)->
    data = record.get()
    token = new Token @,record
    if token.user?
      @tokens[token.value] = token
    token

  setProjectType:(project,type)->
    project.setType(type)

  projectDeleted:(project)->
    @project_count -= 1

  createUser:(data)->
    record = @db.create "users",data
    @loadUser record

  createToken:(user)->
    value = ""
    chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    for i in [0..31] by 1
      value += chars.charAt(Math.floor(Math.random()*chars.length))

    record = @db.create "tokens",
      value: value
      user: user.id
      date_created: Date.now()

    @loadToken record

  findUserByNick:(nick)->
    @users_by_nick[nick]

  findUserByEmail:(email)->
    @users_by_email[email]

  userDeleted:(user)->
    delete @users_by_nick[user.nick]
    if user.email?
      delete @users_by_email[user.email]
    else
      @guest_count -= 1
    @user_count -= 1

  findToken:(token)->
    @tokens[token]

  createProject:(owner,data,callback,empty=false)->
    slug = data.slug
    if owner.findProjectBySlug(slug)
      count = 2
      while owner.findProjectBySlug(slug+count)?
        count += 1
      data.slug = slug+count

    d =
      title: data.title
      slug: data.slug
      tags: []
      likes: []
      public: false
      date_created: Date.now()
      last_modified: Date.now()
      deleted: false
      owner: owner.id
      orientation: data.orientation
      aspect: data.aspect
      type: if data.type in ["app","library"] then data.type else "app"
      language: "microscript_v2"
      graphics: "M1"
      libs: data.libs
      libraries: data.libraries
      description: data.description or ""

    record = @db.create "projects",d
    project = @loadProject record
    if empty
      callback(project)
    else
      content = DEFAULT_CODE

      @files.write "#{owner.id}/#{project.id}/ms/main.ms",content,()=>
        @files.copyFile "../static/img/defaultappicon.png","#{owner.id}/#{project.id}/sprites/icon.png",()=>
          callback(project)

DEFAULT_CODE = """
init = function()
end

update = function()
end

draw = function()
end
"""


module.exports = @Content
