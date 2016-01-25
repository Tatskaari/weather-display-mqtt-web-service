var express = require('express')
var app = express();
var mqtt = require('mqtt');
var YQL = require('yql');
var server = require('http').Server(app);
var io = require('socket.io')(server);
var suncalc = require('suncalc');

var running;
var updateWeatherInterval;

var client  = mqtt.connect('mqtt://doughnut.kent.ac.uk');
// default location to report weather on
var currentLocation = 'canterbury';

var weather = {
	// Fetches the weather information from yahoo for a fuzzy matched location	
	get: function(location, callback){
		var query = new YQL('select * from weather.forecast where woeid in (select woeid from geo.places(1) where text="' + location + '") and u = "c"');
		query.exec(function(err, data) {
			var weatherInfo = {};
			if (!err) {
				var results = data.query.results;
				if (results) {
					var channel = results.channel;
					var item = channel.item;
					if (channel.title != 'Yahoo! Weather - Error') {
						var weatherCode = parseInt(item.condition.code);

						weatherInfo.latitude = item.lat;
						weatherInfo.longitude = item.long;
						weatherInfo.mist = channel.atmosphere.visibility && channel.atmosphere.visibility < 5 ? true : false;
						weatherInfo.rain = isRaining(weatherCode);
						weatherInfo.cloud =  isCloudy(weatherCode);
						weatherInfo.conditionCode = weatherCode;
						weatherInfo.conditionDesc = item.condition.text;
						weatherInfo.temp = item.condition.temp;

						weatherInfo.location = channel.title.replace('Yahoo! Weather - ', '');

						// Solar times
						var suntimes = suncalc.getTimes(new Date(), item.lat, item.long);

						weatherInfo.sunrise = Math.round(suntimes.sunrise.getTime()/1000);
						weatherInfo.sunset = Math.round(suntimes.sunset.getTime()/1000);
					}
					else {
						err = 'No weather information for location ' + location;
					}

				};
			};

			if (err) {
				callback(err, null);
			}
			else {
				callback(null, weatherInfo);
			}
		});

		function isCloudy(weatherCode){
			if (isRaining(weatherCode) == 1) {
				return true;
			}
			else if (weatherCode >= 26 && weatherCode <= 30) {
				return true;
			}
			else if (weatherCode == 44) {
				return true;
			}

			return false;
		}

		function isRaining(weatherCode){
			if (weatherCode <= 18) {
				return true;
			}
			else if (weatherCode == 35) {
				return true;
			}
			else if (weatherCode >= 37 && weatherCode <= 43) {
				return true;
			}
			else if (weatherCode >= 45 && weatherCode <= 47) {
				return true;
			}

			return false;
		}
	}
}

function updateWeather(error, success){
	if (currentLocation) {
		weather.get(currentLocation, function(err, data){
			if (!err) {
				var lightModifier = 100;
				
				if (data.mist) {
					lightModifier = 25;
				} else if(data.rain) {
					lightModifier = 40;
				} else if(data.cloud) {
					lightModifier = 70;
				}

				currentLocation = data.location;

				client.publish('weather_sim/location', data.location);
				client.publish('weather_sim/longitude', data.longitude);
				client.publish('weather_sim/latitude', data.latitude);
				client.publish('weather_sim/rain', '' + (data.rain ? 1 : 0));
				client.publish('weather_sim/mist', '' + (data.mist ? 1 : 0));
				client.publish('weather_sim/light_modifier', '' + lightModifier);
				client.publish('weather_sim/set_sunrise', '' + data.sunrise);
				client.publish('weather_sim/set_sunset', '' + data.sunset);


				io.sockets.emit('weather', data);

				success(currentLocation);
			}
			else {
				error('ERROR updating weather: ' + err);
			}
		});
	};
}

function updateTime(){
	time = new Date().getTime();
	time = Math.round(time/1000);
	client.publish('weather_sim/set_time', '' + time);
}

function startUpdate(){
	if (!running) {
		updateWeatherInterval = setInterval(
			function(){
				updateWeather(function(err){}, function(location){});
			}, 
			10000
		);

		running = true;
		console.log('Weather updating started');
	};
}

function stopUpdate(){
	if (running) {
		clearInterval(updateWeatherInterval);
		running = false;
	}
}

function initialiseServer(){
	// Serve out the static website content
	app.use(express.static('site'));

	app.get('/location/:location', function(req, res){
		oldLocation = currentLocation;
		currentLocation = req.params.location;
		updateWeather(
			function(err){
				currentLocation = oldLocation;
				res.send({status: 'error', error: err});
			},
			function(location){
				res.send({status: 'ok', location: location});
			}
		);
	});

	app.get('/weather/:location', function(req, res){
		weather.get(req.params.location, function(err, data){
			res.send(data);
		});
	});

	app.get('/stop_update', function(req, res){
		stopUpdate();
		res.sendStatus(200);
	});

	app.get('/start_update', function(req, res){
		startUpdate();
		res.sendStatus(200);
	});

	// Start the server
	server.listen(8080, function(){
		var host = server.address().address
		var port = server.address().port
		console.log("Weather Sim listening at http://%s:%s", host, port)
	});

	io.listen(server);
	io.on('connection', function(socket){
		console.log('connection received');
	});

	setInterval(updateTime, 30000);
	startUpdate();
}

initialiseServer();