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
        if (!process.env.NODE_PORT) {
            throw new Error(`no port given`);
        }
        if (!process.env.MESSAGE_INTERVAL) {
            throw new Error(`no message interval given`)
        }

        const MESSAGE_INTERVAL = parseInt(process.env.MESSAGE_INTERVAL, 10);
        const PORT = parseInt(process.env.NODE_PORT, 10);
        let app = express();
        let server = createServer(app);
        let io = new Server(server);

        let lastReport = new Date().getTime();
        let packetsSinceLastReport = 0;
        let reportNumber = 1;
        let disconnectCount = 0;

        server.listen(PORT, () => {
            console.log(`server listening on port ${PORT}`)
        })

        io.on('connect', (socket) => {

            socket.on('clientMessage', (msg) => {
                packetsSinceLastReport++;
                // console.log(`new message from socket ${msg.socket}: ${msg.message}`)
            });
            socket.on("disconnect", reason => {
                disconnectCount++;
                // console.log(`socket ${socket.id} disconnected for reason ${reason}`)
            })
            socket.join('all_users')
        })

        setInterval(() => {
            io.emit('serverMessage', {
                message: 'server message'
            })
        }, MESSAGE_INTERVAL)


        const printReport = () => {
            const now = new Date().getTime();
            const durationSinceLastReport = (now - lastReport) / 1000;
            const packetsPerSeconds = (
                packetsSinceLastReport / durationSinceLastReport
            ).toFixed(2);
            let room = io.sockets.adapter.rooms.get('all_users')
            if (!room) {
                return;
            }
            console.log(
                `[${reportNumber++}][port:${process.env.NODE_PORT}] client count:${room.size}; disconnect count:${disconnectCount}; average packets received per second: ${packetsPerSeconds}`
            );

            packetsSinceLastReport = 0;
            lastReport = now;
        };
        setInterval(printReport, 5000)
    }
}