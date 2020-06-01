const express = require('express');
const app = express()
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const fw = require('./fileWatcher.js');



//var router = express.Router();
app.use(express.json())

//websocket

io.on('connection', client => {
    client.on('event', data => {
        console.log(data)
    });

    client.on('disconnect', () => {
        console.log(client);
        console.log('disconnected')
    });
});

var fileToWatch;

console.log("Launched with args : ")
console.log(process.argv);

if(!process.argv[2]){
    fileToWatch = 'test.txt';
}

fw.startWatch("test.txt",(data)=>{
    io.emit('list-updated',String(data));
});

server.listen(43000)
console.log("listening on " + 43000)
