import express from 'express';
import {createServer} from "http";
import {Server} from "socket.io";
import yargs from "yargs";
import cluster, {Worker} from "cluster";

yargs(process.argv.slice(2))
    .command('*', '', {
        ports: {
            type: "array",
            alias: 'p',
            default: [3000],
        },
        message_interval: {
            type: "number",
            alias: 'mi',
            default: 1000
        }
    }, handler)
    .argv

function handler(argv: any) {

    if (cluster.isPrimary) {
        console.log(`in cluster`)
        let workers: Worker[] = [];
        const NODE_PORTS = argv.ports as string[];
        for (let i = 0; i < NODE_PORTS.length; i++) {
            let worker = cluster.fork({
                NODE_PORT: NODE_PORTS[i],
                MESSAGE_INTERVAL: argv.message_interval,
            })
            worker.on('message', (msg) => {
                for (let j = 0; j < workers.length; j++) {
                    if (workers[j] !== worker) {
                        workers[j].send(msg)
                    }
                }
            })
            workers.push(worker);
        }
    } else {
        console.log(`in worker`)
        if (!process.env.NODE_PORT) {
            throw new Error(`no port given`);
        }
        if(!process.env.MESSAGE_INTERVAL){
            throw new Error(`no message interval given`)
        }

        const MESSAGE_INTERVAL = parseInt(process.env.MESSAGE_INTERVAL, 10);
        const PORT = parseInt(process.env.NODE_PORT, 10);
        let app = express();
        let server = createServer(app);
        let io = new Server(server);

        server.listen(PORT, () => {
            console.log(`server listening on port ${PORT}`)
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

        // setInterval(() => {
        //     let sockets = io.sockets.sockets;
        //     console.log(`connected clients ${Object.keys(sockets).length}`)
        // }, 5000)
    }
}