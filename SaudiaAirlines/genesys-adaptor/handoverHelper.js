
var handoverRouter = {};

const genesysHandoff = require('./genesysHandoff');

const WebSocket = require('ws');

exports.createHandoverConnection = function(id, conversationReference, queue, history) {    
    handoverRouter[id] = genesysHandoff.createHandoverConnection(id, conversationReference, queue, history, handoverRouter);
    return {
        socket: handoverRouter[id],
        new: true
    };
};

exports.getHandoverRouter = function(id, conversationReference, inputText) {

    if (handoverRouter[id] && handoverRouter[id].readyState != WebSocket.CLOSED) {
        console.log("reusing socket connection")
        console.log("readystate" + handoverRouter[id].readyState)
        return {
            socket: handoverRouter[id],
            new: false
        };
    } else {
        handoverRouter[id] = genesysHandoff.reconfigureConnection(id, conversationReference,inputText,handoverRouter);
        return {
            socket: handoverRouter[id],
            new: true
        };
    }
};

exports.sendMessage = function(socket, id, inputText) {
    genesysHandoff.sendMessage(socket, id, inputText);
};
