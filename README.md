# geconomicus
play game geconomicus

## How to setup the project

### MongoDB

- brew tap mongodb/brew
- brew update
- brew install mongodb-community@7.0

### Node.js

- brew install node

### ngrok (optional for external device proxy)

- brew install ngrok
- Create an account on https://dashboard.ngrok.com/signup
- ngrok config add-authtoken XXXX (replace XXXX with your token given after signup)

## How to launch it (in dev env)

### MongoDB

start your mongodb service first

- mkdir localdb
- cd localdb
- mongod --dbpath .

### Backend

start backend api 
- cd back
- npm install
- npm run startMon

### Frontend

start front 
- cd front
- npm install
- npm start

### External device proxy

start ngrok
- ngrok http 4200 --host-header="localhost:4200"

## UI

player view :

<img src="https://github.com/diablade/geconomicus/assets/3831334/57e6efd1-554e-43a2-aeff-9c8047b99dc8" width="200" />
