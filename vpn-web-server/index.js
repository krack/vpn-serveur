var express  = require('express');
var exec = require('child_process').exec;
var app = express();
var port = process.env.PORT || 8080;
var http = require('http');



var morgan = require('morgan');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');

app.use(morgan('dev'));
app.use(bodyParser.json()); // parse application/json
app.use(methodOverride('X-HTTP-Method-Override'));


/************** API ***************/

app.get('/api/clients/', function(req, res) {
	listClients().then(function(clients){
		res.json(clients);
	}, 
	function(){
		res.status(400).send({ "error": 'Get list clients failed!' });
	});
});

app.post('/api/clients/', function(req, res) {
	var clientName= req.body.name;
	createClient(clientName).then(function(){
		getConfigurationClient(clientName).then(function(configuration){
			res.send(configuration);
		}, 
		function(){
			res.status(400).send({ "error": 'Get configuration failed!' });
		});
	}, 
	function(){
		res.status(400).send({ "error": 'Create failed!' });
	});
});



/************BUSINESS ***********/
var baseCommandLine = "docker run --rm -v ovpn-data:/etc/openvpn kylemanna/openvpn "

function createClient(name){
	return new Promise(function (fulfill, reject){
		var cmd = baseCommandLine+"easyrsa build-client-full "+name+" nopass";
	    exec(cmd, function(error, stdout, stderr) {
	    	if(error){
	    		reject();
	    	}else{
	    		fulfill();
	    	}
		});
  });	
};
function getConfigurationClient(name){
	return new Promise(function (fulfill, reject){
		var cmd = baseCommandLine+"ovpn_getclient "+name;
	    exec(cmd, function(error, stdout, stderr) {
	    	if(error){
	    		reject();
	    	}else{
	    		fulfill(stdout);
	    	}
		});
  });	
};

function listClients(){
	return new Promise(function (fulfill, reject){
		var cmd = baseCommandLine+'ovpn_listclients';
	    exec(cmd, function(error, stdout, stderr) {
	    	if(error){
	    		reject();
	    	}else{
		    	var lines = stdout.split("\n");
				var clients = [];
				for(var i = 1; i < lines.length; i++){
					if(lines[i]){
						var cell = lines[i].split(",");
						clients.push({
							"name" : cell[0],
							"valid" : cell[3]=== "VALID"
						});
					}
				}

				fulfill(clients);
			}
		});
  	});	
};

/************MAIN  ***********/
app.listen(port);
console.log("App listening on port " + port);
