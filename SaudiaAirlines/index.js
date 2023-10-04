// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
const path = require('path');
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({ path: ENV_FILE });
const fs = require('fs');
const appSettings = require('./settings/appsettings.json');
let appInsightsConnectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
let appInsightsKey = process.env.APPINSIGHTS_INSTRUMENTATIONKEY;

let appInsights = require('applicationinsights');
appInsights.setup(appInsightsConnectionString).start();

appInsights.start();


let cosmosDBEndpoint = process.env.cosmosDBEndpoint;
let DBauthKey = process.env.DBauthKey;



if (DBauthKey) {
  appSettings.runtimeSettings.storage = "CosmosDbPartitionedStorage";
  appSettings.CosmosDbPartitionedStorage.cosmosDBEndpoint = cosmosDBEndpoint;
  appSettings.CosmosDbPartitionedStorage.authKey = DBauthKey;
  fs.writeFileSync('./settings/appsettings.json', JSON.stringify(appSettings, null, 4));
}

appSettings.runtimeSettings.telemetry.options.connectionString=appInsightsConnectionString;
appSettings.runtimeSettings.telemetry.options.instrumentationKey=appInsightsKey;
fs.writeFileSync('./settings/appsettings.json', JSON.stringify(appSettings, null, 4));


const { start } = require('botbuilder-dialogs-adaptive-runtime-integration-express');
// Import required packages


const handoverHelper = require('./genesys-adaptor/handoverHelper');

const cardBuilder = require('./card-builder/cardbuilder');


const restify = require('restify');

// Create HTTP server
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

server.listen(4000, function () {
  console.log(`\n${server.name} listening to url/port ${server.url}`);
});


server.post('/initiateHandoff', async (req, res) => {
  console.log("/initiateHandoff")
  try {
    if (req.body.convRef) {
      let conversationReference = JSON.parse(req.body.convRef);

      console.log(conversationReference.conversation.id)
      const handoverCreator = handoverHelper.createHandoverConnection(
        conversationReference.conversation.id,
        conversationReference,
        req.body.queue,
        req.body.history
      );

      // if (!handoverCreator.new) {
      //     const handoverSocket = handoverCreator.socket;
      //     handoverHelper.sendMessage(handoverSocket, conversationReference.conversation.id, req.body.input);
      // }
    }

  } catch (error) {
    console.log("ERROR CAUGHT")
    console.log(error)
  }


  res.send(200);
});

server.get('/getVariables', async (req, res) => {
  console.log("/getVariables")
  try {
    let response = {
      "directLineToken": process.env.directLineToken,
      "baseUrl": process.env.baseUrl,
      "CLUProjectName": process.env.CLUProjectName,
      "CLUDeploymentName": process.env.CLUDeploymentName,
      "CLUAPIKey": process.env.CLUAPIKey,
      "CLUEndpoint": process.env.CLUEndpoint,
      "baseWebLink": process.env.baseWebLink,
      "OAIEndpoint": process.env.OAIEndpoint,
      "baseBaggageLink": process.env.baseBaggageLink,
      "updateProfileLink": process.env.updateProfileLink,
      "ClientID": process.env.ClientID,
      "ClientSecret": process.env.ClientSecret,
      "ClientScope": process.env.ClientScope
    }
    res.send(response);
  } catch (error) {
    console.log("ERROR CAUGHT")
    console.log(error)
    res.send(error);
  }
});

server.post('/sendMessage', async (req, res) => {
  console.log("/sendMessage")
  try {
    if (req.body.convRef) {
      let conversationReference = JSON.parse(req.body.convRef);
      let inputText = req.body.input
      console.log(conversationReference.conversation.id)
      const handoverCreator = handoverHelper.getHandoverRouter(conversationReference.conversation.id, conversationReference, inputText);

      if (!handoverCreator.new) {
        const handoverSocket = handoverCreator.socket;
        handoverHelper.sendMessage(handoverSocket, conversationReference.conversation.id, inputText);
      }

    }

  } catch (error) {
    console.log("ERROR CAUGHT")
    console.log(error)
  }


  res.send(200);
});

