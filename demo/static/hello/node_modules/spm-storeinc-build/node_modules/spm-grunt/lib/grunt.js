var fs = require('fs');
var path = require('path');
var spmrc = require('spmrc');

var isPatched = false;

module.exports = function(grunt) {
  if (isPatched) return grunt;

  patchLog(grunt);
  patchTask(grunt);
  return grunt;
};

function patchLog(grunt) {
  if (grunt.option('use-grunt-log')) {
    return;
  }

  var log;
  try {
    log = require('spm').log;
    if (grunt.option('verbose')) {
      log.level = 'debug';
    }
    if (grunt.option('quiet')) {
      log.quiet = 'warn';
    }
  } catch (e) {
    return;
  }

  if (!log) {
    return;
  }

  // reset grunt log
  function logCategory(msg, fn) {
    if (!msg) return grunt.log;

    var bits = msg.split(' ');
    if (bits[0].length < 2) {
      return grunt.log;
    }

    var cat = bits[0].toLowerCase().replace(/:$/, '');
    fn(cat, bits.slice(1).join(' '));
    return grunt.log;
  }

  grunt.log.header = function(msg) {
    msg = msg || '';
    if (/^Running/.test(msg)) {
      if (log.quiet) {
        console.log('  ' + msg.green);
      } else {
        console.log();
      }
      log.info('Task', msg.replace(/^Running\s*/, '').green);
    }
    return grunt.log;
  };

  grunt.log.verbose.header = function() {
    return grunt.log;
  };

  grunt.log.verbose.subhead = function() {
    return grunt.log;
  };

  grunt.log.write = function(msg) {
    return logCategory(msg, log.info);
  };
  grunt.log.verbose.write = function(msg) {
    return logCategory(msg, log.debug);
  };

  grunt.log.writeln = function(msg) {
    return logCategory(msg, log.info);
  };
  grunt.log.verbose.writeln = function(msg) {
    return logCategory(msg, log.debug);
  };

  grunt.log.ok = function(msg) {
    msg && log.info('ok', msg || '');
    return grunt.log;
  };
  grunt.log.verbose.ok = function(msg) {
    msg && log.debug('ok', msg || '');
    return grunt.log;
  };

  grunt.log.verbose.success = function(msg) {
    log.debug('success', msg || '');
    return grunt.log;
  };

  grunt.log.warn = function(msg) {
    log.warn('warn', msg || '');
    return grunt.log;
  };
  grunt.log.error = function(msg) {
    log.error('error', msg || '');
    return grunt.log;
  };

  grunt.log.verbose.warn = function(msg) {
    log.debug('warn', msg || '');
    return grunt.log;
  };

  grunt.log.verbose.error = function(msg) {
    log.debug('error', msg || '');
    return grunt.log;
  };

  grunt.fail.warn = function(msg) {
    grunt.fail.warncount++;
    log.warn('warn', msg || '');
    return grunt.log;
  };

  grunt.log.fail = function(msg) {
    console.log();
    var bits = msg.split(' ');
    log.error(bits[0].trim().replace(/,$/, ''), bits.slice(1).join(' '));
    return grunt.log;
  };

  grunt.log.success = function(msg) {
    console.log();
    var bits = msg.split(' ');
    log.info(bits[0].trim().replace(/,$/, ''), bits.slice(1).join(' '));
    return grunt.log;
  };
}

