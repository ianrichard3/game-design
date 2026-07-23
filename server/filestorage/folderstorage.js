var SELF_WRITE_WINDOW, fs, path;

fs = require("fs");

path = require("path");

SELF_WRITE_WINDOW = 2000;

this.FolderStorage = (function() {
  function FolderStorage(folder1) {
    this.folder = folder1;
    if (!fs.existsSync(this.folder)) {
      fs.mkdirSync(this.folder, {
        recursive: true
      });
    }
    this.thumbnails = this.folder + "/.microstudio/thumbnails";
    this.recent_writes = {};
    this.ensureGitignore();
  }

  FolderStorage.prototype.markSelfWrite = function(realPath, callback) {
    return fs.stat(realPath, (function(_this) {
      return function(err, stat) {
        _this.recent_writes[realPath] = {
          time: Date.now(),
          mtime: stat != null ? stat.mtimeMs : null
        };
        return typeof callback === "function" ? callback() : void 0;
      };
    })(this));
  };

  FolderStorage.prototype.markSelfDelete = function(realPath) {
    return this.recent_writes[realPath] = {
      time: Date.now(),
      mtime: null,
      deleted: true
    };
  };

  FolderStorage.prototype.consumeSelfWrite = function(realPath, callback) {
    var mark;
    mark = this.recent_writes[realPath];
    delete this.recent_writes[realPath];
    if ((mark == null) || (Date.now() - mark.time) >= SELF_WRITE_WINDOW) {
      return callback(false);
    }
    if (mark.deleted) {
      return fs.stat(realPath, (function(_this) {
        return function(err, stat) {
          return callback(stat == null);
        };
      })(this));
    } else {
      return fs.stat(realPath, (function(_this) {
        return function(err, stat) {
          return callback((stat != null) && stat.mtimeMs === mark.mtime);
        };
      })(this));
    }
  };

  FolderStorage.prototype.ensureGitignore = function() {
    var content, err, file, lines, separator;
    file = this.folder + "/.gitignore";
    try {
      if (!fs.existsSync(file)) {
        return fs.writeFileSync(file, ".microstudio/\n");
      } else {
        content = fs.readFileSync(file, "utf8");
        lines = content.split("\n").map((function(_this) {
          return function(l) {
            return l.trim();
          };
        })(this));
        if (lines.indexOf(".microstudio/") < 0 && lines.indexOf(".microstudio") < 0) {
          separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
          return fs.appendFileSync(file, separator + ".microstudio/\n");
        }
      }
    } catch (error) {
      err = error;
      return console.error(err);
    }
  };

  FolderStorage.prototype.isAuxFolder = function(folder) {
    return folder.endsWith("_th");
  };

  FolderStorage.prototype.rootFor = function(folder) {
    if (this.isAuxFolder(folder)) {
      return this.thumbnails;
    } else {
      return this.folder;
    }
  };

  FolderStorage.prototype.dashesToSlashes = function(name) {
    return name.split("-").join("/");
  };

  FolderStorage.prototype.slashesToDashes = function(name) {
    return name.split("/").join("-");
  };

  FolderStorage.prototype.stripPrefix = function(file) {
    var s;
    s = file.split("/");
    s.splice(0, 2);
    return s.join("/");
  };

  FolderStorage.prototype.realPathForFile = function(rel) {
    var base, dot, ext, folder, i, name;
    i = rel.indexOf("/");
    if (i < 0) {
      return this.folder + "/" + rel;
    }
    folder = rel.substring(0, i);
    name = rel.substring(i + 1);
    dot = name.lastIndexOf(".");
    base = dot < 0 ? name : name.substring(0, dot);
    ext = dot < 0 ? "" : name.substring(dot);
    return (this.rootFor(folder)) + "/" + folder + "/" + (this.dashesToSlashes(base)) + ext;
  };

  FolderStorage.prototype.sidecarPath = function(realPath) {
    return realPath + ".json";
  };

  FolderStorage.prototype.list = function(file, callback) {
    var base, rel, result, walk;
    rel = this.stripPrefix(file);
    base = (this.rootFor(rel)) + "/" + rel;
    result = [];
    walk = (function(_this) {
      return function(dir, prefix, done) {
        return fs.readdir(dir, {
          withFileTypes: true
        }, function(err, entries) {
          var d, dirs, e, files, isSidecar, j, k, len, len1, names, pending, results;
          if ((err != null) || (entries == null)) {
            return done();
          }
          entries = entries.filter(function(e) {
            return !e.name.startsWith(".");
          });
          names = (function() {
            var j, len, results;
            results = [];
            for (j = 0, len = entries.length; j < len; j++) {
              e = entries[j];
              if (!e.isDirectory()) {
                results.push(e.name);
              }
            }
            return results;
          })();
          files = (function() {
            var j, len, results;
            results = [];
            for (j = 0, len = entries.length; j < len; j++) {
              e = entries[j];
              if (!e.isDirectory()) {
                results.push(e);
              }
            }
            return results;
          })();
          dirs = (function() {
            var j, len, results;
            results = [];
            for (j = 0, len = entries.length; j < len; j++) {
              e = entries[j];
              if (e.isDirectory()) {
                results.push(e);
              }
            }
            return results;
          })();
          for (j = 0, len = files.length; j < len; j++) {
            e = files[j];
            isSidecar = e.name.endsWith(".json") && names.indexOf(e.name.slice(0, -5)) >= 0;
            if (!isSidecar) {
              result.push("" + prefix + e.name);
            }
          }
          if (dirs.length === 0) {
            return done();
          }
          pending = dirs.length;
          results = [];
          for (k = 0, len1 = dirs.length; k < len1; k++) {
            d = dirs[k];
            results.push((function(d) {
              return walk(dir + "/" + d.name, "" + prefix + (_this.slashesToDashes(d.name)) + "-", function() {
                pending -= 1;
                if (pending === 0) {
                  return done();
                }
              });
            })(d));
          }
          return results;
        });
      };
    })(this);
    return walk(base, "", (function(_this) {
      return function() {
        return callback(result);
      };
    })(this));
  };

  FolderStorage.prototype.read = function(file, encoding, callback) {
    var real;
    real = this.realPathForFile(this.stripPrefix(file));
    return fs.readFile(real, (function(_this) {
      return function(err, data) {
        if ((data != null) && (err == null)) {
          switch (encoding) {
            case "base64":
              return callback(data.toString("base64"));
            case "binary":
              return callback(data);
            default:
              return callback(data.toString("utf8"));
          }
        } else {
          return callback(null);
        }
      };
    })(this));
  };

  FolderStorage.prototype.readProperties = function(file, callback) {
    var real;
    real = this.realPathForFile(this.stripPrefix(file));
    return fs.readFile(this.sidecarPath(real), (function(_this) {
      return function(err, data) {
        var e;
        if ((data != null) && (err == null)) {
          try {
            return callback(JSON.parse(data.toString("utf8")));
          } catch (error) {
            e = error;
            return callback({});
          }
        } else {
          return callback({});
        }
      };
    })(this));
  };

  FolderStorage.prototype.write = function(file, content, callback) {
    var real;
    real = this.realPathForFile(this.stripPrefix(file));
    return fs.mkdir(path.dirname(real), {
      recursive: true
    }, (function(_this) {
      return function() {
        return fs.writeFile(real, content, function() {
          return _this.markSelfWrite(real, function() {
            if (callback != null) {
              return callback();
            }
          });
        });
      };
    })(this));
  };

  FolderStorage.prototype.writeProperties = function(file, properties, callback) {
    var real;
    real = this.realPathForFile(this.stripPrefix(file));
    return fs.mkdir(path.dirname(real), {
      recursive: true
    }, (function(_this) {
      return function() {
        var sidecar;
        sidecar = _this.sidecarPath(real);
        return fs.writeFile(sidecar, JSON.stringify(properties || {}), function() {
          return _this.markSelfWrite(sidecar, function() {
            if (callback != null) {
              return callback();
            }
          });
        });
      };
    })(this));
  };

  FolderStorage.prototype["delete"] = function(file, callback) {
    var real;
    real = this.realPathForFile(this.stripPrefix(file));
    return fs.unlink(real, (function(_this) {
      return function() {
        _this.markSelfDelete(real);
        return fs.unlink(_this.sidecarPath(real), function() {
          _this.markSelfDelete(_this.sidecarPath(real));
          _this.pruneEmptyDirs(path.dirname(real));
          if (callback != null) {
            return callback();
          }
        });
      };
    })(this));
  };

  FolderStorage.prototype.pruneEmptyDirs = function(dir) {
    if (dir.length <= this.folder.length || dir === this.thumbnails) {
      return;
    }
    return fs.readdir(dir, (function(_this) {
      return function(err, entries) {
        if ((err == null) && (entries != null) && entries.length === 0) {
          return fs.rmdir(dir, function(err) {
            if (err == null) {
              return _this.pruneEmptyDirs(path.dirname(dir));
            }
          });
        }
      };
    })(this));
  };

  FolderStorage.prototype.deleteFolder = function(file, callback) {
    var real, rel;
    rel = this.stripPrefix(file);
    real = (this.rootFor(rel)) + "/" + rel;
    return fs.rm(real, {
      recursive: true,
      force: true
    }, (function(_this) {
      return function() {
        if (callback != null) {
          return callback();
        }
      };
    })(this));
  };

  FolderStorage.prototype.mkdirs = function(folder, callback) {
    var real;
    real = (this.rootFor(folder)) + "/" + folder;
    return fs.mkdir(real, {
      recursive: true
    }, (function(_this) {
      return function() {
        if (callback != null) {
          return callback();
        }
      };
    })(this));
  };

  return FolderStorage;

})();

module.exports = this.FolderStorage;