server.post('/cluIntentIdentify', async (req, res) => {
  console.log("/cluIntentIdentify")
  try {
    console.log("BODY -->", req.body.userMessage)
    if (req.body.userMessage) {
      let userMessage = req.body.userMessage;
      intentResponse = await fetch_top_Intent(userMessage)
      console.log("Matches -->", intentResponse)
      if (intentResponse.statusCode == 200) {
        res.send(intentResponse.topIntentName)
      }
      else {
        res.send(400)
      }
    }

  } catch (error) {
    console.log("ERROR CAUGHT")
    console.log(error)
    res.send(400);
  }

});

async function fetch_top_Intent(userMessage) {
  try {
    let cluBody = {
      "kind": "Conversation",
      "analysisInput": {
        "conversationItem": {
          "id": "PARTICIPANT_ID_HERE",
          "text": userMessage,
          "modality": "text",
          "language": "en",
          "participantId": "PARTICIPANT_ID_HERE"
        }
      },
      "parameters": {
        "projectName": process.env.CLUProjectName,
        "verbose": true,
        "deploymentName": process.env.CLUDeploymentName,
        "stringIndexType": "TextElement_V8"
      }
    }
    let options = {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.CLUAPIKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cluBody)
    };

    const fetchRes = await fetch(process.env.CLUEndpoint + "/language/:analyze-conversations?api-version=2022-10-01-preview", options);
    cluIntentRes = await fetchRes.json()
    if (fetchRes.ok) {
      // console.log("Response FOR CLU --->",cluIntentRes)
      intentArray = cluIntentRes.result.prediction.intents
      confidenceThreshold = parseFloat(process.env.confidenceThreshold)
      if (intentArray[0].confidenceScore >= confidenceThreshold && intentArray[0].confidenceScore <= 1.0) {
        topIntentName = intentArray[0].category
      }
      else {
        topIntentName = "Unknown intent"
      }

      return ({
        "statusCode": 200,
        "topIntentName": topIntentName
      })
    }

  }
  catch (error) {
    console.log("ERROR CAUGHT --", error)
    return ({
      "statusCode": 400
    });
  }
}

