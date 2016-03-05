//Server Side
var express = require("express");
var app     = express();
var server  = require('http').createServer(app);
var io      = require('socket.io').listen(server);

server.listen(3000);

var map = {"map": "../img/01_karelia.jpg"};
var nodes = new Array();

io.sockets.on("connection", function(socket) {
    console.log("Connecting socket");
    
    //Entra numa CW sala
    socket.on('subscribe', function(room) { 
        console.log('joining room', room);
        socket.join(room); 
        socket.emit("clearMap", {});
        socket.emit("changeMap", map);
    })
    
    //Sai da CW sala    
    socket.on('unsubscribe', function(room) {  
        console.log('leaving room', room);
        socket.leave(room); 
    })

    //socket.emit("clearMap", {});
    //socket.emit("changeMap", map);

    nodes.forEach(function(item) {
        socket.emit("drawNode", item);
    });

    socket.on("redrawNodes", function(data) {
        socket.emit("clearMap", {});
        socket.emit("changeMap", map);

        nodes.forEach(function(item) {
            socket.emit("drawNode", item);
        });
    })

    socket.on("changeMap", function(data) {
        map = data;
        io.sockets.in(data.room).emit("changeMap", map);
    });

    socket.on("clearMap", function(data) {
        nodes.length = 0;
        io.sockets.in(data.room).emit("clearMap", data);
    });

    socket.on("pingMap", function(data) {
        io.sockets.in(data.room).emit("pingMap", data);
    });

    socket.on("drawNode", function(data) {
        nodes.push(data);
        io.sockets.in(data.room).emit("drawNode", data);
    });

    socket.on("dragNode", function(data) {
        nodes.forEach(function(item) {
            if(item.name == data.name) {
                item.x = data.x;
                item.y = data.y;
            }
        });

        io.sockets.in(data.room).emit("dragNode", data);
    });

    socket.on("disconnect", function(socket) {
        console.log("Disconnecting socket");
    });
});