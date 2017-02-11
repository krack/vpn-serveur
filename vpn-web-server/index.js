var express  = require('express');
var exec = require('child_process').exec;
var app = express();
var port = process.env.PORT || 8080;
var vpnPort = process.env.VPN_PORT || 1194;
var http = require('http');
var fs = require("fs");
var auth = require('http-auth');

var volumeName = process.env.VOLUMENAME || "ovpn-data";
var hostname = process.env.HOSTNAME;

var basicUsername = process.env.BASIC_USERNAME || "user-test";
var basicPassword = process.env.BASIC_PASSWORD || "password-test";


var morgan = require('morgan');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');

app.use(morgan('dev'));
app.use(bodyParser.json()); // parse application/json
app.use(methodOverride('X-HTTP-Method-Override'));

var basic = auth.basic({
        realm: "test."
    }, (username, password, callback) => { 
    	callback(username === basicUsername && password === basicPassword);
    }
);

app.use(auth.connect(basic));



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

app.delete('/api/clients/:name', function(req, res) {
	removeClient(req.params.name).then(function(clients){
		res.json(clients);
	}, 
	function(){
		res.status(400).send({ "error": 'Delete client failed!' });
	});
});

/************BUSINESS ***********/

function baseCommandLine(vars){

	var baseCommandLine = "docker "
	baseCommandLine+="run --rm "
	baseCommandLine+=" -v "+volumeName+":/etc/openvpn";
	if(vars){
		for(var key in vars) {
			var val = vars[key];
			baseCommandLine+=" -e "+key+"="+val;
		};
	}
	baseCommandLine+=" kylemanna/openvpn "
	return baseCommandLine;
}

function createClient(name){
	return new Promise(function (fulfill, reject){
		removeClient(name).then(function(){
			var cmd = baseCommandLine()+"easyrsa build-client-full "+name+" nopass";
			console.log("run cmd "+cmd);
		    exec(cmd, function(error, stdout, stderr) {
		    	if(error){
		    		console.log("command failed"+error);
		    		reject();
		    	}else{
		    		fulfill();
		    	}
			});
					},
		function(){
			reject();
		});
  	});	
};

function revokeClient(name){
	return new Promise(function (fulfill, reject){
		var cmd = baseCommandLine()+"easyrsa revoke "+name;
		console.log("run cmd "+cmd);
	    exec(cmd, function(error, stdout, stderr) {
	    	if(error){
	    		console.log("command failed"+error);
	    		reject();
	    	}else{
	    		var cmd = baseCommandLine()+"easyrsa gen-crl";
				console.log("run cmd "+cmd);
			    exec(cmd, function(error, stdout, stderr) {
			    	if(error){
			    		console.log("command failed"+error);
			    		reject();
			    	}else{
			    		fulfill();
			    	}
				});
	    	}
		});
	});
};

function removeClient(name){
	return new Promise(function (fulfill, reject){
		//delete existing user if exist
		var rmReqCmd = "rm -f /etc/openvpn/pki/reqs/"+name+".req";
		console.log("run cmd "+rmReqCmd);
		exec(rmReqCmd, function(error, stdout, stderr) {
			if(error){
				console.log("command failed"+error);
				reject();
			}else {
				var rmKeyCmd = "rm -f /etc/openvpn/pki/private/"+name+".key";
				console.log("run cmd "+rmKeyCmd);
			    exec(rmKeyCmd, function(error, stdout, stderr) {
			    	if(error){
			    		console.log("command failed"+error);
			    		reject();
			    	}else{
			    		var rmCrtCmd = "rm -f /etc/openvpn/pki/issued/"+name+".crt";
						console.log("run cmd "+rmCrtCmd);
					    exec(rmCrtCmd, function(error, stdout, stderr) {
					    	if(error){
					    		console.log("command failed"+error);
					    		reject();
					    	}else{
					    		var rmIndexCmd = "sed -i /CN="+name+"$/d /etc/openvpn/pki/index.txt";
								console.log("run cmd "+rmIndexCmd);
							    exec(rmIndexCmd, function(error, stdout, stderr) {
							    	if(error){
							    		console.log("command failed"+error);
							    		reject();
							    	}else{
							    		fulfill();
							    	}
								});
					    	}
						});
			    	}
				});
			}
		});
  	});	
};


function getConfigurationClient(name){
	return new Promise(function (fulfill, reject){
		var cmd = baseCommandLine()+"ovpn_getclient "+name;
		console.log("run cmd "+cmd);
	    exec(cmd, function(error, stdout, stderr) {
	    	if(error){
	    		console.log("command failed"+error);
	    		reject();
	    	}else{
	    		fulfill(stdout);
	    	}
		});
  });	
};

function listClients(){
	return new Promise(function (fulfill, reject){
		var cmd = baseCommandLine()+'ovpn_listclients';
		console.log("run cmd "+cmd);
	    exec(cmd, function(error, stdout, stderr) {
	    	if(error){
	    		console.log("command failed"+error);
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

function initServeur(hostname){
	console.log("initServeur("+hostname+")");
	return new Promise(function (fulfill, reject){
		var cmd = baseCommandLine()+"ovpn_genconfig -u udp://"+hostname+ ":"+vpnPort+" -c -t";
		console.log("run cmd "+cmd);
	    exec(cmd, function(error, stdout, stderr) {
	    	if(error){
	    		console.log("command failed"+error);
	    		reject();
	    	}else{
	    		console.log("command succed");
	    		fulfill();
	    	}
		});
  });	
};

function initPki(){
	console.log("initPki()");
	return new Promise(function (fulfill, reject){
		var env ={
			'EASYRSA_BATCH':'1'
		};
		var cmd = baseCommandLine(env)+"ovpn_initpki nopass";
		console.log("run cmd "+cmd);
	    exec(cmd, function(error, stdout, stderr) {
	    	if(error){
	    		console.log("command failed"+error);
	    		reject();
	    	}else{
	    		fulfill(stdout);
	    	}
		});
  });	
};


function checkServerInitialized(){

	return new Promise(function (fulfill, reject){
		fs.exists("/etc/openvpn/pki/ca.crt", function(exists) {
			if(!exists){			
				console.info("Server init "+hostname);
				initServeur(hostname).then(function(){
					initPki().then(function(){
						fulfill();
					},function(error){ 
						console.error(error);
						reject();
					});
				},function(){ 
					reject();
				});
			}else{
				console.log("Server already initialized");
				fulfill();
			}
		});
	});	
}

/************MAIN  ***********/
checkServerInitialized().then(function(){
	app.listen(port);

	console.log("VPN server for " +hostname+ " listening on port " + port);
});
