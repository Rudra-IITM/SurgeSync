const express = require('express');
const { generateSlug } = require('random-word-slugs');
const { ECSClient, RunTaskCommand} = require('@aws-sdk/client-ecs')
const { Server, Socket } = require('socket.io');
const Reis = require('ioredis');

const subscriber = new Redis('rediss://default:AVNS_a5YD8X7wp_hdX5NULwT@redis-2fa52b53-rudra-techs123.a.aivencloud.com:20559');

const app = express();
const io = new Server( { cors: '*' } );
const PORT = 9000;

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
    region: '',
    credentials: {
        accessKeyId: '',
        secretAccessKey: ''
    }
})

const config = {
    CLUSTER: '',
    TASK: ''
}

app.use(express.json());

app.post('/project', async (req, res) => {
    const { gitUrl ,slug } = req.body;
    const projectSlug = slug ? slug: generateSlug();

    // Spin the container
    const command = new RunTaskCommand({
        cluster: config.CLUSTER,
        taskDefinition: config.TASK,
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
            url: `http://${projectSlug}.locahost:8000`
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