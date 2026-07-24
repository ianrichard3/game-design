var Concatenator, ExportFeatures, Fonts, Jimp, JimpMime, ProjectManager, ResizeStrategy, fs, pug, ref;

pug = require("pug");

fs = require("fs");

ProjectManager = require(__dirname + "/session/projectmanager.js");

ref = require("jimp"), Jimp = ref.Jimp, JimpMime = ref.JimpMime, ResizeStrategy = ref.ResizeStrategy;

Concatenator = require(__dirname + "/concatenator.js");

Fonts = require(__dirname + "/fonts.js");

ExportFeatures = require(__dirname + "/app/exportfeatures.js");

this.WebApp = (function() {
  function WebApp(server, app) {
    var home_exp;
    this.server = server;
    this.app = app;
    this.code = "";
    fs.readFile("../templates/play/manifest.json", (function(_this) {
      return function(err, data) {
        return _this.manifest_template = data;
      };
    })(this));
    this.concatenator = new Concatenator(this);
    this.fonts = new Fonts;
    this.export_features = new ExportFeatures(this);
    this.home_page = {};
    this.reserved = ["documentation", "projects", "about"];
    home_exp = "^(\\/|\\/documentation|\\/documentation\\/.*|\\/projects|\\/projects\\/.*|\\/about|\\/about\\/.*)$";
    console.info("home_exp = " + home_exp);
    this.app.get(new RegExp(home_exp), (function(_this) {
      return function(req, res) {
        var lang, s, translator;
        lang = "en";
        if ((_this.home_funk == null) || !_this.server.use_cache) {
          _this.home_funk = pug.compileFile("../templates/home.pug");
        }
        s = req.path.split("/");
        if (s[1] === "about") {
          res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        }
        if ((_this.home_page[lang] == null) || !_this.server.use_cache) {
          translator = _this.server.content.translator.getTranslator(lang);
          _this.home_page[lang] = _this.home_funk({
            name: "microStudio",
            javascript_files: _this.concatenator.getHomeJSFiles(),
            css_files: _this.concatenator.getHomeCSSFiles(),
            translator: translator,
            language: lang,
            optional_libs: _this.concatenator.optional_libs,
            language_engines: _this.concatenator.language_engines,
            title: "microStudio - " + translator.get("Game Engine"),
            description: translator.get("A local game engine for code and assets."),
            long_description: translator.get("A local, code-centric game engine with integrated creative tools."),
            poster: "/img/microstudio.jpg"
          });
        }
        return res.send(_this.home_page[lang]);
      };
    })(this));
    this.app.get(/^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+\/?)?)?$/, (function(_this) {
      return function(req, res) {
        var access, encoding, file, i, jsfiles, l, len, lib, manager, pathcode, poster, prog_lang, project, redir, ref1, user;
        access = _this.getProjectAccess(req, res);
        if (access == null) {
          return;
        }
        user = access.user;
        project = access.project;
        if (req.path.charAt(req.path.length - 1) !== "/") {
          redir = req.protocol + '://' + req.get("host") + req.url + "/";
          console.info("redirecting to: " + redir);
          return res.redirect(redir);
        }
        file = user.id + "/" + project.id + "/ms/main.ms";
        encoding = "text";
        manager = _this.getProjectManager(project);
        jsfiles = _this.concatenator.getPlayerJSFiles(project.graphics);
        ref1 = project.libs;
        for (i = 0, len = ref1.length; i < len; i++) {
          lib = ref1[i];
          l = _this.concatenator.findOptionalLib(lib);
          if (l) {
            jsfiles.push(l.lib);
          }
        }
        prog_lang = project.language;
        if (_this.concatenator.language_engines[prog_lang] != null) {
          jsfiles = jsfiles.concat(_this.concatenator.language_engines[prog_lang].scripts);
          jsfiles = jsfiles.concat(_this.concatenator.language_engines[prog_lang].lib);
        }
        pathcode = project["public"] ? project.slug : project.slug + "/" + project.code;
        poster = (project.files != null) && (project.files["sprites/poster.png"] != null) ? "https://microstudio.io/" + user.nick + "/" + pathcode + "/sprites/poster.png" : "https://microstudio.io/" + user.nick + "/" + pathcode + "/icon512.png";
        return manager.listFiles("ms", function(sources) {
          return manager.listFiles("sprites", function(sprites) {
            return manager.listFiles("maps", function(maps) {
              return manager.listFiles("sounds", function(sounds) {
                return manager.listFiles("music", function(music) {
                  return manager.listFiles("assets", function(assets) {
                    var pf, resources;
                    resources = JSON.stringify({
                      sources: sources,
                      images: sprites,
                      maps: maps,
                      sounds: sounds,
                      music: music,
                      assets: assets
                    });
                    resources = "var resources = " + resources + ";\n";
                    if ((_this.play_funk == null) || !_this.server.use_cache) {
                      _this.play_funk = pug.compileFile("../templates/play/play.pug");
                    }
                    pf = _this.play_funk;
                    return res.send(pf({
                      user: user,
                      javascript_files: jsfiles,
                      fonts: _this.fonts.fonts,
                      debug: (req.query != null) && (req.query.debug != null),
                      language: project.language,
                      translator: _this.server.content.translator.getTranslator(_this.getLanguage(req)),
                      game: {
                        name: project.slug,
                        pathcode: pathcode,
                        title: project.title,
                        author: user.nick,
                        resources: resources,
                        orientation: project.orientation,
                        aspect: project.aspect,
                        graphics: project.graphics,
                        libs: JSON.stringify(project.libs),
                        description: project.description,
                        poster: poster
                      }
                    }));
                  });
                });
              });
            });
          });
        });
      };
    })(this));
    this.app.get(/^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/manifest.json$/, (function(_this) {
      return function(req, res) {
        var access, iconversion, manager, mani, path, project, s, user;
        access = _this.getProjectAccess(req, res);
        if (access == null) {
          return;
        }
        user = access.user;
        project = access.project;
        manager = _this.getProjectManager(project);
        iconversion = manager.getFileVersion("sprites/icon.png");
        path = project["public"] ? "/" + user.nick + "/" + project.slug + "/" : "/" + user.nick + "/" + project.slug + "/" + project.code + "/";
        res.setHeader("Content-Type", "application/json");
        s = req.path.split("/");
        mani = _this.manifest_template.toString().replace(/SCOPE/g, path);
        mani = mani.toString().replace("APPNAME", project.title);
        mani = mani.toString().replace("APPSHORTNAME", project.title);
        mani = mani.toString().replace("ORIENTATION", project.orientation);
        mani = mani.toString().replace(/USER/g, user.nick);
        mani = mani.toString().replace(/PROJECT/g, project.slug);
        mani = mani.toString().replace(/ICONVERSION/g, iconversion);
        mani = mani.replace("START_URL", path);
        return res.send(mani);
      };
    })(this));
    this.app.get(/^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/sw.js$/, (function(_this) {
      return function(req, res) {
        var access, project, user;
        access = _this.getProjectAccess(req, res);
        if (access == null) {
          return;
        }
        user = access.user;
        project = access.project;
        return fs.readFile("../static/sw.js", function(err, data) {
          res.setHeader("Content-Type", "application/javascript");
          return res.send(data);
        });
      };
    })(this));
    this.app.get(/^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/icon[0-9]+.png$/, (function(_this) {
      return function(req, res) {
        var access, project, size, user;
        access = _this.getProjectAccess(req, res);
        if (access == null) {
          return;
        }
        user = access.user;
        project = access.project;
        size = req.path.split("icon");
        size = size[size.length - 1];
        size = Math.min(1024, size.split(".")[0] | 0);
        return project.getStorage().read(user.id + "/" + project.id + "/sprites/icon.png", "binary", function(iconData) {
          if (iconData == null) {
            _this.return404(req, res);
            return;
          }
          return Jimp.read(iconData).then(function(img) {
            return img.resize({
              w: size,
              h: size,
              mode: ResizeStrategy.NEAREST_NEIGHBOR
            }).getBuffer(JimpMime.png).then(function(buffer) {
              res.setHeader("Content-Type", "image/png");
              return res.send(buffer);
            })["catch"](function(err) {
              console.error(err);
              return _this.return404(req, res);
            });
          })["catch"](function(err) {
            console.error(err);
            return _this.return404(req, res);
          });
        });
      };
    })(this));
    this.app.get(/^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/ms\/[A-Za-z0-9_-]+.ms$/, (function(_this) {
      return function(req, res) {
        var access, ms, project, s, user;
        s = req.path.split("/");
        access = _this.getProjectAccess(req, res);
        if (access == null) {
          return;
        }
        user = access.user;
        project = access.project;
        ms = s[s.length - 1];
        return project.getStorage().read(user.id + "/" + project.id + "/ms/" + ms, "text", function(content) {
          if (content != null) {
            res.setHeader("Content-Type", "application/javascript");
            return res.send(content);
          } else {
            console.info("couldn't read file: " + req.path);
            return res.status(404).send("Error 404");
          }
        });
      };
    })(this));
    this.app.get(/^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/(assets_th|sounds_th|music_th)\/[A-Za-z0-9_-]+.png$/, (function(_this) {
      return function(req, res) {
        var access, asset, folder, project, s, user;
        s = req.path.split("/");
        access = _this.getProjectAccess(req, res);
        if (access == null) {
          return;
        }
        user = access.user;
        project = access.project;
        folder = s[s.length - 2];
        asset = s[s.length - 1];
        return project.getStorage().read(user.id + "/" + project.id + "/" + folder + "/" + asset, "binary", function(content) {
          if (content != null) {
            res.setHeader("Content-Type", "image/png");
            return res.send(content);
          } else {
            console.info("couldn't read file: " + req.path);
            return res.status(404).send("Error 404");
          }
        });
      };
    })(this));
    this.app.get(/^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/[A-Za-z0-9_]+.png$/, (function(_this) {
      return function(req, res) {
        var access, image, project, s, user;
        s = req.path.split("/");
        access = _this.getProjectAccess(req, res);
        if (access == null) {
          return;
        }
        user = access.user;
        project = access.project;
        image = s[s.length - 1];
        return project.getStorage().read(user.id + "/" + project.id + "/sprites/" + image, "binary", function(content) {
          if (content != null) {
            res.setHeader("Content-Type", "image/png");
            return res.send(content);
          } else {
            console.info("couldn't read file: " + req.path);
            return res.status(404).send("Error 404");
          }
        });
      };
    })(this));
    this.app.get(/^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/sprites\/[A-Za-z0-9_-]+.png$/, (function(_this) {
      return function(req, res) {
        var access, image, project, s, user;
        s = req.path.split("/");
        access = _this.getProjectAccess(req, res);
        if (access == null) {
          return;
        }
        user = access.user;
        project = access.project;
        image = s[s.length - 1];
        return project.getStorage().read(user.id + "/" + project.id + "/sprites/" + image, "binary", function(content) {
          if (content != null) {
            res.setHeader("Content-Type", "image/png");
            return res.send(content);
          } else {
            console.info("couldn't read file: " + req.path);
            return res.status(404).send("Error 404");
          }
        });
      };
    })(this));
    this.app.get(/^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/maps\/[A-Za-z0-9_-]+.json$/, (function(_this) {
      return function(req, res) {
        var access, map, project, s, user;
        s = req.path.split("/");
        access = _this.getProjectAccess(req, res);
        if (access == null) {
          return;
        }
        user = access.user;
        project = access.project;
        map = s[s.length - 1];
        return project.getStorage().read(user.id + "/" + project.id + "/maps/" + map, "text", function(content) {
          if (content != null) {
            res.setHeader("Content-Type", "application/json");
            return res.send(content);
          } else {
            console.info("couldn't read file: " + req.path);
            return res.status(404).send("Error 404");
          }
        });
      };
    })(this));
    this.app.get(/^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/sounds\/[A-Za-z0-9_-]+.(wav|ogg|flac)$/, (function(_this) {
      return function(req, res) {
        var access, ext, project, s, sound, user;
        s = req.path.split("/");
        access = _this.getProjectAccess(req, res);
        if (access == null) {
          return;
        }
        user = access.user;
        project = access.project;
        sound = s[s.length - 1];
        ext = sound.split(".")[1];
        return project.getStorage().read(user.id + "/" + project.id + "/sounds/" + sound, "binary", function(content) {
          if (content != null) {
            res.setHeader("Content-Type", "audio/" + ext);
            return res.send(content);
          } else {
            console.info("couldn't read file: " + req.path);
            return res.status(404).send("Error 404");
          }
        });
      };
    })(this));
    this.app.get(/^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/music\/[A-Za-z0-9_-]+.(mp3|ogg|flac)$/, (function(_this) {
      return function(req, res) {
        var access, ext, music, project, s, user;
        s = req.path.split("/");
        access = _this.getProjectAccess(req, res);
        if (access == null) {
          return;
        }
        user = access.user;
        project = access.project;
        music = s[s.length - 1];
        ext = music.split(".")[1];
        return project.getStorage().read(user.id + "/" + project.id + "/music/" + music, "binary", function(content) {
          if (content != null) {
            res.setHeader("Content-Type", "audio/" + ext);
            return res.send(content);
          } else {
            console.info("couldn't read file: " + req.path);
            return res.status(404).send("Error 404");
          }
        });
      };
    })(this));
    this.app.get(/^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/assets\/[A-Za-z0-9_-]+.(jpg|png|ttf|txt|csv|json|md|wasm)$/, (function(_this) {
      return function(req, res) {
        var access, asset, project, s, user;
        s = req.path.split("/");
        access = _this.getProjectAccess(req, res);
        if (access == null) {
          return;
        }
        user = access.user;
        project = access.project;
        asset = s[s.length - 1];
        return project.getStorage().read(user.id + "/" + project.id + "/assets/" + asset, "binary", function(content) {
          if (content != null) {
            switch (asset.split(".")[1]) {
              case "jpg":
                res.setHeader("Content-Type", "image/jpg");
                break;
              case "png":
                res.setHeader("Content-Type", "image/png");
                break;
              case "ttf":
                res.setHeader("Content-Type", "application/font-sfnt");
                break;
              case "txt":
                res.setHeader("Content-Type", "text/plain");
                break;
              case "csv":
                res.setHeader("Content-Type", "text/csv");
                break;
              case "json":
                res.setHeader("Content-Type", "application/json");
                break;
              case "wasm":
                res.setHeader("Content-Type", "application/wasm");
            }
            return res.send(content);
          } else {
            console.info("couldn't read file: " + req.path);
            return res.status(404).send("Error 404");
          }
        });
      };
    })(this));
    this.app.get(/^\/[^\/\|\?\&\.]+\/[^\/\|\?\&\.]+(\/([^\/\|\?\&\.]+)?)?\/doc\/[A-Za-z0-9_]+.md$/, (function(_this) {
      return function(req, res) {
        var access, doc, project, s, user;
        s = req.path.split("/");
        access = _this.getProjectAccess(req, res);
        if (access == null) {
          return;
        }
        user = access.user;
        project = access.project;
        doc = s[s.length - 1];
        return project.getStorage().read(user.id + "/" + project.id + "/doc/" + doc, "text", function(content) {
          if (content != null) {
            res.setHeader("Content-Type", "text/markdown");
            return res.send(content);
          } else {
            console.info("couldn't read file: " + req.path);
            return res.status(404).send("Error 404");
          }
        });
      };
    })(this));
    this.app.use((function(_this) {
      return function(req, res) {
        return _this.return404(req, res);
      };
    })(this));
  }

  WebApp.prototype.return404 = function(req, res) {
    if ((this.err404_funk == null) || !this.server.use_cache) {
      this.err404_funk = pug.compileFile("../templates/404.pug");
    }
    return res.status(404).send(this.err404_funk({}));
  };

  WebApp.prototype.getLanguage = function(request) {
    return "en";
  };

  WebApp.prototype.getProjectAccess = function(req, res) {
    var code, project, s, user;
    s = req.path.split("/");
    user = s[1];
    project = s[2];
    code = s[3];
    user = this.server.content.findUserByNick(user);
    if (user == null) {
      this.return404(req, res);
      return null;
    }
    project = user.findProjectBySlug(project);
    if (project == null) {
      this.return404(req, res);
      return null;
    }
    if (project["public"] || project.code === code) {
      return {
        user: user,
        project: project
      };
    }
    this.return404(req, res);
    return null;
  };

  WebApp.prototype.getProjectManager = function(project) {
    if (project.manager == null) {
      new ProjectManager(project);
    }
    return project.manager;
  };

  WebApp.prototype.roundRect = function(context, x, y, w, h, r) {
    if (w < 2 * r) {
      r = w / 2;
    }
    if (h < 2 * r) {
      r = h / 2;
    }
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    return context.closePath();
  };

  WebApp.prototype.fillRoundRect = function(context, x, y, w, h, r) {
    this.roundRect(context, x, y, w, h, r);
    return context.fill();
  };

  return WebApp;

})();

module.exports = this.WebApp;
