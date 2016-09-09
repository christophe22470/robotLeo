//regler le probleme de temps restant

var fs = require("fs"),
	path = require("path"),
	request = require("request"),
	express = require("express"),
	app = express(),
	bodyParser = require('body-parser'),
	server = require('http').Server(app),
	io = require('socket.io')(server),
	drivelist = require('drivelist'),
	moment = require("moment"),
	push = require("pushover-notifications"),
	getIP = require('external-ip')(),
	Unrar = require('node-unrar-update'),
	file = require("./modules/file");

var ancienIp = "";



//boucle infinie
var interval = setInterval(function(){
	fs.readFile("./config.json", function(err, data){
		configs = JSON.parse(data);
		if(configs.mode == 1){
			//prendre l'adresse ip
			getIP(function (err, ip) {
			    if (err) {
			        console.log(err);
			        io.sockets.emit("notification", {"description" : err});
			    }else{
					if(ip != ancienIp){
						//envoyer notification
						var p = new push( {
						    user: configs.notif.user,
						    token: configs.notif.token,
						});

						var msg = {
						    message: "La nouvelle adresse ip est " + ip,
						    title: "L'adresse ip a changer!!!",
						    sound: 'magic',
						    device: configs.notif.deviceName,
						    priority: 1
						};

						p.send(msg, function(err, result) {
						    if(err){
						    	console.log(err)
						    	io.sockets.emit("notification", {"description" : err});
						    }
						});

						ancienIp = ip;
					}
			    }
			});
			//si ip a changer 
			
			
			
		}
	})
}, 600000);



//MIDDLEWARE
app.use("/style", express.static(path.resolve("./style/")))
.use("/script", express.static(path.resolve("./script/")))
.use("/icon", express.static(path.resolve("./icon")))
.use(bodyParser.json())
.use(bodyParser.urlencoded({extended: true}));

//PAGES
app.get("/", function(req, res){ //page accueil
	//set header
	res.setHeader('Access-Control-Allow-Origin', '*');

	res.status(200).sendFile(path.resolve("./index.html"));
})

//SOCKETS
io.sockets.on('connection', function (socket) {
    var contentFolder = [];

	file.listFolder("./download", function(list){
		socket.emit("contentFolder", list);
	})
    //envoyer par socket

    socket.on("listFolder", function(empty){
    	file.listFolder("./download", function(list){
    		socket.emit("contentFolder", list);
    	})
    })

    socket.on("listUsb", function(empty){
    	drivelist.list(function(error, disks) {
		    if (error){
		    	console.log(error);
		    	socket.emit("notification", {"description" : error});
		    }else{
		    	for (var i = 0; i < disks.length; i++) {
		    		if(disks[i].system == true){
		    			disks.splice(i, 1);
		    		}
		    	}
		    	socket.emit("listUsb", disks);
		    }
		});
    })

    socket.on("moveFile", function(params){
    	//si .rar -> extraction -> deplacement
    	//sinon deplacer

    	if(params.fileName.split(".")[params.fileName.split(".").length - 1] == "rar"){
    		//extraction
			var rar = new Unrar("./download/" + params.fileName);

			fs.mkdir(params.destination.mountpoint + "/" + params.fileName.replace(".rar", ""), function(err){
				if(err){
					console.log(err);
					socket.emit("notification", {"description" : err});
				}
				//extraire directement dans le bon dossier
				rar.extract(params.destination.mountpoint + "/" + params.fileName.replace(".rar", ""), null, function (err) {

				    if(err){
				    	console.log(err);
				    	socket.emit("notification", {"description" : err});
				    }else{
				    	console.log("deplacer");
				    }
				    
				});
			})
    	}else{
    		//deplacement
    		fs.stat(path.resolve("./download/" + params.fileName), function(err, data){

    			if(params.destination.mountpoint != null){
    				if(err){
    					console.log(err);
    					socket.emit("notification", {"description" : err});
    				}
    				
					var total = data.size;
					//deplacement
			    	var read = fs.createReadStream("./download/" + params.fileName);
					read.on("error", function(err) {
						console.log(err);
						socket.emit("notification", {"description" : err});
					});

					read.on("data", function(chunk){
						socket.emit("statusTransfere", (100 * chunk) / total);
					})

					var write = fs.createWriteStream(params.destination.mountpoint + "/" + params.fileName);
						
					write.on("error", function(err) {
						console.log(err);
						socket.emit("notification", {"description" : err});
					});

					write.on("close", function(ex) {
						console.log("fichier deplacer");
						//notification
						socket.emit("transferCompleted", {"fileName" : params.fileName.replace(".rar", "")});
						socket.emit("notification", {"description" : params.fileName.replace(".rar", "") + " a bien été déplacé"});
					});

					read.pipe(write);
    			}else{
    				socket.emit("notification", {"description" : "Déplacement" + params.fileName.replace(".rar", "") + ": mountPoint error"});
    			}
			})
    	}

		
    })

    socket.on("deleteFile", function(params){
    	fs.unlink(path.resolve("./download/" + params), function(err){
    		if(err){
    			console.log(err);
    			socket.emit("notification", {"description" : err});
    		}else{
    			file.listFolder(path.resolve("./download"), function(files){
    				socket.emit("contentFolder", files);
    			})
    			
				socket.emit("deleteCompleted", {"fileName" : params});
				socket.emit("notification", {"description" : params + " a bien été supprimé"});
    		}
    	})
    })

    socket.on("fileInfo", function(fileName){
    	file.fileInfo(path.resolve("./download/" + fileName), function(info, err){
    		if(err){
    			socket.emit("notification", {"description" : err});
    		}else{
    			socket.emit("fileInfo", info);
    		}
    	})
    })
});

