class @AppState
  constructor:(@app)->
    window.addEventListener "popstate",(event)=>@popState()

  pushState:(name,path,obj = {})->
    console.info "pushing state\nname=#{name}\npath=#{path}"
    if history.state? and history.state.name != name
      obj.name = name
      history.pushState obj,"",path

  popState:()->
    if history.state?
      s = history.state.name.split(".")
      if history.state.name in ["documentation","about","projects"]
        if history.state.name == "projects"
          if @app.project and @app.project.pending_changes.length>0
            history.forward()
            alert("Please wait while saving your changes...")
          else
            @app.appui.backToProjectList()
        @app.appui.setMainSection ((p)->{"documentation":"help"}[p] or p)(history.state.name)
      else if history.state.name == "home"
        @app.appui.setMainSection "projects"
      else if history.state.name.startsWith("project.") and s[1]? and s[2]?
        project = s[1]
        if not @app.project? or @app.project.slug != project
          if @app.projects
            for p in @app.projects
              if p.slug == project
                @app.openProject(p,false)
                break

        @app.appui.setMainSection "projects"
        @app.appui.setSection s[2]
      else if history.state.name.startsWith("documentation")
        s = history.state.name.split(".")
        if s[1]
          @app.documentation.setSection s[1]
          @app.appui.setMainSection "help"
        else
          @app.appui.setMainSection "help"
  stateInitialized:()->
    console.info "state initialized"
    @app.documentation.stateInitialized()

  initState:()->
    for p in ["about","documentation"]
      if location.pathname.startsWith("/#{p}/") or location.pathname == "/#{p}"
        history.replaceState {name:p},"",location.pathname
        if p == "documentation"
          path = location.pathname.split("/")
          if path[2]
            @app.documentation.setSection path[2],null,null,false

        @app.appui.setMainSection ((p)=>{"documentation":"help"}[p] or p)(p)
        @stateInitialized()
        return

    s = location.pathname.split("/")
    if location.pathname.startsWith("/projects/") and s[2] and s[3]
      history.replaceState {name:"project.#{s[2]}.#{s[3]}"},"",location.pathname
    else
      @app.appui.setMainSection("projects")
      history.replaceState {name:"projects"},"","/projects/"

    @stateInitialized()

  projectsFetched:()->
    if history.state? and history.state.name?
      if history.state.name.startsWith "project."
        @popState()