server.post('/chat', async (req, res) => {
  console.log('/chat')
  console.log(req.body)
  try {
    let gptResponse = await getGPTResponse(req.body);

    if (gptResponse.answer) {
      gptResponse.answer = gptResponse.answer.replace(/\n/g, "\\n");
      // gptResponse.answer = gptResponse.answer.replace(/\b/g, "\\b");
      // gptResponse.answer = gptResponse.answer.replace(/\f/g, "\\f");
      gptResponse.answer = gptResponse.answer.replace(/\r/g, "\\r");
      gptResponse.answer = gptResponse.answer.replace(/\t/g, "\\t");
      gptResponse.answer = gptResponse.answer.replace(/\"/g, "'");
      // gptResponse.answer = gptResponse.answer.replace(/\/g, "\\"");
      // gptResponse.answer = gptResponse.answer.replace(/\\/g, "\\\\");
      // console.log(gptResponse.answer)
    }


    res.send(gptResponse);
  } catch (error) {
    console.log("ERROR CAUGHT")
    console.log(error)
    res.send(error);
  }
});

async function getGPTResponse(req) {

  let gptResponse = await fetch(process.env.OAIEndpoint + '/chat', {
    method: 'POST',
    body: JSON.stringify(req),
    headers: { 'Content-type': 'application/json; charset=UTF-8' },
  });

  gptResponse = await gptResponse.json();

  return gptResponse;
}

server.post('/chats', async (req, res) => {
  console.log('/chats')
  console.log(req.body)
  try {
    let gptResponse = {
      // "answer" : "A stopover visa allows you to extend your layover in Saudi Arabia up to a maximum of 96 hours, giving you the opportunity to explore the country. This can be particularly beneficial if you have a long layover and would prefer to spend that time outside of the airport. You can apply for a stopover visa immediately during the booking process with Saudia Airlines. Here are the steps to book a stopover visa with Saudia:1. Select your international departure and arrival destinations.2. Choose your flights with the most suitable connection time for you, up to a maximum of 96 hours.Please note that if you decide to cancel the visa, there will be no refund for any of the visa fees after issuance. However, you can apply for another visa immediately after canceling the current visa for any reason.For more information, you can visit the Saudia Airlines website: [SAUDIA | Book Flights | Hotels | Holidays Packages](https://www.saudia.com/transit-visa)Did you find this information helpful?",
      // "answer": "A stopover visa allows you to extend your layover in Saudi Arabia up to a maximum of 96 hours, giving you the opportunity to explore the country. This can be particularly beneficial if you have a long layover and would prefer to spend that time outside of the airport. \\n\\nYou can apply for a stopover visa immediately during the booking process with Saudia Airlines. Here are the steps to book a stopover visa with Saudia:\\n\\n1. Select your international departure and arrival destinations.\\n2. Choose your flights with the most suitable connection time for you, up to a maximum of 96 hours.\\n\\nPlease note that if you decide to cancel the visa, there will be no refund for any of the visa fees after issuance. However, you can apply for another visa immediately after canceling the current visa for any reason.\\n\\nFor more information, you can visit the Saudia Airlines website: [SAUDIA | Book Flights | Hotels | Holidays Packages](https://www.saudia.com/transit-visa)\\n\\nDid you find this information helpful?",
      "answer": "A stopover visa allows you to extend your layover in Saudi Arabia up to a maximum of 96 hours, giving you the opportunity to explore the country. This can be particularly beneficial if you have a long layover and would prefer to spend that time outside of the airport. \n\n\nYou can apply for a stopover visa immediately during the booking process with Saudia Airlines. Here are the steps to book a stopover visa with Saudia:\n\n1. Select your international departure and arrival destinations.\n2. Choose your flights with the most suitable connection time for you, up to a maximum of 96 hours.\n\nPlease note that if you decide to cancel the visa, there will be no refund for any of the visa fees after issuance. However, you can apply for another visa immediately after canceling the current visa for any reason.\n\nFor more information, you can visit the Saudia Airlines website: [SAUDIA | Book Flights | Hotels | Holidays Packages](https://www.saudia.com/transit-visa)\n\nDid you find this information helpful?",
      "data_points": [
        "transit_visa.pdf: 3. The applicant can cancel the visa if he refuses to travel, and there will be no refund for any of the visa fees after issuance, with the application of all terms and conditions of Saudi Airlines for airline tickets. 4. You can apply for another visa immediately after canceling the current visa for any reason. 5.",
        "transit_visa.pdf: In cooperation with the Ministry of Foreign Affairs, we have made it possible for you to obtain a stopover visa immediately during the booking process. Steps to book a stopover visa with SAUDIA 1.",
        "transit_visa.pdf: Steps to book a stopover visa with SAUDIA 1. Select your international departure and arrival destinations. 1/6 Send feedback SAUDIA https://www.saudia.com/transit-visa 8/6/23, 10:40 PM SAUDIA | Book Flights | Hotels | Holidays Packages 2. Choose your flights with the most suitable connection time for you, up to a maximum of 96 hours. 3."
      ],
      "thoughts": "string"
    }

    gptResponse = {

      "answer": "عذراً على السوء الفهم. إذا كنت ترغب في إضافة أفراد  عائلتك إلى برنامج الفرسان في الخطوط الجوية \rالسعودية، يمكنك القيام بذلك من\t خلال تسجيلهم كأعضاء عائلة في حسابك الخاص بالفرسان.\n\nلإضافة أفراد العائلة، يرجى اتباع الخطوات التالية:\n\n1. قم بتسجيل الدخول إلى حسابك الخاص بالفرسان على موقع الخطوط الجوية السعودية: https://www.saudia.com/alfursan\n2. انقر على \"إدارة حساب الفرسان\" في القائمة.\n3. انقر على \"إضافة/تعديل أفراد العائلة\" في القائمة الجانبية.\n4. قم بإدخال تفاصيل أفراد عائلتك واتبع التعليمات الموجودة على الشاشة لإتمام الإضافة.\n\nبمجرد إضافة أفراد عائلتك، سيتمكنون من الانضمام إلى برنامج الفرسان وجمع الأميال عند السفر مع الخطوط الجوية السعودية.",
      // "answer": "عذراً على السوء الفهم. إذا كنت ترغب في إضافة أفراد عائلتك إلى برنامج الفرسان في الخطوط الجوية السعودية، يمكنك القيام بذلك من خلال تسجيلهم كأعضاء عائلة في حسابك الخاص بالفرسان.\n\nلإضافة أفراد العائلة، يرجى اتباع الخطوات التالية:\n\n1. قم بتسجيل الدخول إلى حسابك الخاص بالفرسان على موقع الخطوط الجوية السعودية: https://www.saudia.com/alfursan\n2. انقر على \\\"إدارة حساب الفرسان\\\" في القائمة.\n3. انقر على \\\"إضافة/تعديل أفراد العائلة\\\" في القائمة الجانبية.\n4. قم بإدخال تفاصيل أفراد عائلتك واتبع التعليمات الموجودة على الشاشة لإتمام الإضافة.\n\nبمجرد إضافة أفراد عائلتك، سيتمكنون من الانضمام إلى برنامج الفرسان وجمع الأميال عند السفر مع الخطوط الجوية السعودية.",

      "tokens_usage": {

        "completion_tokens": 424,

        "prompt_tokens": 1251,

        "total_tokens": 1675

      }

    }


    res.send(gptResponse);
  } catch (error) {
    console.log("ERROR CAUGHT")
    console.log(error)
    res.send(error);
  }
});

server.post('/getChatHistory', async (req, res) => {
  console.log("/getChatHistory")

  let response = {
    success: false,
    data: ''
  }
  console.log(req.body)


  try {
    let authTokenRes = await getChatHistory(req);

    // console.log(authTokenRes)
    // Need to fix the function
    var botname = process.env.botName

    userMessages = "Initiate Chat";
    botMessages = ""

    let history = []

    authTokenRes['activities'].forEach(function (item, index) {
      if (item.type == 'message') {
        // console.log("MESSAGE FROM -->", item.from.id)
        //Condition to check for Bot Message
        if (item.from.id == botname) { //from bot

          let botMessageString = ""

          if (item["text"] !== undefined) {
            botMessageString += item["text"] + " ";
          }

          if (item["attachments"] !== undefined && item["attachments"].length > 0) {
            item.attachments.forEach(botAttachment => {
              if (botAttachment.content && botAttachment.content.body && botAttachment.content.body.length > 0) {
                botAttachment.content.body.forEach(bodyItem => {
                  if (bodyItem.type == "TextBlock") {
                    botMessageString += bodyItem.text + "\n"
                  } else if (bodyItem.type == "Container") {
                    bodyItem.items.forEach(bodyItemContainerItem => {
                      if (bodyItemContainerItem.type == "TextBlock") {
                        botMessageString += bodyItemContainerItem.text + "\n"
                      }
                    })
                  }
                });
              }
            })
          }

          if (botMessages.length > 0) {
            botMessages = botMessages.concat(" ", botMessageString)
          } else {
            botMessages = botMessageString
          }

          if (
            userMessages.length > 0
            && authTokenRes.activities[index + 1]
            && authTokenRes.activities[index + 1].from.id != botname
          ) {
            history.push({
              user: userMessages,
              bot: botMessages
            });
            userMessages = "";
            botMessages = "";
          }
        } else {//from user
          if (item["text"] !== undefined) {
            if (userMessages.length > 0) {
              userMessages = userMessages.concat(" ", item.text)
            } else {
              userMessages = item.text
            }
          }
        }
      }
    });

    if (req.body.loginState == true || req.body.loginState == 'true') {

      let personalizationPrompt = `I am a ${req.body.tier} tier Al Fursan member with ${req.body.miles} miles`;
      if (req.body.pnrs != '""') {
        personalizationPrompt += ` and I have an upcoming booking with reference ${req.body.pnrs}`
      }
      history.push({
        user: personalizationPrompt,
        bot: ""
      });
    }

    if (userMessages.length > 0) {
      history.push({
        user: userMessages,
        bot: botMessages
      })
    }

    console.log("Final history --->", history);

    response = {
      success: true,
      data: history
    }
    res.send(response);
  }
  catch (error) {
    console.log("ERROR CAUGHT --", error)
    response.error = error
    res.send(response);
  }
});

async function getChatHistory(req) {
  console.log("-- CALLING CHAT HISTORY FUNCTION --")
  try {
    // console.log(req.body)
    if (req.body.convRef) {
      let convRef = JSON.parse(req.body.convRef);
      let conversationId = convRef.conversation.id;
      // console.log(conversationId)
      var accessToken = process.env.directLineToken
      let options = {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        }
      };

      // conversationId = "LMfwHWNo5MmAltSLPAx32v-in"

      const fetchRes = await fetch("https://directline.botframework.com/v3/directline/conversations/" + conversationId + "/activities", options);

      // console.log("fetch response")

      let authTokenRes = await fetchRes.json()


      // authTokenRes = resMock;
      if (authTokenRes.activities) {
        return authTokenRes
      } else {
        console.log(authTokenRes)
        throw authTokenRes;
      }
    }
  }
  catch (error) {
    console.log("ERROR CAUGHT --", error)
    throw error
  }
};

