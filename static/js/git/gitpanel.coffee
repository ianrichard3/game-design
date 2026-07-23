class @GitPanel
  constructor:(@app)->
    @app.appui.setAction "git-refresh",()=> @refresh()
    @app.appui.setAction "git-init",()=> @init()
    @app.appui.setAction "git-set-remote",()=> @setRemote()
    @app.appui.setAction "git-commit",()=> @commit()
    @app.appui.setAction "git-push",()=> @push()
    @app.appui.setAction "git-pull",()=> @pull()

  projectOpened:()->
    @reset()

  reset:()->
    document.getElementById("git-commit-message").value = ""
    document.getElementById("git-remote-url").value = ""
    document.getElementById("git-changed-files").innerHTML = ""
    document.getElementById("git-log-list").innerHTML = ""
    @showError ""
    @updatePanelVisibility()

  updatePanelVisibility:()->
    linked = @app.project.local_folder?
    document.getElementById("git-panel-unlinked").style.display = if linked then "none" else "block"
    document.getElementById("git-panel-linked").style.display = if linked then "block" else "none"
    if linked
      @refresh()
      @loadLog()

  showError:(text)->
    document.getElementById("git-panel-error").innerText = text or ""

  send:(msg,callback)->
    msg.project = @app.project.id
    @app.client.sendRequest msg,(result)=>
      if result.error?
        @showError result.error
      else
        @showError ""
      callback(result) if callback?

  refresh:()->
    @send {name:"git_status"},(result)=>
      return if result.error?

      document.getElementById("git-branch").innerText = @app.translator.get("Branch: %BRANCH%").replace("%BRANCH%",result.branch or "-")

      ahead_behind = ""
      ahead_behind += @app.translator.get("%N% ahead").replace("%N%",result.ahead) + " " if result.ahead>0
      ahead_behind += @app.translator.get("%N% behind").replace("%N%",result.behind) if result.behind>0
      document.getElementById("git-ahead-behind").innerText = ahead_behind

      list = document.getElementById("git-changed-files")
      list.innerHTML = ""

      addLine = (type,file)=>
        div = document.createElement "div"
        div.classList.add type
        div.innerHTML = """<i class="fa"></i> #{file}"""
        list.appendChild div

      addLine "create",f for f in (result.not_added or [])
      addLine "sync",f for f in (result.modified or [])
      addLine "upgrade",f for f in (result.created or [])
      addLine "delete",f for f in (result.deleted or [])
      addLine "downgrade",f for f in (result.conflicted or [])

      if list.innerHTML == ""
        list.innerHTML = """<div>#{@app.translator.get("Working tree clean")}</div>"""

  init:()->
    @send {name:"git_init"},(result)=>
      @refresh() if not result.error?

  setRemote:()->
    url = document.getElementById("git-remote-url").value.trim()
    return if url.length == 0
    @send {name:"git_set_remote", remote_name:"origin", url:url},(result)=>
      @refresh() if not result.error?

  commit:()->
    message = document.getElementById("git-commit-message").value.trim()
    return @showError @app.translator.get("Enter a commit message first") if message.length == 0
    @send {name:"git_commit", message:message},(result)=>
      if not result.error?
        document.getElementById("git-commit-message").value = ""
        @refresh()
        @loadLog()

  push:()->
    @send {name:"git_push"},(result)=>
      @refresh() if not result.error?

  pull:()->
    @send {name:"git_pull"},(result)=>
      @refresh() if not result.error?

  loadLog:()->
    @send {name:"git_log"},(result)=>
      return if result.error?
      list = document.getElementById("git-log-list")
      list.innerHTML = ""
      for entry in (result.entries or [])
        div = document.createElement "div"
        div.classList.add "gitlogentry"
        date = new Date(entry.date).toLocaleString()
        div.innerHTML = """<span class="hash">#{entry.hash.substring(0,7)}</span> <span class="message">#{entry.message}</span> <span class="meta">#{entry.author} - #{date}</span>"""
        list.appendChild div
