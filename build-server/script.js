const { exec } = require("child_process")
const path = require("path")
const fs = require("fs")
const mime = require("mime-types");
const Redis = require('ioredis');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const publisher = new Redis('rediss://default:AVNS_a5YD8X7wp_hdX5NULwT@redis-2fa52b53-rudra-techs123.a.aivencloud.com:20559');

const s3Client = new S3Client({
    region: '',
    credentials: {
        accessKeyId: '',
        secretAccessKey: ''
    }
})

const PROJECT_ID = process.env.PROJECT_ID;

function publishLog(log) {
    publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }))
}

async function init() {
    console.log('Executing script.js');
    publishLog('Build Started...')

    const outDirPath = path.join(__dirname, 'output');

    const p = exec(`cd ${outDirPath} && npm install && npm run build`);

    p.stdout.on('data', (data) => {
        console.log(data.toString());
        publishLog(data.toString());
    })
    
    p.stdout.on('error', (data) => {
        console.error('Error', data.toString());
        publishLog(`Error: ${data.toString()}`);
    })

    p.on('close', async() => {
        console.log('Build Complete');
        publishLog('Build Complete');

        const distFolderPath = path.join(__dirname, 'output', 'dist');

        const distFolderContents = fs.readFileSync(distFolderPath, {recursive: true});

        publishLog(`Starting to upload files`)
        for (const file in distFolderContents) {
            const filePath = path.join(distFolderPath, file);

            if (fs.lstatSync(filePath).isDirectory()) continue;

            console.log(`Uploading ${file}`)
            publishLog(`Uploading ${file}`);

            const command = new PutObjectCommand({
                Bucket: '',
                Key: `__outputs/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(filePath),
                ContentType: mime.lookup(filePath),
            })
            await s3Client.send(command);
            console.log(`Uploaded ${file}`)
            publishLog(`Uploaded ${file}`)

        }
        publishLog('Done...');
        console.log(`Done...`)
    })
}

init()