//Update Phone Response

server.post('/updatePhone', async (req, res) => {
  console.log("/updatePhone")
  try {
    if (req.body) {
      if (req.body.contactType.toLowerCase() == 'phone') {
        updatePhoneAPIResp = await updateEmailPhoneFFAPI(req.body, req.headers)
        res.send(updatePhoneAPIResp);
      }
    }
    else {
      res.send({
        "statusCode": 400
      });
    }
  } catch (error) {
    console.log("ERROR CAUGHT", error)
    res.send({
      "statusCode": 400
    });
  }
});

//Update Email Response
server.post('/updateEMail', async (req, res) => {
  console.log("/updateEMail")
  try {
    if (req.body) {
      if (req.body.contactType.toLowerCase() == 'email') {
        updateEmailAPIResp = await updateEmailPhoneFFAPI(req.body, req.headers)
        res.send(updateEmailAPIResp);
      }
    }
    else {
      res.send({
        "statusCode": 400
      });
    }
  } catch (error) {
    console.log("ERROR CAUGHT", error)
    res.send({
      "statusCode": 400
    });
  }
});

server.post('/updateFFDetails', async (req, res) => {
  console.log("/updateFFDetails")
  try {
    if (req.body) {
      if (req.body.contactType.toLowerCase() == 'updatefrequentflyer') {
        updateFFAPIResp = await updateEmailPhoneFFAPI(req.body, req.headers)
        console.log("Response from API --", updateFFAPIResp)
        res.send(updateFFAPIResp);
      }
    }
    else {
      res.send({
        "statusCode": 400
      });
    }
  } catch (error) {
    console.log("ERROR CAUGHT", error)
    res.send({
      "statusCode": 400
    });
  }
});