//API
app.get("/download", function(req, res){ // get language
	//set header
	res.setHeader('Access-Control-Allow-Origin', '*');

	if(req.query.link){
		//download
		res.redirect("/");
		var received = 0;
		var total = 0;
		var id = Date.now();
		var fileName = id + ".csDownload";
		var realFileName;
		var site;
		var oldPercentage = 0;
		var extension;
		var newTime;
		var oldTime;
		var olderTime;
		var remaining;
		var textRemaining;

		try{
			if (req.query.link.split('/')[2].split('.')[1] == "1fichier") {
				site = "1fichier";
			}else{
				site = null
			}
		}catch(e){
			site = null;
		}
		

		var downl = request({
		    method: 'GET',
		    uri: req.query.link
		});

		var out = fs.createWriteStream("./download/" + fileName);
		downl.pipe(out);

		downl.on('response', function ( data ) {

		    total = parseInt(data.headers['content-length' ]);

		    if(site == "1fichier"){
		    	
		    	if(data.headers['content-disposition'] != undefined){
		    		realFileName = data.headers['content-disposition'].split("\"")[1];
		    		extension = realFileName.split(".")[realFileName.split(".") - 1];
		    	}else{
		    		realFileName = id;
		    	}
		    	

		    }else{
		    	realFileName = req.url.split("/")[req.url.split("/").length - 1];
		    }
		    //socket creation telechargement
		    //realFileName = "test.jpg";
		    
		});

		downl.on('data', function(chunk) {
			newTime = Date.now();

		    received += chunk.length;

		    remaining = Math.round(total / (received / (newTime - oldTime)), 0);

			var percentage = Math.round((received * 100) / total, 0);

			if(percentage != oldPercentage || (newTime - olderTime) > 1500){
				oldPercentage = percentage;

				moment().local("fr")
				textRemaining = moment().endOf(Date.now()+remaining).fromNow();

				io.sockets.emit("updateDownload", {"fileName" : realFileName, "id" : id, "percentage" : percentage, "remaining": textRemaining});
				//envoi des donnees
				olderTime = Date.now();
			}
		    
		    oldTime = Date.now();
		    //socket update info

		});

		downl.on('end', function() {
		    //reenregistrement du fichier et traitement
		    fs.stat("./download/" + fileName, function(err, data){
		    	if(err != null){
		    		console.log(err);
		    		socket.emit("notification", {"description" : err});
		    		fs.rename("./download/" + fileName, "./download/" + realFileName, function(){
				    	//traitement
				    	io.sockets.emit("updateDownload", {"id" : id, "remaining" : "terminé", "percentage" : 100});
				    	//notification
				    	io.sockets.emit("notification", {"description" : realFileName + " a bien été téléchargé"});
				    })
		    	}else{
		    		fs.rename("./download/" + fileName, "./download/" + id + realFileName, function(){
				    	//traitement
				    	io.sockets.emit("updateDownload", {"id" : id, "remaining" : "terminé", "percentage" : 100});
				    	//notification
				    	io.sockets.emit("notification", {"description" : realFileName + " a bien été téléchargé"});
				    })
		    	}
		    })
		    
		    //socket fin de telechargement
		});

	}
})




//LISTEN PORT
server.listen(8000, function(){
	console.log("App listen on port " + 8000);
})

