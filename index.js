const storage = require('node-persist');
const express = require('express');
const app = express()
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const fw = require('./fileWatcher.js');



//var router = express.Router();
app.use(express.json())
 
//you must first call storage.init
storage.init( /* options ... */ );


app.get('/:id', function (req, res) {
        storage.getItem(req.params.id).then(data =>{
            return res.send(data);
        },err =>{
            return res.send(err); 
        })
})

app.post('/:id', function (req, res) {
    storage.setItem(req.params.id,req.body).then(data =>{
        return res.send(data);
    },err =>{
        return res.send(err); 
    })
})

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
if(!process.argv[2]){
    fileToWatch = 'test.txt';
}

fw.startWatch("test.txt",(data)=>{
    io.emit('list-updated',String(data));
});

server.listen(43000)