async function updateEmailPhoneFFAPI(reqBody, reqHeaders) {
  try {

    let authorization = reqHeaders.authorization
    let session_id = reqHeaders.session_id
    let updateURL = reqHeaders.updateurl
    let updateAPIBody = {}

    if (reqBody.contactType.toLowerCase() == 'email') {
      updateAPIBody = {
        "contactType": reqBody.contactType,
        "category": "other",
        "purpose": "standard",
        "address": reqBody.address
      }
    }
    else if (reqBody.contactType.toLowerCase() == 'phone') {
      updateAPIBody = {
        "contactType": reqBody.contactType,
        "category": "other",
        "deviceType": "MOBILE",
        "purpose": "standard",
        "countryPhoneExtension": "91",
        "number": reqBody.number,
        "freeFlowText": reqBody.freeFlowText
      }
    }
    else if (reqBody.contactType.toLowerCase() == 'updatefrequentflyer') {
      updateAPIBody = {
        "frequentFlyerCard": {
          "companyCode": reqBody.companyCode,
          "cardNumber": reqBody.cardNumber,
          "travelerId": reqBody.travelerId
        }
      }
      // console.log("UPDATE api boDY --",updateAPIBody)
    }


    let options = {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
        'SAA-session-id': session_id
      },
      body: JSON.stringify([updateAPIBody])
    };
    const fetchUpdateRes = await fetch(updateURL, options);
    updateRes = await fetchUpdateRes.json()
    console.log("UPDATE RESPONSE --->", updateRes)
    if (fetchUpdateRes.ok) {
      return updateRes
    }
  }
  catch (error) {
    console.log("ERROR CAUGHT --", error)
    return ({
      "statusCode": 400
    });
  }
}