function patchTask(grunt) {
  // load tasks in NODE_PATH
  grunt.loadGlobalTasks = function(name) {
    grunt.log.writeln('load ' + name);

    var rootdir = getTaskRootDir(name);
    if (!rootdir) {
      grunt.log.error('Global task ' + name + ' not found.');
      return;
    }
    var pkgfile = path.join(rootdir, 'package.json');
    var pkg = grunt.file.exists(pkgfile) ? grunt.file.readJSON(pkgfile): {keywords: []};

    var taskdir = path.join(rootdir, 'tasks');
    // Process collection plugins
    if (pkg.keywords && pkg.keywords.indexOf('gruntcollection') !== -1) {

      Object.keys(pkg.dependencies).forEach(function(depName) {
        // global task name should begin with grunt
        if (!/^grunt/.test(depName)) return;
        var filepath = path.join(rootdir, 'node_modules', depName);
        if (grunt.file.exists(filepath)) {
          // Load this task plugin recursively
          grunt.loadGlobalTasks(name + '/node_modules/' + depName);
        }
      });
      // Load the tasks of itself
      if (grunt.file.exists(taskdir)) {
        grunt.loadTasks(taskdir);
      }
      return;
    }
    if (grunt.file.exists(taskdir)) {
      grunt.loadTasks(taskdir);
    } else {
      grunt.log.error('Global task ' + name + ' not found.');
    }
  };

  grunt.invokeTask = function(name, options, fn) {
    if (!fn && options.fallback) {
      fn = options.fallback;
      delete options.fallback;
    }
    if (options.encoding) {
      grunt.file.defaultEncoding = options.encoding;
    }
    grunt.option.init(options);

    // patch after init options
    patchLog(grunt);

    getGruntfiles(function(files) {
      files.push(fn);
      files.some(function(gruntfile) {
        try {
          return runCli(name, gruntfile);
        } catch (e) {
          return false;
        }
      });
    });
  };

  function getTaskRootDir(name) {
    var NODE_PATH = process.env.NODE_PATH;
    if (!NODE_PATH) {
      grunt.log.error('Environment variable required: "NODE_PATH"');
      process.exit(1);
    }

    var nodePaths = NODE_PATH.split(process.platform == 'win32' ? ';' : ':');
    for (var i = 0; i < nodePaths.length; i++) {
      var rootDir = path.join(nodePaths[i], name);
      if (grunt.file.exists(rootDir)) {
        return rootDir;
      }
    }
    return null;
  }

  // helpers
  function getGruntfiles(callback) {
    var files = [];
    if (grunt.file.exists('Gruntfile.js')) {
      files.push('Gruntfile.js');
    }
    var gruntfile = spmrc.get('user.gruntfile');
    if (!gruntfile) {
      callback(files);
      return;
    }
    grunt.log.verbose.writeln('gruntfile ' + gruntfile);
    if (/^https?/.test(gruntfile)) {
      download(gruntfile, function(err, fpath) {
        if (!err) {
          files.push(fpath);
        } else {
          grunt.log.warn('error ' + gruntfile);
        }
        callback(files);
      });
    } else {
      files.push(gruntfile);
      callback(files);
    }
  }

  function runCli(name, gruntfile) {
    var fn;
    if (typeof gruntfile === 'function') {
      fn = gruntfile;
    } else {
      fn = require(path.resolve(gruntfile));
    }
    if (typeof fn === 'function') {
      fn.call(grunt, grunt);
      if (grunt.task._tasks[name]) {
        grunt.option('gruntfile', gruntfile);
        grunt.option('base', process.cwd());

        var task = grunt.task;
        var fail = grunt.fail;

        var uncaughtHandler = function(e) {
          fail.fatal(e, fail.code.TASK_FAILURE);
        };
        process.on('uncaughtException', uncaughtHandler);

        task.options({
          error: function(e) {
            fail.warn(e, fail.code.TASK_FAILURE);
          },
          done: function() {
            process.removeListener('uncaughtException', uncaughtHandler);
            fail.report();
            process.exit(0);
          }
        });
        task.run(name);
        task.start();
        return true;
      }
    }
    return false;
  }

  function download(uri, callback) {
    var tmp = spmrc.get('user.temp');
    var fpath = path.join(tmp, encodeURIComponent(uri));
    var isExpired = function(fpath) {
      if (!grunt.file.exists(fpath)) return true;
      // default expires in 1 day
      var expires = spmrc.get('user.expires') || 86400000;
      return (new Date() - fs.statSync(fpath).ctime) > parseInt(expires, 10);
    };
    if (!isExpired(fpath)) {
      callback(null, fpath);
    } else {
      var urilab = require('url');
      var options = urilab.parse(uri);
      var connect = require(options.protocol.slice(0, -1));

      connect.get(options, function(res) {
        if (res.statusCode !== 200) {
          callback(res.statusCode);
          return;
        }

        var ret = [], length = 0;
        res.on('data', function(chunk) {
          length += chunk.length;
          ret.push(chunk);
        });

        res.on('end', function() {
          var buf = new Buffer(length), index = 0;
          ret.forEach(function(chunk) {
            chunk.copy(buf, index, 0, chunk.length);
            index += chunk.length;
          });
          grunt.file.write(fpath, buf);
          callback(null, fpath);
        })
      });
    }
  }
}
