const express = require('express');
const httpProxy = require('http-proxy');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config()

const app = express();
const prisma = new PrismaClient({});
const proxy = httpProxy.createProxy();

const PORT = 8000;
const BASE_PATH = process.env.BASE_PATH;

app.use(async (req, res) => {
    const hostname = req.hostname;
    const subDomain = hostname.split('.')[0];

    // Custom Domain - DB Query

    const resolvesTo = `${BASE_PATH}/${subDomain}`;

    return proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
})

proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url;
    if (url === '/')
        proxyReq.path += 'index.html'
})

app.listen(PORT, () => {
    console.log(`Reverse Proxy Running at Port ${PORT}`)
})