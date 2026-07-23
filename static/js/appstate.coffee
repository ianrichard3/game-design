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
        @app.appui.setMainSection "home"
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
      else if history.state.name.startsWith("user.") and s[1]?
        switch s[1]
          when "settings"
            @app.appui.setMainSection("usersettings")
            @app.user_settings.setSection("settings")

          when "profile"
            @app.appui.setMainSection("usersettings")
            @app.user_settings.setSection("profile")

          when "progress"
            @app.appui.setMainSection("usersettings")
            @app.user_settings.setSection("progress")

  stateInitialized:()->
    console.info "state initialized"
    @app.documentation.stateInitialized()

  initState:()->
    if location.pathname.startsWith("/login/")
      path = if @app.translator.lang != "en" then "/#{@app.translator.lang}/" else "/"
      history.replaceState {name:"home"},"",path
      @app.appui.setMainSection("home")
      @app.appui.showLoginPanel()
    else
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

      if @app.user?
        s = location.pathname.split("/")
        if location.pathname.startsWith("/projects/") and s[2] and s[3]
          project = s[2]
          tab = s[3]
          history.replaceState {name:"project.#{s[2]}.#{s[3]}"},"",location.pathname
        else if location.pathname.startsWith("/user/") and s[2]
          switch s[2]
            when "settings"
              @app.appui.setMainSection("usersettings")
              @app.user_settings.setSection("settings")

            when "profile"
              @app.appui.setMainSection("usersettings")
              @app.user_settings.setSection("profile")

            when "progress"
              @app.appui.setMainSection("usersettings")
              @app.user_settings.setSection("progress")

        else
          @app.appui.setMainSection("projects")
          history.replaceState {name:"projects"},"","/projects/"
      else
        path = if @app.translator.lang != "en" then "/#{@app.translator.lang}/" else "/"
        history.replaceState {name:"home"},"",path
        @app.appui.setMainSection("home")

    @stateInitialized()

  projectsFetched:()->
    if history.state? and history.state.name?
      if history.state.name.startsWith "project."
        @popState()
