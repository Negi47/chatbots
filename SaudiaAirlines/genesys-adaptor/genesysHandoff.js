/* eslint-disable eqeqeq */
var os = require("os");


const {
    CloudAdapter,
    createBotFrameworkAuthenticationFromConfiguration,
    ConfigurationServiceClientCredentialFactory
} = require('botbuilder');

const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
    MicrosoftAppId: process.env.MicrosoftAppId,
    MicrosoftAppPassword: process.env.MicrosoftAppPassword,
    MicrosoftAppType: process.env.MicrosoftAppType,
    MicrosoftAppTenantId: process.env.MicrosoftAppTenantId
});
const botFrameworkAuthentication = createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);
const adapter = new CloudAdapter(botFrameworkAuthentication);

function createHandoverConnection(id, conversationReference, queue, history, handoverRouter) {
    const TOKEN = id.split('|')[0];
    const DEPLOYMENTID = 'fd989a69-f1ec-4d9f-91ff-4326772d3d7c';
    const wsURL = `wss://webmessaging.mypurecloud.de/v1?deploymentId=${DEPLOYMENTID}`;
    const WebSocket = require('ws');
    const socket = new WebSocket(wsURL);
    let pingInterval;
    let pingCounter = 0;
    console.log("Creating socket connection")

    socket.addEventListener('error', function (event) {
        console.log('WebSocket error');
        console.log(event.error);
    });

    // Listen for messages
    socket.addEventListener('message', function (event) {
        const message = JSON.parse(event.data);
        console.log("message from socket:")
        console.log(message);

        if (message.code == 200 && message.class == 'SessionResponse') {
            if (queue) {
                let msg = {
                    action: 'onMessage',
                    token: TOKEN,
                    message: {
                        type: 'Text',
                        text: queue,
                        channel: {
                            metadata: {
                                customAttributes: {
                                    va_history: "a~~b~~c~~d"//history
                                }
                            }
                        }
                    }
                };

                msg = JSON.stringify(msg);
                socket.send(msg);
            }
        }

        if (message.code == 200 && message.class == 'StructuredMessage' && message.body && message.body.type == "Event" && message.body.events && message.body.events.length && message.body.originatingEntity == 'Human') {
            if (message.body.events[0]) {
                let event = message.body.events[0];
                if (event.eventType == "Presence" && event.presence && event.presence.type == "Disconnect") {
                    forwardMessage(conversationReference, "Conversation disconnected by an agent.");
                    clearInterval(pingInterval);
                    socket.terminate();
                }
            }
        }

        if (message.code == 200 && message.class == 'StructuredMessage' && message.body && message.body.direction == "Inbound" && message.body.originatingEntity != 'Human') {
            var hostname = os.hostname();
            console.log("Hostname ", hostname)
            if(message.body.channel && message.body.channel.metadata && message.body.channel.metadata.customAttributes && message.body.channel.metadata.customAttributes.host && message.body.channel.metadata.customAttributes.host != hostname){
                clearInterval(pingInterval);
                socket.terminate();
            }
        }

        if (message.code == 200 && message.class == 'StructuredMessage' && message.body && message.body.originatingEntity == 'Human') {
            forwardMessage(conversationReference, message.body.text);
        }
    });

    // Connection opened
    socket.addEventListener('open', function (event) {
        // console.log('WebSocket connected');
        let data = {
            action: 'configureSession',
            deploymentId: DEPLOYMENTID,
            token: TOKEN
        };

        pingInterval = setInterval(function() {
            if (pingCounter >= 2) {// how many missed pings you will tolerate before assuming connection broken.
                socket.terminate();
            } else {
                socket.ping();
                pingCounter++;
            }
        }, 180*1000);

        data = JSON.stringify(data);
        console.log("Configuring session")
        console.log(JSON.stringify(data))
        socket.send(data);
    });

    socket.addEventListener("pong", function() { // we received a pong from the client.
       pingCounter = 0; // reset ping counter.
    });

    socket.addEventListener('close', function (event) {
        console.log('WebSocket closed');
        console.log(event.code)
        clearInterval(pingInterval);
        if (event.code == 1001) {
            console.log("reopening")
            handoverRouter[id] = reconfigureConnection(id, conversationReference, null, handoverRouter);
        }
    });

    return socket;
}

