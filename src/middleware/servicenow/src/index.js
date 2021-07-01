/**
 * (C) Copyright IBM Corp. 2020.
 *
 * Licensed under the MIT License (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 * https://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 *
 */

import bodyParser from 'body-parser';
import compression from 'compression';
import cors from 'cors';
//import { config } from 'dotenv/types';
import express from 'express';
import rateLimit from 'express-rate-limit';
import secure from 'express-secure-only';
import helmet from 'helmet';
// import HtmlWebpackPlugin from 'html-webpack-plugin';
import http from 'http';
import nocache from 'nocache';
import R from 'ramda';
import {configParameters} from './config.js';
import {getMessage, postMessage, startMessage, getQueue} from './servicenow.js';

const app = express();
var output = {};

app.enable('strict routing');
app.enable('trust proxy');

if (process.env.NODE_ENV === 'production') {
  app.use(secure());
}

app.use(cors());
app.use(helmet({ frameguard: false, contentSecurityPolicy: false }));
app.use(compression());
app.use(nocache());
app.use(
  rateLimit({
    windowMs: 60000, // How long in milliseconds to keep records of requests in memory.
    max: 0, // Max number of connections during windowMs milliseconds before sending a 429 response. Set to 0 to disable.
  }),
);
app.use(bodyParser.json());
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({ extended: false }));
// var currCount = 0;
// var prevCount = 0;

app.get('/helloworld', async (req, res) => {
  return res.send("Hello World!");
});


// SRC: MY APP
app.post('/servicenow/start', async (req, res) => {
  console.log('/servicenow/start: ')  
  // retrieve user authentication. 
  // const authorization = await getAuth(configParameters);

  // if (authorization.error) {
  //   return res.status(authorization.code).json({ error: authorization.error });
  // }

  const response = await startMessage(configParameters);
  console.log(response)

  // double check what this would look like. 
  if (response.error){
    return res.status(response.code).json({ error: response.error });
  }

  // currCount = 0;
  // prevCount = 0;

  return res.status(200).json({result: response.result});
});

// SRC: MY APP
app.post('/servicenow/sendmessage', async (req, res) => {
  console.log('/servicenow/sendmessage')
  //callback function to post a message to servicenow to send a message (continue conversation).
    const clientSessionId = R.path(['body', 'clientSessionId'], req);
    const message = R.path(['body', 'message'], req);
    const label = R.path(['body', 'label'], req);

    const response = await postMessage(clientSessionId, message, configParameters);
    if (response.error) {
      return res.status(response.code).json({ error: response.error });
    }
    return res.status(200).json({result: response.result});
})

app.post('/servicenow/get', async (req, res) => {
  console.log('/servicenow/get');
  const clientSessionId = R.path(['body', 'clientSessionId'], req);
  let currCount = R.path(['body', 'currCount'], req);
  let prevCount = R.path(['body', 'prevCount'], req);


  const response = await getMessage(clientSessionId, configParameters);
  if (response.error){
    return res.status(response.code).json({ error: response.error });
  }

  const iterator = {};
  iterator.clientSessionId = clientSessionId;
  iterator.result = response.result;
  
  

  // filter out user messages. 
  iterator.result = iterator.result.filter((message => {
    // not sure if this is the best way to filter messages coming from service desk.
    return message.created_by !== configParameters.servicenow.username;
  }))

  // append all messages. 
  let messages = [];
  for (let i = 0; i < iterator.result.length; i++){
    const servicenow = iterator.result[i];
    messages.push(servicenow.message);
  }

  // determine status of conversation. 
  const initialAgentMsg = 'Hello, how are you doing? I am looking into your question now and will be with you shortly.'
  const endChatRegex = new RegExp('has closed the support session');
  let status = 'Waiting';
  let agent;
  let lastResult = iterator.result[0];
  currCount = messages.length;
  if (lastResult.message == initialAgentMsg && currCount > prevCount){
    status = 'Active';
    agent = {id: lastResult.created_by, nickname: lastResult.sender_name};
  } else if (messages.some(e => endChatRegex.test(e))){
    status = 'Disconnected';
  } else if (messages.includes(initialAgentMsg)) {
    status = '';
  }
  prevCount = currCount;

  const output = {
    clientSessionId: iterator.clientSessionId,
    response: iterator.result,
    messages,
    status,
    agent,
    prevCount,
    currCount
  }
  return res.status(200).json(output);
})

app.post('/servicenow/queue', async (req, res) => {
  const clientSessionId = R.path(['body', 'clientSessionId'], req);
  let queue = 0;

  const output = await getQueue(configParameters);
  if (output.error) {
    return res.status(output.code).json({ error: output.error });
  }

  for (let i = 0; i < output.result.length; i++){
    let queueEntry = output.result[i].queueEntry;
    if (clientSessionId == queueEntry.group){
      queue = R.pathOr(0, ['position'], queueEntry);
    }
  }
  return res.status(200).json({ queue });
});



// SRC: MY APP
app.post('/servicenow/end', async (req, res) => {
  console.log('/servicenow/end');
  //callback function to post a message to servicenow to terminate conversation. 

  // if (typeof req.body === 'string') {
  //   req.body = JSON.parse(req.body);
  // }

  const clientSessionId = R.path(['body', 'clientSessionId'], req);
  // const label = R.path(['body', 'label'], req);
  const message = R.path(['body', 'message'], req);
  // const token = R.path(['body', 'token'], req);

  const result = await postMessage(clientSessionId, message, configParameters);
  console.log(result);
  if (result.error) {
    return res.status(result.code).json({ error: result.error });
  }
  return res.status(200).json({ status: 'end' });
});


http.createServer(app).listen(configParameters.app.port, () => {
  console.log(`Worker ${process.pid} is listening to all incoming requests on ${configParameters.app.port} port`);
});

app.use(function(req, res, next){
  res.setTimeout(10000, function(){
      console.log('Request has timed out.');
          res.send(408);
      });
  next();
});
