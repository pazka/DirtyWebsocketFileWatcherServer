const express = require('express');
const app = express()
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const fw = require('./fileWatcher.js');
const { exec } = require('child_process');



//var router = express.Router();
app.use(express.json())

//websocket
io.on('connection', client => {
    client.on('connected', () => {
        console.log(client.conn.remoteAddress);
        console.log('connected')
    });

    client.on('event', data => {
        console.log(data)
    });

    client.on('disconnect', () => {
        console.log(client.conn.remoteAddress);
        console.log('disconnected')
    });
});


//rest waiting
app.post('ports',(req,res,next)=>{
    getPorts((ports)=>{
        io.emit('ports-updated',String(ports));
    });
    next();
})

//ge Port function
function getPorts(callback){
    console.log("looking for ports");
    exec('sudo netstat -tulpn | grep LISTEN', (err, stdout, stderr) => {
        if (err) {
            //some err occurred
            callback(err);
        } else {
            callback(String(stdout +"\n\n\n####\n\n\n" + stderr));
        }
    });
}

//port timer
setTimeout(()=>{
    getPorts((ports)=>{
        io.emit('ports-updated',String(ports));
    })
},60000);

//filewatcher
var fileToWatch;

console.log("Launched with args : ")
console.log(process.argv);

if(!process.argv[2]){
    fileToWatch = 'test.txt';
}

fw.startWatch("test.txt",(data)=>{
    console.log("sending data");
    io.emit('list-updated',String(data));
});

server.listen(43000)
console.log("listening on " + 43000)