function reconfigureConnection(id, conversationReference, inputText, handoverRouter) {
    const TOKEN = id.split('|')[0];
    const DEPLOYMENTID = 'fd989a69-f1ec-4d9f-91ff-4326772d3d7c';
    const wsURL = `wss://webmessaging.mypurecloud.de/v1?deploymentId=${DEPLOYMENTID}`;
    const WebSocket = require('ws');
    const socket = new WebSocket(wsURL);
    let pingInterval;
    let pingCounter = 0;

    console.log("RECONFIGURING")

    socket.addEventListener('error', function (event) {
        console.log('WebSocket error');
        console.log(event.error);
    });

    // Listen for messages
    socket.addEventListener('message', function (event) {
        const message = JSON.parse(event.data);
        
        var hostname = os.hostname();
        // console.log(message);

        if (message.code == 200 && message.class == 'SessionResponse') {
            if (message.body.readOnly == true) {
                console.log("Failed for conversation " + id)
                forwardMessage(conversationReference, "Connection to agent lost")
            } else if(inputText != null) {
                let msg = {
                    action: 'onMessage',
                    token: TOKEN,
                    message: {
                        type: 'Text',
                        text: inputText,
                        channel: {
                            metadata: {
                                customAttributes: {
                                    host: hostname
                                }
                            }
                        }
                    }
                };
                msg = JSON.stringify(msg);
                socket.send(msg);
            }

        }

        if (message.code == 200 && message.class == 'StructuredMessage' && message.body && message.body.type == "Event" && message.body.events && message.body.events.length && message.body.originatingEntity == 'Human') {
            if (message.body.events[0]) {
                let event = message.body.events[0];
                if (event.eventType == "Presence" && event.presence && event.presence.type == "Disconnect") {
                    forwardMessage(conversationReference, "Conversation disconnected by an agent.");
                    clearInterval(pingInterval);
                    socket.terminate();
                }
            }
        }

        if (message.code == 200 && message.class == 'StructuredMessage' && message.body && message.body.direction == "Inbound" && message.body.originatingEntity != 'Human') {
            var hostname = os.hostname();
            console.log("Hostname ", hostname)
            if(message.body.channel && message.body.channel.metadata && message.body.channel.metadata.customAttributes && message.body.channel.metadata.customAttributes.host && message.body.channel.metadata.customAttributes.host != hostname){
                clearInterval(pingInterval);
                socket.terminate();
            }
        }

        if (message.code == 200 && message.class == 'StructuredMessage' && message.body && message.body.originatingEntity == 'Human') {
            forwardMessage(conversationReference, message.body.text);
        }
    });

    // Connection opened
    socket.addEventListener('open', function (event) {
        console.log('WebSocket connected');

        let data = {
            action: 'configureSession',
            deploymentId: DEPLOYMENTID,
            token: TOKEN
        };

        pingInterval = setInterval(function() {
            if (pingCounter >= 2) {// how many missed pings you will tolerate before assuming connection broken.
                socket.terminate();
            } else {
                socket.ping();
                pingCounter++;
            }
        }, 180*1000);

        data = JSON.stringify(data);
        console.log("Configuring session")
        console.log(JSON.stringify(data))
        socket.send(data);
    });

    socket.addEventListener("pong", function() { // we received a pong from the client.
        pingCounter = 0; // reset ping counter.
     });

    socket.addEventListener('close', function (event) {
        console.log('WebSocket closed');
        console.log(event.code)
        clearInterval(pingInterval);
        if (event.code == 1001) {
            console.log("reopening")
            handoverRouter[id] = reconfigureConnection(id, conversationReference, null);
        }
    });

    return socket;
}

function sendMessage(socket, id, inputText) {
    const TOKEN = id.split('|')[0];
    let msg = {
        action: 'onMessage',
        token: TOKEN,
        message: {
            type: 'Text',
            text: inputText
        }
    };
    // console.log(msg)
    msg = JSON.stringify(msg);

    socket.send(msg);
}

async function forwardMessage(conversationReference, message) {
    await adapter.continueConversationAsync(process.env.MicrosoftAppId, conversationReference, async context => {
        await context.sendActivity(message);
    });
}

module.exports = {
    createHandoverConnection,
    reconfigureConnection,
    sendMessage
};

// {
//     "conversationId": "616ad9f0-02db-11ee-9e8e-9fe234b18c33|livechat",
//     "token": "616ad9f0-02db-11ee-9e8e-9fe234b18c33|livechat",
//     "expires_in": 2147483647,
//     "streamUrl": ""
//   }
