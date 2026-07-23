usage = require "pidusage"
User = require __dirname+"/user.js"
Project = require __dirname+"/project.js"
Token = require __dirname+"/token.js"
Translator = require __dirname+"/translator.js"
Cleaner = require __dirname+"/cleaner.js"

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

    @log_interval = setInterval (()=> @statusLog()),6000

    @translator = new Translator @

    @cleaner = new Cleaner @

  close:()->
    clearInterval @log_interval
    @cleaner.stop() if @cleaner?

  statusLog:()->
    usage process.pid,(err,result)=>
      return if not result?
      console.info "------------"
      console.info "#{new Date().toString()}"
      console.info "cpu: #{Math.round(result.cpu)}%"
      console.info "memory: #{Math.round(result.memory/1000000)} mb"
      console.info "users: #{@user_count}"
      console.info "projects: #{@project_count}"
      @current_cpu = Math.round(result.cpu)
      @current_memory = Math.round(result.memory/1000000)
      @server.stats.max("cpu_max",Math.round(result.cpu))
      @server.stats.max("memory_max",@current_memory)

  load:()->
    users = @db.list("users")
    for record in users
      @loadUser record

    if @server.config.standalone
      if @user_count>1
        throw "Error, cannot run standalone if user_count>1"
      else if @user_count == 0
        user = @createUser
          nick: "microstudio"
          email: "standalone@microstudio.dev"
          flags: {validated: true}
          hash: "---"
          date_created: Date.now()
          last_active: Date.now()
          creation_ip: "127.0.0.1"

      @users[0].max_storage = 10000000000

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

  setProjectTags:(project,tags)->
    project.set "tags",tags

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

  changeUserNick:(user,nick)->
    delete @users_by_nick[user.nick]
    user.set "nick",nick
    @users_by_nick[nick] = user

  changeUserEmail:(user,email)->
    if user.email?
      delete @users_by_email[user.email]
    else
      @guest_count -= 1
    user.set "email",email
    @users_by_email[email] = user

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
      language: data.language
      graphics: data.graphics
      libs: data.libs
      tabs: data.tabs
      plugins: data.plugins
      libraries: data.libraries
      description: data.description or ""

    record = @db.create "projects",d
    project = @loadProject record
    if empty
      callback(project)
    else
      if project.language? and DEFAULT_CODE[project.language]?
        content = DEFAULT_CODE[project.language]
      else
        content = DEFAULT_CODE.microscript

      @files.write "#{owner.id}/#{project.id}/ms/main.ms",content,()=>
        @files.copyFile "../static/img/defaultappicon.png","#{owner.id}/#{project.id}/sprites/icon.png",()=>
          callback(project)

  getConsoleGameList:()->
    list = []
    for key,p of @projects
      if p.public and not p.deleted
        list.push
          author: p.owner.nick
          slug: p.slug
          title: p.title

    list

  sendValidationMail:(user)->
    return if not user.email?
    token = user.getValidationToken()
    translator = @translator.getTranslator(user.language)
    subject = translator.get("Microstudio e-mail validation")
    text = translator.get("Thank you for using Microstudio!")+"\n\n"
    text += translator.get("Click on the link below to validate your e-mail address:")+"\n\n"
    text += "https://microstudio.dev/v/#{user.id}/#{token}"+"\n\n"

    @server.mailer.sendMail user.email,subject,text

  sendPasswordRecoveryMail:(user)->
    return if not user.email?
    token = user.getValidationToken()
    translator = @translator.getTranslator(user.language)
    subject = translator.get("Reset your microStudio password")
    text = translator.get("Click on the link below to choose a new microStudio password:")+"\n\n"
    text += "https://microstudio.dev/pw/#{user.id}/#{token}"+"\n\n"
    @server.mailer.sendMail user.email,subject,text

  checkValidationToken:(user,token)->
    token == user.getValidationToken()

  validateEMailAddress:(user,token)->
    console.info "verifying #{token} against #{user.getValidationToken()}"
    if token? and token.length>0 and @checkValidationToken(user,token)
      user.resetValidationToken()
      user.setFlag("validated",true)
      translator = @translator.getTranslator(user.language)
      user.notify translator.get "Your e-mail address is now validated"


DEFAULT_CODE =
  python: """
def init():
  pass

def update():
  pass

def draw():
  pass
  """
  javascript: """
init = function() {
}

update = function() {
}

draw = function() {
}
  """
  lua: """
init = function()
end

update = function()
end

draw = function()
end
  """
  microscript: """
init = function()
end

update = function()
end

draw = function()
end
  """


module.exports = @Content
