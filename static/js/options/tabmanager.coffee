class @TabManager
  constructor:(@app)->
    @initProjectTabSelection()

  projectOpened:()->
    @updateProjectTabs()

  projectClosed:()->

  tabOpened:()->
    @updateProjectTabSelection()

  isTabActive:(tab)->
    project = @app.project
    return false if not project
    tabs = project.tabs or {}
    if tabs[tab]? then tabs[tab] else TabManager.DEFAULT_TABS[tab]

  setTabActive:(tab,active)->
    project = @app.project
    return if not project
    project.tabs = {} if not project.tabs?
    project.tabs[tab] = active
    @updateProjectTabs()
    @app.client.sendRequest {
      name: "set_project_option"
      project: project.id
      option: "tabs"
      value: project.tabs
    },(msg)=>

  updateProjectTabSelection:()->
    for tab of TabManager.DEFAULT_TABS
      element = document.getElementById("project-option-active-tab-#{tab}")
      element.checked = @isTabActive(tab) if element?

  updateProjectTabs:()->
    for tab of TabManager.DEFAULT_TABS
      element = document.getElementById("menuitem-#{tab}")
      element.style.display = if @isTabActive(tab) then "block" else "none" if element?

  initProjectTabSelection:()->
    for tab of TabManager.DEFAULT_TABS
      do (tab)=>
        element = document.getElementById("project-option-active-tab-#{tab}")
        element.addEventListener "change",()=>@setTabActive(tab,element.checked) if element?

  @DEFAULT_TABS =
    code: true
    sprites: true
    maps: true
    sounds: true
    music: true
    assets: false
    doc: true
    publish: true
