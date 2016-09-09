var app = angular.module('app', ['ngAnimate'])

.factory('socket', function ($rootScope) {
  var socket = io.connect();
  return {
    on: function (eventName, callback) {
      socket.on(eventName, function () {  
        var args = arguments;
        $rootScope.$apply(function () {
          callback.apply(socket, args);
        });
      });
    },
    emit: function (eventName, data, callback) {
      socket.emit(eventName, data, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          if (callback) {
            callback.apply(socket, args);
          }
        });
      })
    }
  };
});
// Define the `PhoneListController` controller on the `phonecatApp` module
app.controller('indexController', function($scope, $window, $http, socket, $interval) {
    $scope.location = $window.location.href;
    $scope.allDownload = [];
    $scope.notifications = [];
    $scope.fichierInfos = {};
    $scope.statusTransfere = 0;

    socket.on("updateDownload", function(infos){

        if($scope.allDownload.length < 1){
            $scope.allDownload.push(infos);
        }else{
            var find = false;
            for (var i = 0; i < $scope.allDownload.length; i++) {
                if($scope.allDownload[i].id == infos.id){
                    $scope.allDownload[i].percentage = infos.percentage;



                    $scope.allDownload[i].remaining = infos.remaining;

                    if($scope.allDownload[i].remaining == "terminé"){
                        $scope.allDownload.splice(i, 1);

                        socket.emit("listFolder", "");
                    }
                    find = true;
                }
            }
            if (find == false) {
                $scope.allDownload.push(infos);
            }
        }
    })

    socket.on("contentFolder", function(content){
        $scope.contentFolder = [];
        $scope.contentFolder = content;
    })

    socket.on("listUsb", function(listUsb){
        $scope.listUsb = listUsb;
    })

    socket.on("transferCompleted", function(file){
        $scope.popupActive = false;
        $scope.popupTransfereActive = false;
    })

    socket.on("deleteCompleted", function(file){
        $scope.popupActive = false;
        $scope.popupSupprActive = false;
    })

    socket.on("notification", function(notification){
        notification.date = Date.now();
        $scope.notifications.push(notification);
    })

    socket.on("fileInfo", function(data){
        if(data.size < 1000){
            $scope.fichierInfos.taille = data.size + "octets";
        }else if(data.size >= 100000000){
            $scope.fichierInfos.taille = Math.round((data.size / 100000000), 1) + "Go";
        }else if(data.size >= 1000000){
            $scope.fichierInfos.taille = Math.round((data.size / 1000000), 1) + "Mo";
        }else if(data.size > 999){
            $scope.fichierInfos.taille = Math.round((data.size / 1000), 0) + "Ko";
        }
    })

    socket.on("statueTransfere", function(status){
        $scope.statueTransfere = status
    })

    $scope.sendDownload = function(){
        $http.get($window.location.href+"download?link=" + $scope.linkInput)
            .success(function(data, statue){
                $scope.linkInput = "";
            })
            .error(function(data, statue){
                console.error(data);
            })
    }

    $scope.popTransferer = function(file){
        socket.emit("listUsb", "");
        $scope.transferFileName = file.fileName;
        $scope.popupTransfereActive = true;
        $scope.popupActive = true;
    }

    $scope.popSupprimer = function(file){
        $scope.bufferFile = file;
        $scope.popupSupprActive = true;
        $scope.popupActive = true;
        
    }

    $scope.popInfos = function(file){
        socket.emit("fileInfo", file.fileName);
        $scope.fichierInfos.name = file.fileName;
        $scope.popupInfoActive = true;
        $scope.popupActive = true;
    }
    
    $scope.closePopUp = function(){
        $scope.popupActive = false;
        $scope.popupTransfereActive = false;
        $scope.popupSupprActive = false;
        $scope.popupInfoActive = false;
    }

    $scope.transferer = function(){
        socket.emit("moveFile", {"fileName" : $scope.transferFileName, "destination" : $scope.selectDisk});
    }

    $scope.annuler = function(){
        $scope.popupActive = false;
        $scope.popupTransfereActive = false;
        $scope.popupSupprActive = false;
        $scope.popupInfoActive = false;
        $scope.bufferFile = "";
    }

    $scope.supprimer = function(){
        socket.emit("deleteFile", $scope.bufferFile.fileName);
    }

    $scope.deleteNotification = function(notification){
        for (var i = 0; i < $scope.notifications.length; i++) {

            if ($scope.notifications[i].description == notification.description) {
                $scope.notifications.splice(i, 1);
            }
            
        }
    }

    var intervalNotif;
    intervalNotif = $interval(function(){
        for (var i = 0; i < $scope.notifications.length; i++) {
            if ((Date.now() - $scope.notifications[i].date) > 4000) {
                $scope.notifications.splice(i, 1);
            }
            
        }
    }, 1000)

});