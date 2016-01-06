var express = require('express');
var mqtt = require('mqtt');

var client  = mqtt.connect('mqtt://doughnut');
var app = express();

app.get("/temp/:temp", function(req, res){
	res.send(req.params.temp);
	client.publish('jfp6/temp', req.params.temp);
});

var server = app.listen(8080, function(){
	var host = server.address().address
	var port = server.address().port
	console.log("Example app listening at http://%s:%s", host, port)
});