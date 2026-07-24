var AUX_FOLDERS, CONTENT_FOLDERS, FolderStorage, JobQueue, fs, isTextFile;

FolderStorage = require(__dirname + "/../filestorage/folderstorage.js");

JobQueue = require(__dirname + "/../app/jobqueue.js");

fs = require("fs");

CONTENT_FOLDERS = ["ms", "sprites", "maps", "sounds", "music", "assets", "doc"];

AUX_FOLDERS = ["ms", "sprites", "maps", "sounds", "sounds_th", "music", "music_th", "assets", "assets_th", "doc"];

isTextFile = function(name) {
  return name.endsWith(".ms") || name.endsWith(".json") || name.endsWith(".md");
};

this.Project = (function() {
  function Project(content1, record) {
    var data, ref;
    this.content = content1;
    this.record = record;
    data = this.record.get();
    this.deleted = data.deleted;
    if (this.deleted) {
      if (data.slug != null) {
        this.record.set({
          deleted: true
        });
      }
    }
    if (!this.deleted) {
      this.id = data.id;
      this.local_folder = data.local_folder || null;
      this.title = data.title;
      this.slug = data.slug;
      this.code = data.code || this.createCode();
      this.tags = data.tags || [];
      this.flags = data.flags || {};
      this.description = data.description || "";
      this.likes = 0;
      if (data["public"]) {
        data["public"] = false;
        this.record.set(data);
      }
      this["public"] = false;
      this.unlisted = data.unlisted;
      this.date_created = data.date_created;
      this.last_modified = data.last_modified;
      this.first_published = data.first_published || 0;
      this.orientation = data.orientation || "any";
      this.aspect = data.aspect || "free";
      this.graphics = "M1";
      this.language = "microscript_v2";
      if (data.graphics !== this.graphics || data.language !== this.language) {
        data.graphics = this.graphics;
        data.language = this.language;
        this.record.set(data);
      }
      this.platforms = data.platforms || ["computer", "phone", "tablet"];
      this.controls = data.controls || ["touch", "mouse"];
      this.libs = data.libs || [];
      this.libraries = data.libraries;
      this.properties = data.properties || {};
      this.type = (ref = data.type) === "app" || ref === "library" ? data.type : "app";
      this.users = [];
      if (!this.deleted) {
        this.owner = this.content.users[data.owner];
        if (this.owner != null) {
          this.owner.addProject(this);
        }
      }
      if ((data.files != null) && !this.deleted) {
        this.files = data.files;
      } else {
        this.files = {};
      }
      this.update_project_size = true;
      this.checkStringField("title", 100);
      this.checkStringField("slug", 100);
      this.checkStringField("code", 200);
      this.checkStringField("description", 10000);
    }
  }

  Project.prototype.checkStringField = function(field, size) {
    if (typeof this[field] === "string") {
      if (this[field].length > size) {
        console.info("field " + field + " oversize: " + this[field].length);
        return this.set(field, this[field].substring(0, size));
      }
    }
  };

  Project.prototype.createCode = function() {
    var code, i, j, letters;
    letters = "ABCDEFGHJKMNPRSTUVWXYZ23456789";
    code = "";
    for (i = j = 0; j <= 7; i = j += 1) {
      code += "" + letters.charAt(Math.floor(Math.random() * letters.length));
    }
    this.set("code", code);
    return code;
  };

  Project.prototype.touch = function() {
    var data;
    this.last_modified = Date.now();
    data = this.record.get();
    data.last_modified = this.last_modified;
    return this.record.set(data);
  };

  Project.prototype.set = function(prop, value, update_local) {
    var data;
    if (update_local == null) {
      update_local = true;
    }
    data = this.record.get();
    data[prop] = value;
    this.record.set(data);
    if (update_local) {
      this[prop] = value;
    }
    if (this.local_folder && prop !== "files") {
      return this.writeLocalMetadata();
    }
  };

  Project.prototype.setTitle = function(title) {
    if ((title != null) && title.trim().length > 0 && title.length < 50) {
      this.set("title", title);
      return true;
    } else {
      return false;
    }
  };

  Project.prototype.setSlug = function(slug) {
    if ((slug != null) && /^([a-z0-9_][a-z0-9_-]{0,29})$/.test(slug)) {
      if (this.owner.findProjectBySlug(slug) != null) {
        return false;
      }
      this.set("slug", slug);
      return true;
    } else {
      return false;
    }
  };

  Project.prototype.setCode = function(code) {
    if ((code != null) && /^([a-zA-Z0-9_][a-zA-Z0-9_-]{0,29})$/.test(code)) {
      this.set("code", code);
      return true;
    } else {
      return false;
    }
  };

  Project.prototype.setType = function(type) {
    if (type !== "app" && type !== "library") {
      return false;
    }
    this.set("type", type);
    return true;
  };

  Project.prototype.setOrientation = function(orientation) {
    return this.set("orientation", orientation);
  };

  Project.prototype.setAspect = function(aspect) {
    return this.set("aspect", aspect);
  };

  Project.prototype.setGraphics = function(graphics) {
    if (graphics !== "M1") {
      return false;
    }
    this.set("graphics", graphics);
    return true;
  };

  Project.prototype.setLanguage = function(language) {
    if (language !== "microscript_v2") {
      return false;
    }
    this.set("language", language);
    return true;
  };

  Project.prototype.setFlag = function(flag, value) {
    if (value) {
      this.flags[flag] = value;
    } else {
      delete this.flags[flag];
    }
    return this.set("flags", this.flags);
  };

  Project.prototype.setProperty = function(prop, value) {
    if (value != null) {
      this.properties[prop] = value;
    } else {
      delete this.properties[prop];
    }
    return this.set("properties", this.properties);
  };

  Project.prototype["delete"] = function() {
    var folder, ref;
    this.deleted = true;
    this.record.set({
      deleted: true
    });
    this.content.projectDeleted(this);
    if (this.local_folder) {
      if ((ref = this.manager) != null) {
        ref.stopFolderWatcher();
      }
    } else {
      folder = this.owner.id + "/" + this.id;
      this.content.files.deleteFolder(folder);
    }
    delete this.manager;
  };

  Project.prototype.getFileInfo = function(file) {
    return this.files[file] || {};
  };

  Project.prototype.setFileInfo = function(file, key, value) {
    var info;
    info = this.getFileInfo(file);
    info[key] = value;
    this.files[file] = info;
    this.set("files", this.files);
    return this.update_project_size = true;
  };

  Project.prototype.deleteFileInfo = function(file) {
    delete this.files[file];
    this.set("files", this.files);
    return this.update_project_size = true;
  };

  Project.prototype.getSize = function() {
    if (this.update_project_size) {
      this.updateProjectSize();
    }
    return this.byte_size;
  };

  Project.prototype.updateProjectSize = function() {
    var file, key, ref;
    this.byte_size = 0;
    this.update_project_size = false;
    ref = this.files;
    for (key in ref) {
      file = ref[key];
      if (file.size != null) {
        this.byte_size += file.size;
      }
    }
  };

  Project.prototype.filenameChanged = function(previous, next) {
    if (this.files[previous] != null) {
      this.files[next] = this.files[previous];
      delete this.files[previous];
      return this.set("files", this.files);
    }
  };

  Project.prototype.fileDeleted = function(file) {
    if (this.files[file]) {
      delete this.files[file];
      return this.set("files", this.files);
    }
  };

  Project.prototype.getStorage = function() {
    if (this.local_folder) {
      if ((this.folder_storage == null) || this.folder_storage.folder !== this.local_folder) {
        this.folder_storage = new FolderStorage(this.local_folder);
      }
      return this.folder_storage;
    } else {
      return this.content.files;
    }
  };

  Project.prototype.localMetadata = function() {
    return {
      owner: this.owner.nick,
      title: this.title,
      slug: this.slug,
      tags: this.tags,
      orientation: this.orientation,
      aspect: this.aspect,
      platforms: this.platforms,
      controls: this.controls,
      type: this.type,
      language: this.language,
      graphics: this.graphics,
      libs: this.libs,
      libraries: this.libraries,
      date_created: this.date_created,
      description: this.description
    };
  };

  Project.prototype.writeLocalMetadata = function(callback) {
    if (!this.local_folder) {
      return typeof callback === "function" ? callback(new Error("Project is not linked to a local folder")) : void 0;
    }
    if (this.local_metadata_callbacks == null) {
      this.local_metadata_callbacks = [];
    }
    if (callback != null) {
      this.local_metadata_callbacks.push(callback);
    }
    if (this.local_metadata_timer != null) {
      clearTimeout(this.local_metadata_timer);
    }
    return this.local_metadata_timer = setTimeout(((function(_this) {
      return function() {
        var callbacks, j, len;
        _this.local_metadata_timer = null;
        if (!_this.local_folder) {
          callbacks = _this.local_metadata_callbacks;
          _this.local_metadata_callbacks = [];
          for (j = 0, len = callbacks.length; j < len; j++) {
            callback = callbacks[j];
            if (typeof callback === "function") {
              callback(new Error("Project is not linked to a local folder"));
            }
          }
          return;
        }
        return fs.writeFile(_this.local_folder + "/project.json", JSON.stringify(_this.localMetadata(), null, 2), function(err) {
          var l, len1, results;
          callbacks = _this.local_metadata_callbacks;
          _this.local_metadata_callbacks = [];
          results = [];
          for (l = 0, len1 = callbacks.length; l < len1; l++) {
            callback = callbacks[l];
            results.push(typeof callback === "function" ? callback(err) : void 0);
          }
          return results;
        });
      };
    })(this)), 500);
  };

  Project.prototype.setLocalFolder = function(folder, callback) {
    var check, dest, entries, err, exists, finish, hasOwnFiles, k, src;
    if (this.folder_op_in_progress) {
      return callback("A folder link/unlink operation is already in progress");
    }
    check = this.content.server.checkProjectFolder(folder);
    if (check.error) {
      return callback(check.error);
    }
    folder = check.resolved;
    exists = fs.existsSync(folder);
    entries = [];
    if (exists) {
      try {
        entries = fs.readdirSync(folder).filter((function(_this) {
          return function(e) {
            return e !== ".git" && e !== ".DS_Store";
          };
        })(this));
      } catch (error) {
        err = error;
        return callback("folder cannot be read");
      }
    }
    hasOwnFiles = false;
    for (k in this.files) {
      hasOwnFiles = true;
      break;
    }
    finish = (function(_this) {
      return function() {
        var ref;
        if ((ref = _this.manager) != null) {
          ref.stopFolderWatcher();
        }
        _this.local_folder = folder;
        _this.folder_storage = null;
        _this.set("local_folder", folder, false);
        return _this.writeLocalMetadata(function(err) {
          var ref1;
          _this.folder_op_in_progress = false;
          if (err) {
            _this.local_folder = null;
            _this.folder_storage = null;
            _this.set("local_folder", null, false);
            return callback("Could not write project metadata: " + err.message);
          } else {
            if ((ref1 = _this.manager) != null) {
              ref1.startFolderWatcher();
            }
            return callback(null);
          }
        });
      };
    })(this);
    this.folder_op_in_progress = true;
    if (entries.length === 0) {
      try {
        dest = new FolderStorage(folder);
      } catch (error) {
        err = error;
        this.folder_op_in_progress = false;
        return callback("folder cannot be created: " + err.message);
      }
      return this.exportToFolder(dest, (function(_this) {
        return function() {
          return finish();
        };
      })(this));
    } else if (!hasOwnFiles) {
      try {
        src = new FolderStorage(folder);
      } catch (error) {
        err = error;
        this.folder_op_in_progress = false;
        return callback("folder cannot be read: " + err.message);
      }
      return this.importFromFolder(src, (function(_this) {
        return function() {
          return finish();
        };
      })(this));
    } else {
      this.folder_op_in_progress = false;
      return callback("Target folder must be empty, or the project must have no files yet");
    }
  };

  Project.prototype.unlinkLocalFolder = function(callback) {
    var dest, fn, folder, j, len, queue, src;
    if (!this.local_folder) {
      return callback(null);
    }
    if (this.folder_op_in_progress) {
      return callback("A folder link/unlink operation is already in progress");
    }
    this.folder_op_in_progress = true;
    src = this.getStorage();
    dest = this.content.files;
    queue = new JobQueue((function(_this) {
      return function() {
        var ref;
        if ((ref = _this.manager) != null) {
          ref.stopFolderWatcher();
        }
        _this.local_folder = null;
        _this.folder_storage = null;
        _this.set("local_folder", null);
        _this.folder_op_in_progress = false;
        return callback(null);
      };
    })(this));
    fn = (function(_this) {
      return function(folder) {
        return queue.add(function() {
          return src.list(_this.owner.id + "/" + _this.id + "/" + folder, function(files) {
            var f, filequeue, fn1, l, len1;
            files = files || [];
            filequeue = new JobQueue(function() {
              return queue.next();
            });
            fn1 = function(f) {
              return filequeue.add(function() {
                var encoding, full;
                full = _this.owner.id + "/" + _this.id + "/" + folder + "/" + f;
                encoding = isTextFile(f) ? "utf8" : "binary";
                return src.read(full, encoding, function(content) {
                  if (content != null) {
                    return dest.write(full, content, function() {
                      return filequeue.next();
                    });
                  } else {
                    console.error("unlinkLocalFolder: failed to read " + full + ", skipping");
                    return filequeue.next();
                  }
                });
              });
            };
            for (l = 0, len1 = files.length; l < len1; l++) {
              f = files[l];
              fn1(f);
            }
            return filequeue.start();
          });
        });
      };
    })(this);
    for (j = 0, len = AUX_FOLDERS.length; j < len; j++) {
      folder = AUX_FOLDERS[j];
      fn(folder);
    }
    return queue.start();
  };

  Project.prototype.exportToFolder = function(dest, callback) {
    var fn, folder, j, len, queue, src;
    src = this.getStorage();
    queue = new JobQueue((function(_this) {
      return function() {
        return callback();
      };
    })(this));
    fn = (function(_this) {
      return function(folder) {
        return queue.add(function() {
          return src.list(_this.owner.id + "/" + _this.id + "/" + folder, function(files) {
            var f, filequeue, fn1, l, len1;
            files = files || [];
            filequeue = new JobQueue(function() {
              return queue.next();
            });
            fn1 = function(f) {
              return filequeue.add(function() {
                var encoding, full;
                full = _this.owner.id + "/" + _this.id + "/" + folder + "/" + f;
                encoding = isTextFile(f) ? "utf8" : "binary";
                return src.read(full, encoding, function(content) {
                  if (content == null) {
                    console.error("exportToFolder: failed to read " + full + ", skipping");
                    return filequeue.next();
                  }
                  return dest.write(full, content, function() {
                    var props;
                    props = _this.getFileInfo(folder + "/" + f).properties;
                    if ((props != null) && Object.keys(props).length > 0) {
                      return dest.writeProperties(full, props, function() {
                        return filequeue.next();
                      });
                    } else {
                      return filequeue.next();
                    }
                  });
                });
              });
            };
            for (l = 0, len1 = files.length; l < len1; l++) {
              f = files[l];
              fn1(f);
            }
            return filequeue.start();
          });
        });
      };
    })(this);
    for (j = 0, len = AUX_FOLDERS.length; j < len; j++) {
      folder = AUX_FOLDERS[j];
      fn(folder);
    }
    return queue.start();
  };

  Project.prototype.importFromFolder = function(src, callback) {
    var fn, folder, j, len, queue;
    queue = new JobQueue((function(_this) {
      return function() {
        return callback();
      };
    })(this));
    fn = (function(_this) {
      return function(folder) {
        return queue.add(function() {
          return src.list(_this.owner.id + "/" + _this.id + "/" + folder, function(files) {
            var f, filequeue, fn1, l, len1;
            files = files || [];
            filequeue = new JobQueue(function() {
              return queue.next();
            });
            fn1 = function(f) {
              return filequeue.add(function() {
                var encoding, full, rel;
                rel = folder + "/" + f;
                full = _this.owner.id + "/" + _this.id + "/" + rel;
                encoding = isTextFile(f) ? "utf8" : "binary";
                return src.read(full, encoding, function(content) {
                  if (content == null) {
                    console.error("importFromFolder: failed to read " + full + ", skipping");
                    return filequeue.next();
                  }
                  _this.setFileInfo(rel, "size", content.length);
                  _this.setFileInfo(rel, "version", 1);
                  return src.readProperties(full, function(props) {
                    _this.setFileInfo(rel, "properties", props || {});
                    return filequeue.next();
                  });
                });
              });
            };
            for (l = 0, len1 = files.length; l < len1; l++) {
              f = files[l];
              fn1(f);
            }
            return filequeue.start();
          });
        });
      };
    })(this);
    for (j = 0, len = CONTENT_FOLDERS.length; j < len; j++) {
      folder = CONTENT_FOLDERS[j];
      fn(folder);
    }
    return queue.start();
  };

  Project.prototype.updateFileSizes = function(callback) {
    var list, maps, process, source, sprites;
    source = "../files/" + this.content.files.sanitize(this.owner.id + "/" + this.id + "/ms");
    sprites = "../files/" + this.content.files.sanitize(this.owner.id + "/" + this.id + "/sprites");
    maps = "../files/" + this.content.files.sanitize(this.owner.id + "/" + this.id + "/maps");
    list = [];
    process = (function(_this) {
      return function() {
        var f, file;
        if (list.length > 0) {
          f = list.splice(0, 1)[0];
          file = "../files/" + _this.content.files.sanitize(_this.owner.id + "/" + _this.id + "/" + f);
          return fs.lstat(file, function(err, stat) {
            if ((stat != null) && (stat.size != null)) {
              _this.setFileInfo(f, "size", stat.size);
            }
            return setTimeout((function() {
              return process();
            }), 0);
          });
        } else {
          if (callback != null) {
            return callback();
          }
        }
      };
    })(this);
    return fs.readdir(source, (function(_this) {
      return function(err, files) {
        var f, j, len;
        if (files) {
          for (j = 0, len = files.length; j < len; j++) {
            f = files[j];
            list.push("ms/" + f);
          }
        }
        return fs.readdir(sprites, function(err, files) {
          var l, len1;
          if (files) {
            for (l = 0, len1 = files.length; l < len1; l++) {
              f = files[l];
              list.push("sprites/" + f);
            }
          }
          return fs.readdir(maps, function(err, files) {
            var len2, m;
            if (files) {
              for (m = 0, len2 = files.length; m < len2; m++) {
                f = files[m];
                list.push("maps/" + f);
              }
            }
            return process();
          });
        });
      };
    })(this));
  };

  return Project;

})();

module.exports = this.Project;
