simpleGit = require "simple-git"

# Thin wrapper around the user's own system git (via simple-git) for a project
# linked to a local folder. Deliberately does not vendor a git implementation:
# shelling out to the real `git` binary means the user's own SSH keys, credential
# helpers and hooks all just work, same as running git by hand in that folder.
class @GitManager
  constructor:(@project)->

  git:()-> simpleGit(@project.local_folder)

  requireLinked:(callback)->
    if not @project.local_folder
      callback({error:"project is not linked to a local folder"})
      false
    else
      true

  validRemoteName:(name)-> typeof name=="string" and /^[A-Za-z0-9_.-]{1,50}$/.test(name)
  validRemoteUrl:(url)-> typeof url=="string" and url.length>0 and url.length<500 and not /[\x00-\x1f]/.test(url)

  status:(callback)->
    return if not @requireLinked(callback)
    @git().status()
    .then (status)=>
      callback
        ok: true
        branch: status.current
        tracking: status.tracking
        ahead: status.ahead
        behind: status.behind
        not_added: status.not_added
        modified: status.modified
        created: status.created
        deleted: status.deleted
        conflicted: status.conflicted
        renamed: (r.to for r in status.renamed)
    .catch (err)=> callback({error:err.message})

  init:(callback)->
    return if not @requireLinked(callback)
    @git().init()
    .then ()=> callback({ok:true})
    .catch (err)=> callback({error:err.message})

  setRemote:(name,url,callback)->
    return if not @requireLinked(callback)
    return callback({error:"invalid remote name or url"}) if not @validRemoteName(name) or not @validRemoteUrl(url)
    g = @git()
    g.getRemotes()
    .then (remotes)=>
      exists = remotes.some (r)=> r.name==name
      if exists then g.remote(["set-url",name,url]) else g.addRemote(name,url)
    .then ()=> callback({ok:true})
    .catch (err)=> callback({error:err.message})

  commit:(message,callback)->
    return if not @requireLinked(callback)
    return callback({error:"empty commit message"}) if typeof message != "string" or message.trim().length==0
    g = @git()
    g.add(".")
    .then ()=> g.commit(message.substring(0,500))
    .then (result)=> callback({ok:true,summary:result.summary})
    .catch (err)=> callback({error:err.message})

  push:(callback)->
    return if not @requireLinked(callback)
    @git().push()
    .then ()=> callback({ok:true})
    .catch (err)=> callback({error:err.message})

  pull:(callback)->
    return if not @requireLinked(callback)
    @git().pull()
    .then ()=> callback({ok:true})
    .catch (err)=> callback({error:err.message})

  log:(callback)->
    return if not @requireLinked(callback)
    @git().log({maxCount:30})
    .then (result)=>
      callback
        ok: true
        entries: (
          for e in result.all
            hash: e.hash
            date: e.date
            message: e.message
            author: e.author_name
        )
    .catch (err)=> callback({error:err.message})

module.exports = @GitManager
