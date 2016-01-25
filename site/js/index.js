var socket = io.connect();
var newLocation = true;

socket.on('weather', function(data){
	console.log(data);
	displayWeather(data);
});

$('#location-field').keypress(function(event){
	if (event.which == 13) {
		newLocation = true;
		var locationField = $(this);
		var location = locationField.val();
		$.getJSON("location/" + location, {}, function(data){
	        if(data.status == 'ok'){
	        	locationField.val('');
	        } else {
	        	alert(data.error);
	        }
	    });
	}
});

function displayWeather(weatherData){
	$(".weather .location-desc").html(' - ' + weatherData.location);
	
	setProgBarVal($('.weather .temp-bar'), weatherData.temp, '°C');
	
	if (newLocation) {
		$(".weather .map").geomap({
			center: [ weatherData.longitude, weatherData.latitude ],
	  		zoom: 10
		});

		newLocation = false;
	};

	$(".weather .condition").html(weatherData.conditionDesc);
	$(".weather .rain").html(weatherData.rain ? 'on' : 'off');
	$(".weather .mist").html(weatherData.mist ? 'on' : 'off');
	$(".weather .cloud").html(weatherData.cloud ? 'on' : 'off');
}

function setProgBarVal(bar, val, units){
	var maxVal = bar.attr('aria-valuemax');
	var minVal = bar.attr('aria-valuemin');

	var percentage = val/(maxVal - minVal)*100;

	bar.css('width', percentage+'%').attr('aria-valuenow', val); 
	bar.html(val + ' ' + units);
}