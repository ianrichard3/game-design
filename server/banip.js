var BLOCKED_IPS_FILE, KnownIP, fs, path;

fs = require('fs');

path = require('path');

KnownIP = (function() {
  function KnownIP(banip, ip1) {
    this.banip = banip;
    this.ip = ip1;
    this.last_requests = [0, 0, 0, 0];
    this.index = 0;
  }

  KnownIP.prototype.request = function() {
    var dt, time;
    time = Date.now();
    this.last_requests[this.index] = time;
    this.index = (this.index + 1) % this.last_requests.length;
    dt = time - this.last_requests[this.index];
    if (dt < 500) {
      return this.ban();
    }
  };

  KnownIP.prototype.ban = function() {
    this.banip.banIP(this.ip);
    return this.banned = true;
  };

  return KnownIP;

})();

BLOCKED_IPS_FILE = path.join(__dirname, 'blocked_ips.txt');

this.BanIP = (function() {
  function BanIP(server) {
    var i, ip, len, lines;
    this.server = server;
    this.known_ips = {};
    this.banned = {};
    if (fs.existsSync(BLOCKED_IPS_FILE)) {
      lines = fs.readFileSync(BLOCKED_IPS_FILE, 'utf-8').split('\n');
      for (i = 0, len = lines.length; i < len; i++) {
        ip = lines[i];
        this.banned[ip] = true;
      }
    }
    this.write_stream = fs.createWriteStream(BLOCKED_IPS_FILE, {
      flags: 'a'
    });
  }

  BanIP.prototype.banIP = function(ip) {
    var err;
    if (!ip) {
      return;
    }
    this.banned[ip] = true;
    try {
      return this.write_stream.write(ip + '\n');
    } catch (error) {
      err = error;
    }
  };

  BanIP.prototype.isBanned = function(ip) {
    if (!ip) {
      return false;
    }
    return this.banned[ip] || false;
  };

  BanIP.prototype.request = function(ip) {
    var knownip;
    if (!ip) {
      return;
    }
    knownip = this.known_ips[ip];
    if (!knownip) {
      knownip = this.known_ips[ip] = new KnownIP(this, ip);
    }
    return knownip.request();
  };

  return BanIP;

})();

module.exports = this.BanIP;
