const fs = require('fs');

module.exports = {
    startWatch : (fileTowatch,callback)=>{
        fs.watch(fileTowatch,{encoding : 'UTF-8'}, (eventType, filename) => {
            if (eventType === "change") {
                fs.readFile(fileTowatch, (err, data) => {
                if (err) throw err;

                    callback(data);
            });
            }
        });
    }
}