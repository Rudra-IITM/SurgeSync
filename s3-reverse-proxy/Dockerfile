FROM ubuntu

RUN apt-get update
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get upgrade -y
RUN apt-get install -y nodejs

WORKDIR /home/app

COPY index.js index.js
COPY package*.json .
COPY prisma/ prisma/

RUN npm install

RUN chmod +x index.js

ENTRYPOINT [ "node", "index.js" ]
