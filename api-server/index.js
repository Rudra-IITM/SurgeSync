const express = require('express');
const { generateSlug } = require('random-word-slugs');
const { ECSClient, RunTaskCommand} = require('@aws-sdk/client-ecs')
const { Server, Socket } = require('socket.io');
const Reis = require('ioredis');
require('dotenv').config()

const subscriber = new Redis(process.env.REDIS_CONNECTION_URI);

const app = express();
const io = new Server( { cors: '*' } );
const PORT = process.env.PORT | 9000;

io.on('connection', socket => {
    socket.on('subscribe', channel => {
        socket.join(channel);
        socket.emit('message', `Joined ${channel}`);
    })
})

io.listen(9001, () => {
    console.log(`Socket server running at port 9001`)
})

const ecsClient = new ECSClient({
    region: process.env.AWS_REGION,
    credentials: process.env.AWS_CREDENTIALS
})

app.use(express.json());

app.post('/project', async (req, res) => {
    const { gitUrl ,slug } = req.body;
    const projectSlug = slug ? slug: generateSlug();

    // Spin the container
    const command = new RunTaskCommand({
        cluster: process.env.CLUSTER,
        taskDefinition: process.env.TASK,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: [],
                securityGroups: []
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: '',
                    environment: [
                        { name: 'GIT_REPO_URL', value: gitUrl },
                        { name: 'PROJECT_ID', value: projectSlug}
                    ]
                }
            ]
        }
    })
    await ecsClient.send(command);

    return res.json({
        status: 'queued',
        date: {
            projectSlug, 
            url: `http://${projectSlug}.localhost:8000`
        }
    })
}) 

async function initRedisSubscribe() {
    console.log('Subscribed to logs...')
    subscriber.psubscribe('logs:*');
    subscriber.on('pmessage', (pattern, channel, message) => {
        io.to(channel).emit('message', message)
    })
}

initRedisSubscribe();

app.listen(PORT, () => {
    console.log(`API server running at port ${PORT}`)
})