server.post('/buildCard', async (req, res) => {
  console.log("/buildCard")
  let response = {
    success: false,
    data: {}
  }
  try {
    if (!req.body || !req.body.order_res || !req.body.order_res.data || !req.body.order_res.dictionaries) {
      throw "Invalid request"
    }
    let cardData = await cardBuilder.buildCard(req.body.order_res.data, req.body.order_res.dictionaries);
    // let cardData = 'data:image/png;base64,iVBORw0KGgoAAA ANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4 //8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU 5ErkJggg=='

    const buffer = Buffer.from(cardData.substring(cardData.indexOf(',') + 1));
    console.log("Byte length: " + buffer.length);

    response.success = true;
    response.data.sizeInBytes = buffer.length;
    response.data.image = cardData;

    res.send(response);
  } catch (error) {
    console.log("Build Card Error")
    console.log(error)
    response.data = error;
    res.send(response);
  }
});

server.post('/checkTWKNStatus', async (req, res) => {
  try {
    let authorization = req.headers.authorization
    let session_id = req.headers.session_id
    let orderUpdateURL = req.headers.updateurl
    let allDomesticFlight = true
    let TWKNStatus = false
    
    let getOrderOptions = {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
        'SAA-session-id': session_id
      }
    };

    let journeyOptions = {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
        'SAA-session-id': session_id
      }
    };


    const fetchGetOrderRes = await fetch(orderUpdateURL, getOrderOptions);
    orderRes = await fetchGetOrderRes.json()
    // console.log("Order API updateURL --->", updateURL)
    // console.log("Order API RESPONSE --->", orderRes)
    if (fetchGetOrderRes.ok) {
      try {
        const fetchJourneyRes = await fetch(journeyUpdateURL, journeyOptions);
        journeyRes = await fetchJourneyRes.json()

        if (fetchJourneyRes.ok) {
          allDomesticFlight = True
          journeyRes.dictionaries.location.forEach((item) => {
            if (item['countryCode'] != 'SA') {
              allDomesticFlight = false
              throw new Error(allDomesticFlight)
            }
          })
        }
          
      } 
      catch (allDomesticFlight) {
        //Chk for TWKN keyword
        if (allDomesticFlight == true) {
          const specialKey = 'specialKeywords' in orderRes.data;
          if(specialKey) {
              for (i = 0; i < orderRes.data.specialKeywords.length; i++){
                if ((orderRes.data.specialKeywords[i].keyword == 'TWKN' && orderRes.data.specialKeywords[i].freetext != 'CLEAR') && (orderRes.data.specialKeywords[i].keyword == 'YQNK' && (orderRes.data.specialKeywords[i].freetext != 'VERIFIED' || orderRes.data.specialKeywords[i].freetext != 'LINKDOWN' ))){
                  //Setting TWKN to true and block passenger to do CheckIn
                  TWKNStatus = true
                  break
                }
              }
          }
        }
        //International Flight and set TWKN to false and allow passenger to checkIn
        else {
          TWKNStatus = false
        }
      }

      res.send({
        "status": 200,
        "TWKNStatus": TWKNStatus
      });
      
    }
    
    else {
      res.send({
        "status": 400
      });
    }

  }
  catch (error) {
    console.log("ERROR CAUGHT", error)
    res.send({
      "status": 400
    });
  }
});

(async function () {
  try {
    await start(process.cwd(), "settings");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

