define(function(require) {
	  console.log('before require 1.0.6');
  var Spinning = require('./spinning');
  console.log('after require 1.0.6');
  var s = new Spinning('#container');
  s.render();

});

