var request = require("request");
var mod_tab = require('tab');
var term = require( 'terminal-kit' ).terminal ;
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('flights.db');

db.serialize(function() {
  db.run("CREATE TABLE if not exists flights (datetime int, snapshot int, flight varchar(10), lat varchar(10), lon varchar(10), altitude varchar(10), departure varchar(10), arrival varchar(10))");
});

//db.close();

var asciiMap = {
  w: 77,
  h: 25,
  x: 2,
  y: 2
};

//MALPENSA AREA
var bounds = {
  tl: {
    lat: 45.79,
    lon: 8.34
  },
  br: {
    lat: 45.45,
    lon: 9.08
  }
};
//&airport=MXP
var url = "https://data-live.flightradar24.com/zones/fcgi/feed.js?bounds=" + bounds.tl.lat + "," + bounds.br.lat + "," + bounds.tl.lon + "," + bounds.br.lon + "&faa=1&mlat=1&flarm=1&adsb=1&gnd=0&air=1&vehicles=1&estimated=1&maxage=7200&gliders=1";

var timeout = 1000;

var Map = function() {
  var _points = [];

  this.render = function() {

    term.moveTo(asciiMap.x - 1, asciiMap.y - 1);
    term.green("\u250f");
    term.moveTo(asciiMap.x + asciiMap.w + 2, asciiMap.y - 1);
    term.green("\u2513");
    term.moveTo(asciiMap.x - 1, asciiMap.y + asciiMap.h + 1);
    term.green("\u2517");
    term.moveTo(asciiMap.x + asciiMap.w + 2, asciiMap.y + asciiMap.h + 1);
    term.green("\u251b");

    for(var m = 0; m <= asciiMap.w + 1; m++) {
      term.moveTo(asciiMap.x + m, asciiMap.y - 1);
      term.green("\u2501");
      term.moveTo(asciiMap.x + m, asciiMap.y + asciiMap.h + 1);
      term.green("\u2501");
    }

    for(var m = 0; m < asciiMap.h + 1; m++) {
      term.moveTo(asciiMap.x - 1, asciiMap.y + m);
      term.green("\u2503");
      term.moveTo(asciiMap.x + asciiMap.w + 2, asciiMap.y + m);
      term.green("\u2503");
    }

    this.addPoint(
      "\u2302 MXP",
      Math.round(map_range(8.733333, bounds.tl.lon, bounds.br.lon, 0, asciiMap.w - 1)),
      Math.round(map_range(45.633333, bounds.tl.lat, bounds.br.lat, 0, asciiMap.h - 1))
    );


    for(var p = 0; p < _points.length; p++ ) {
      var pos = _points[p].x + _points[p].y*asciiMap.w;

      term.moveTo(asciiMap.x + _points[p].x, asciiMap.y + _points[p].y);
      term.red(_points[p].label);
    }

    _points = [];

  };

  this.show = function() {
    var render = "";
    for(var r = 0; r < asciiMap.h; r++) {
      var asciiRow = "";
      for(var c = 0; c < asciiMap.w; c++) {
        asciiRow += String.fromCharCode(176);
      }
      render += asciiRow + "\n";
    }

    this.addPoint(
      "M",
      Math.round(map_range(8.733333, bounds.tl.lon, bounds.br.lon, 0, asciiMap.w - 1)),
      Math.round(map_range(45.633333, bounds.tl.lat, bounds.br.lat, 0, asciiMap.h - 1))
    );

    for(var p = 0; p < _points.length; p++ ) {
      var pos = _points[p].x + _points[p].y*asciiMap.w;
      render = render.replaceAt(pos + Math.floor(pos / asciiMap.w), _points[p].label);
    }


    console.log(render);
    _points = [];
  };

  this.addPoint = function(label, x, y) {
    _points.push({
      label: label,
      x: x,
      y: y
    });
  };

};

var Flights = function() {

  var _data = {};
  var _pulling = false;
  var snapshot = 0;

  var map = new Map();

  this.pull = function(c) {

    if(_pulling)
      return;

    _pulling = true;

    request({
        url: url,
        json: true
    }, function (error, response, body) {
        _pulling = false;
        if (!error && response.statusCode === 200) {
            _data = body;
            if(typeof c == 'function')
              c(_data);
        }
    });

  };

  this.save = function() {
    for (var property in _data) {
      if(property.length == 7 && property != 'full_count' && property != 'version' && property != 'stats') {

        if(_data[property][13] == '' || _data[property][1] == '' || _data[property][2] == '')
          continue;

        var datetime = Date.now();

        db.run("INSERT into flights(datetime,snapshot,flight,lat,lon,altitude,departure,arrival) VALUES (" +
        datetime + ", " +
        snapshot + ", " +
        "\"" + _data[property][13]  + "\", " +
        "\"" + _data[property][1]  + "\", " +
        "\"" + _data[property][2]  + "\", " +
        "\"" + _data[property][4]  + "\", " +
        "\"" + _data[property][11]  + "\", " +
        "\"" + _data[property][12]  + "\"" +
        ")");
      }
    }
    snapshot++;
  }

  this.debug = function() {
    process.stdout.write('\033c');
    var rows = [];
    for (var property in _data) {
      if(property.length == 7 && property != 'full_count' && property != 'version' && property != 'stats') {
          var asciiMapX = Math.round(map_range(_data[property][2], bounds.tl.lon, bounds.br.lon, 0, asciiMap.w - 1));
          var asciiMapY = Math.round(map_range(_data[property][1], bounds.tl.lat, bounds.br.lat, 0, asciiMap.h - 1));
          rows.push(
            [
              _data[property][0],
              _data[property][13],
              _data[property][1] + "," + _data[property][2],
              _data[property][4],
              _data[property][11],
              _data[property][12],
              asciiMapX,
              asciiMapY
            ]
          );
          var char = "\u2708";
          if(asciiMapX + char.length + _data[property][13].length + 1 < asciiMap.w)
            char += " " + _data[property][13];

          map.addPoint(char, asciiMapX, asciiMapY);
      }
    }
    //console.log("Snapshot: " + snapshot);
    //console.log(clc.green("Last update: " + Date.now() + "\n"));
    //map.show();
    map.render();
    //console.log("\n");
    term.moveTo(1, asciiMap.y + asciiMap.h + 4);
    mod_tab.emitTable({
      'columns': [
        {
          'label': "ID",
          'align': 'right',
          'width': 8
        },
        {
          'label': 'Flight',
          'align': 'right',
          'width': 9
        },
        {
          'label': 'LATLONG',
          'align': 'right',
          'width': 16
        },
        {
          'label': 'ALTITUDE',
          'align': 'right',
          'width': 9
        },
        {
          'label': 'DEPARTURE',
          'align': 'right',
          'width': 9
        },
        {
          'label': 'ARRIVAL',
          'align': 'right',
          'width': 9
        },
        {
          'label': 'MAPX',
          'align': 'right',
          'width': 5
        },
        {
          'label': 'MAPY',
          'align': 'right',
          'width': 5
        }
      ],
      'rows': rows
    });



  }
};

function map_range(value, low1, high1, low2, high2) {
  return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}

String.prototype.replaceAt = function(index, character) {
    return this.substr(0, index) + character + this.substr(index+character.length);
}

process.stdout.on('resize', function() {
  //CLI RESIZE
});

var flights = new Flights();

flights.pull(function() {
  flights.debug();
});

setInterval(function() {
  flights.pull(function() {
    flights.debug();
    flights.save();
  });
}, timeout);

// var map = new Map();
// map.addPoint("W", 1, 1);
// map.show();
