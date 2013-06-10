#!/usr/bin/env node

// increase the libuv threadpool size to 1.5x the number of logical CPUs.
process.env.UV_THREADPOOL_SIZE = Math.ceil(Math.max(4, require('os').cpus().length * 1.5));

var mapnik = require('mapnik');
var express = require('express');
var request = require('request');
var zlib = require('zlib');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');

var port = 3000;

var app = express();

var base_url = "http://d1s11ojcu7opje.cloudfront.net/dev/764e0b8d/"
var url = "{prefix}/{z}/{x}/{y}.vector.pbf"
    
app.get('/:z/:x/:y.:format', function(req, res, next) {
    var z = parseInt(req.params.z,10) | 0;
    var x = parseInt(req.params.x,10) | 0;
    var y = parseInt(req.params.y,10) | 0;
    var tile = url
        .replace(/\{prefix\}/g, (x%16).toString(16) + (y%16).toString(16))
        .replace(/\{z\}/g, z)
        .replace(/\{x\}/g, x)
        .replace(/\{y\}/g, y);
    var cached = './tiles/'+tile;
    fs.exists(cached, function(exists) {
        if (exists) {
            //console.log('pulling from cache');
            fs.readFile(cached,function(err,buffer) {
                if (err) throw err;
                var tile = new mapnik.VectorTile(z,x,y);
                tile.setData(buffer,function(err,success) {
                    if (err) return next(err);            
                    if (!success) return next(new Error("could not parse protobuf"));
                    res.set({'Content-Type':'application/json'});
                    var all_geojson = JSON.stringify(tile.toGeoJSON('__all__'));
                    res.send(JSON.stringify(tile.toGeoJSON(1)/*all_geojson*/));
                });
            });
        } else {
            request({uri:base_url+tile,encoding:null}, function (error, response, body) {
                if (error) return next(error);
                if (response.statusCode != 200) {
                    return next("server returned: "+response.statusCode);
                }
                zlib.inflate(body, function(err, body) {
                    if (err) return next(err);
                    mkdirp(path.dirname(cached),function(err){
                        if (err) return next(err);
                        fs.writeFileSync(cached,body);
                        var tile = new mapnik.VectorTile(z,x,y);
                        tile.setData(body,function(err,success) {
                            if (err) return next(err);            
                            if (!success) return next(new Error("could not parse protobuf"));
                            res.set({'Content-Type':'application/json'});
                            var all_geojson = JSON.stringify(tile.toGeoJSON('__all__'));
                            res.send(JSON.stringify(tile.toGeoJSON(1)/*all_geojson*/));
                        });
                    });
                });
            })
        }
    });
});

app.get('/', function(req, res) {
    res.send(require('fs').readFileSync('./index.html', 'utf8'));
});

app.get('/:file', function(req, res) {
    res.send(require('fs').readFileSync(req.params.file, 'utf8'));
});

app.listen(port);

console.log("listening on localhost:"+port)
