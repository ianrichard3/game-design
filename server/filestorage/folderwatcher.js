var CONTENT_FOLDERS, VALID_NAME, chokidar, fs;

fs = require("fs");

chokidar = require("chokidar");

CONTENT_FOLDERS = ["ms", "sprites", "maps", "sounds", "music", "assets", "doc"];

VALID_NAME = /^(ms|sprites|maps|sounds|music|doc|assets)\/[a-z0-9_]{1,40}(-[a-z0-9_]{1,40}){0,10}\.(ms|png|json|wav|mp3|ogg|flac|md|glb|obj|jpg|ttf|txt|csv|wasm)$/;

this.FolderWatcher = (function() {
  function FolderWatcher(project) {
    this.project = project;
    this.storage = this.project.getStorage();
  }

  FolderWatcher.prototype.start = function(callback) {
    if (this.watcher != null) {
      return typeof callback === "function" ? callback() : void 0;
    }
    return this.reconcile((function(_this) {
      return function() {
        _this.attachWatcher();
        return typeof callback === "function" ? callback() : void 0;
      };
    })(this));
  };

  FolderWatcher.prototype.stop = function() {
    if (this.watcher != null) {
      this.watcher.close();
      return this.watcher = null;
    }
  };

  FolderWatcher.prototype.attachWatcher = function() {
    this.watcher = chokidar.watch(this.storage.folder, {
      cwd: this.storage.folder,
      ignoreInitial: true,
      ignored: function(p) {
        var base;
        base = p.split("/").pop();
        return base.startsWith(".") || p.indexOf(".microstudio") >= 0 || p.indexOf(".git") >= 0;
      },
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    });
    this.watcher.on("add", (function(_this) {
      return function(p) {
        return _this.changed(p);
      };
    })(this));
    this.watcher.on("change", (function(_this) {
      return function(p) {
        return _this.changed(p);
      };
    })(this));
    return this.watcher.on("unlink", (function(_this) {
      return function(p) {
        return _this.removed(p);
      };
    })(this));
  };

  FolderWatcher.prototype.toDashFile = function(relPath) {
    var base, dashed, dirs, dot, ext, file, filename, folder, parts;
    parts = relPath.split("/");
    if (parts.length < 2) {
      return null;
    }
    folder = parts[0];
    if (CONTENT_FOLDERS.indexOf(folder) < 0) {
      return null;
    }
    filename = parts[parts.length - 1];
    dot = filename.lastIndexOf(".");
    if (dot < 0) {
      return null;
    }
    dirs = parts.slice(1, parts.length - 1);
    base = filename.substring(0, dot);
    ext = filename.substring(dot);
    dashed = dirs.concat([base]).join("-");
    file = folder + "/" + dashed + ext;
    if (VALID_NAME.test(file)) {
      return file;
    } else {
      return null;
    }
  };

  FolderWatcher.prototype.changed = function(relPath) {
    var file, fullPath, real;
    file = this.toDashFile(relPath);
    if (file == null) {
      return;
    }
    real = this.storage.realPathForFile(file);
    fullPath = this.project.owner.id + "/" + this.project.id + "/" + file;
    return this.storage.consumeSelfWrite(real, (function(_this) {
      return function(isSelf) {
        var encoding, manager;
        if (isSelf) {
          return;
        }
        manager = _this.project.manager;
        if (manager == null) {
          return;
        }
        encoding = /\.(ms|json|md)$/.test(file) ? "utf8" : "base64";
        return _this.storage.read(fullPath, encoding, function(content) {
          if (content == null) {
            return;
          }
          return _this.storage.readProperties(fullPath, function(properties) {
            var size, version;
            size = encoding === "utf8" ? content.length : Buffer.from(content, "base64").length;
            version = manager.getFileVersion(file) + 1;
            manager.setFileVersion(file, version);
            manager.setFileSize(file, size);
            if ((properties != null) && Object.keys(properties).length > 0) {
              manager.setFileProperties(file, properties);
            }
            manager.propagateFileChange(null, file, version, content, manager.getFileProperties(file));
            return _this.project.touch();
          });
        });
      };
    })(this));
  };

  FolderWatcher.prototype.removed = function(relPath) {
    var file, real;
    file = this.toDashFile(relPath);
    if (file == null) {
      return;
    }
    real = this.storage.realPathForFile(file);
    return this.storage.consumeSelfWrite(real, (function(_this) {
      return function(isSelf) {
        var manager;
        if (isSelf) {
          return;
        }
        manager = _this.project.manager;
        if (manager == null) {
          return;
        }
        _this.project.deleteFileInfo(file);
        manager.propagateFileDeleted(null, file);
        return _this.project.touch();
      };
    })(this));
  };

  FolderWatcher.prototype.reconcile = function(callback) {
    var manager, processFolder, remaining;
    manager = this.project.manager;
    if (manager == null) {
      return typeof callback === "function" ? callback() : void 0;
    }
    remaining = CONTENT_FOLDERS.slice();
    processFolder = (function(_this) {
      return function() {
        var folder;
        if (remaining.length === 0) {
          return typeof callback === "function" ? callback() : void 0;
        }
        folder = remaining.splice(0, 1)[0];
        return _this.storage.list(_this.project.owner.id + "/" + _this.project.id + "/" + folder, function(files) {
          var checkDone, f, filepath, i, j, len, len1, onDisk, pending, results;
          files = files || [];
          files = (function() {
            var i, len, results;
            results = [];
            for (i = 0, len = files.length; i < len; i++) {
              f = files[i];
              if (VALID_NAME.test(folder + "/" + f)) {
                results.push(f);
              }
            }
            return results;
          })();
          onDisk = {};
          for (i = 0, len = files.length; i < len; i++) {
            f = files[i];
            onDisk[folder + "/" + f] = true;
          }
          for (filepath in _this.project.files) {
            if (filepath.indexOf(folder + "/") === 0 && (onDisk[filepath] == null)) {
              _this.project.deleteFileInfo(filepath);
            }
          }
          if (files.length === 0) {
            return processFolder();
          }
          pending = files.length;
          checkDone = function() {
            pending -= 1;
            if (pending === 0) {
              return processFolder();
            }
          };
          results = [];
          for (j = 0, len1 = files.length; j < len1; j++) {
            f = files[j];
            results.push((function(f) {
              var real, rel;
              rel = folder + "/" + f;
              real = _this.storage.realPathForFile(rel);
              return fs.stat(real, function(err, stat) {
                var info;
                if ((err != null) || (stat == null)) {
                  return checkDone();
                }
                info = _this.project.getFileInfo(rel);
                if (info.size !== stat.size) {
                  manager.setFileVersion(rel, manager.getFileVersion(rel) + 1);
                  manager.setFileSize(rel, stat.size);
                  return _this.storage.readProperties(_this.project.owner.id + "/" + _this.project.id + "/" + rel, function(props) {
                    if ((props != null) && Object.keys(props).length > 0) {
                      manager.setFileProperties(rel, props);
                    }
                    return checkDone();
                  });
                } else {
                  return checkDone();
                }
              });
            })(f));
          }
          return results;
        });
      };
    })(this);
    return processFolder();
  };

  return FolderWatcher;

})();

module.exports = this.FolderWatcher;
