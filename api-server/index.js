const express = require('express');
const { generateSlug } = require('random-word-slugs');
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs')
const { Server } = require('socket.io');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@clickhouse/client');
const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
require('dotenv').config()

const client = createClient({
    host: process.env.CLICKHOUSE_HOST,
    database: process.env.CLICKHOUSE_DATABASE || 'default',
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
});

const prisma = new PrismaClient({});

const app = express();
const io = new Server({ cors: '*' });
const PORT = process.env.PORT | 9000;

const kafka = new Kafka({
    clientId: `api-server`,
    brokers: process.env.KAFKA_BROKER,
    ssl: {
        ca: [fs.readFileSync(path.join(__dirname, 'kafka.pem'), 'utf-8')],
    },
    sasl: {
        mechanism: 'plain',
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD,
    },
});

const consumer = kafka.consumer({ groupId: 'api-server-logs-consumer' });

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
app.use(cors());

app.get('/logs:id', async (req, res) => {
    const { id } = req.params;
    const logs = await client.query({
        query: `SELECT event_id, deployement_id, log, timesatmp FROM log_events WHERE deployement_id = {deployement_id: String}`,
        query_params: {
            deployement_id: id
        },
        format: 'JSONEachRow'
    });

    const rawLogs = await logs.json();
    return res.json({
        status: 'success',
        data: rawLogs
    })
});

app.post('/project', async (req, res) => {
    const projectSchema = z.object({
        name: z.string(),
        gitURL: z.string(),
    })

    const { success, error, data } = projectSchema.safeParse(req.body);
    if (!success) {
        return res.status(400).json({ error: error });
    }

    const { name, gitURL } = data;

    const project = prisma.project.create({
        data: {
            name,
            gitURL,
            subDomain: generateSlug(),
        }
    });

    return res.json({
        status: 'success',
        data: project
    });
});

app.post('/deploy', async (req, res) => {
    const { projectId } = req.body;

    const project = await prisma.project.findUnique({
        where: {
            id: projectId
        }
    });

    if (!project) {
        return res.status(404).json({
            error: 'Project not found'
        });
    }

    const deployement = await prisma.deployement.create({
        data: {
            projectId: project.id,
            status: 'QUEUED'
        },
    });

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
                    name: 'build-sevice',
                    environment: [
                        { name: 'GIT_REPO_URL', value: project.gitURL },
                        { name: 'PROJECT_ID', value: projectId },
                        { name: 'DEPLOYEMENT_ID', value: deployement.id },
                    ]
                }
            ]
        }
    })
    await ecsClient.send(command);

    return res.json({
        status: 'queued',
        data: {
            deployementId: deployement.id
        }
    })
})

async function InitKafkaConsumer() {
    await consumer.connect();
    await consumer.subscribe({ topic: ['container-logs'] });

    await consumer.run({
        autoCommit: false,
        eachBatch: async ({ batch, heartbeat, resolveOffset, commitOffsetsIfNecessary }) => {
            const messages = batch.messages;
            console.log(`Received ${messages.length} messages...`);
            for (const message of messages) {
                const stringMsg = message.value.toString();
                const { PROJECT_ID, DEPLOYEMENT_ID, log } = JSON.parse(stringMsg);
                console.log('Received Log:', log);
                const { query_id } = await client.insert({
                    table: 'log_events',
                    values: [
                        {
                            event_id: uuidv4(),
                            deployement_id: DEPLOYEMENT_ID,
                            log: log
                        }
                    ],
                    format: 'JSONEachRow',
                })
                resolveOffset(message.offset);
                await commitOffsetsIfNecessary(message.offset);
                await heartbeat();
            }
        }
    })
}

InitKafkaConsumer();

app.listen(PORT, () => {
    console.log(`API server running at port ${PORT}`)
})