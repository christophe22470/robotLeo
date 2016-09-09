var fs = require("fs"),
	path = require("path");

//format liste fichier: {fileName, icon, extension, type}

var listFolder = function(paths, callback){
    fs.readdir(path.resolve(paths), function(err, files) {
    	contentFolder = [];

		for (var j=0; j<files.length; j++) {
		    if (files[j].split(".")[1] == "csDownload" || files[j] == ".DS_Store") {
		        	
		    }else{
		    	var icon = "";
		       	var extension = "";
		       	var type = "";
		       	//rar png avi jpg mkv fic pdf
		        switch(files[j].split(".")[files[j].split(".").length - 1]){
		        	case "rar":
		        		icon = "/icon/rar.png";
		        		extension = "rar";
		        		break;
		        	case "png":
		        		icon = "/icon/png.png";
		        		extension = "png";
		        		break;
		        	case "avi":
		        		icon = "/icon/avi.png";
		        		extension = "avi";
		        		break;
		        	case "jpg":
		        		icon = "/icon/jpg.png";
		        		extension = "jpg";
		        		break;
		        	case "mkv":
		        		icon = "/icon/mkv.png";
		        		extension = "mkv";
		        		break;
		        	case "pdf":
		        		icon = "/icon/pdf.png";
		        		extension = "pdf";
		        		break;
		        	default:
		        		icon = "/icon/fic.png";
		        		extension = "fic";
		        		break;

		        }

		        //fs.stats.isfile()
		        if(fs.statSync(path.resolve(paths)).isFile() == true){
		        	type = "file";
		        }else{
		        	type = "folder";
		        }
		        

		        contentFolder.push({"fileName" : files[j], "icon" : icon, "extension" : extension, "type" : type});
		    }
		}
		callback(contentFolder);
	});
}

var fileInfo = function(paths, callback){
	fs.stat(paths, function(err, data){
    	if (err) {
    		console.log(err);
    		callback("", err);
    	}else{
    		callback(data);
    	}
    })
}

exports.listFolder = listFolder;
exports.fileInfo = fileInfo;