import express from 'express';
import {createServer} from "http";
import {Server} from "socket.io";
import yargs from "yargs";
import cluster from "cluster";
import os from "os";

yargs(process.argv.slice(2))
    .command('*', '', {
        server_node_count: {
            type: "number",
            alias: 'snc',
            default: os.cpus().length / 2,
        },
        port: {
            type: "number",
            alias: 'p',
            default: 3001,
        },
        message_interval: {
            type: "number",
            alias: 'mi',
            default: 1000
        }
    }, handler).argv

function handler(argv: any) {
    if (cluster.isPrimary) {

    }
    const MESSAGE_INTERVAL = argv.message_interval as number;
    let port = argv.port as number;
    let app = express();
    let server = createServer(app);
    let io = new Server(server);

    server.listen(port, () => {
        console.log(`server listening on port ${port}`)
    })


    io.on('connect', (socket) => {
        socket.on('clientMessage', (msg) => {
            // console.log(`new message from socket ${msg.socket}: ${msg.message}`)
        });
        socket.on("disconnect", reason => {
            console.log(`socket ${socket.id} disconnected for reason ${reason}`)
        })
    })

    setInterval(() => {
        io.emit('serverMessage', {
            message: 'server message'
        })
    }, MESSAGE_INTERVAL)

    setInterval(() => {
        let sockets = io.sockets.sockets;
        console.log(`connected clients ${Object.keys(sockets).length}`)
    }, 5000)
}