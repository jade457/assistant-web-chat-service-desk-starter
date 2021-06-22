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
import express from 'express';
import rateLimit from 'express-rate-limit';
import secure from 'express-secure-only';
import helmet from 'helmet';
import http from 'http';
import nocache from 'nocache';
import R from 'ramda';
import {configParameters} from './config.js';
import {getMessage, postMessage} from './servicenow.js';

const app = express();
//var snMessages = [];
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

// app.post('/servicenow', async (req, res) => {
//   // who makes this request: my application -> POST request -> web server.
//   // ie, handles start, continue, end conversation actions wth live agent. 

//   // callback function here makes post request to servicenow. 
// })

// app.post('/watsonassistant', async (req, res) => {
//   // who makes this request: servicenow -> POST request -> web server.
//   // xxx.bluemix.net/servicenow/response is the configured endpoint of service now.

//   // callback function here to let my application know a response has been posted. 

// })


// // handling servicenow's HTTP post request to /servicenow/response.
// app.post('/servicenow/response', async (req, res)=>{

// })

// app.get('/servicenow/response', async (req, res) => {
//   // who makes this request: my application -> GET request -> web server.
//   // this retrieves what servicenow posted here. 

//   // callback function here to ...? 

// })


// app.post('/servicenow/post', async (req, res) => {
//   const clientSessionId = R.path(['body', 'clientSessionId'], req);
//   const message = R.path(['body', 'message'], req);
//   //const token = R.path(['body', 'token'], req);
//   const label = R.path(['body', 'label'], req);

//   const result = await postMessage("", clientSessionId, label, message, configParameters);
//   if (result.error) {
//     return res.status(result.code).json({ error: result.error });
//   }
//   return res.status(200).json({ post: true });
// });



// SRC: MY APP
app.post('/servicenow/start', async (req, res) => {
  console.log('/servicenow/start: ')
  //callback function to post a message to servicenow to initiate conversation. 
  const clientSessionId = R.path(['body', 'clientSessionId'], req);
  const message = R.path(['body', 'message'], req);
  //const token = R.path(['body', 'token'], req);
  const label = R.path(['body', 'label'], req);

  
  // populate action = AGENT later. 
  const session = await postMessage("END_CONVERSATION", clientSessionId, label, message, configParameters);
  console.log(session);
  if (session.error){
    return res.status(session.code).json(session);
  }
  
  
  //const output = R.mergeDeepRight(session, { token });
  return res.status(200).json({status: 'start'});
});

// SRC: MY APP
app.post('/servicenow/end', async (req, res) => {
  //callback function to post a message to servicenow to terminate conversation. 

  if (typeof req.body === 'string') {
    req.body = JSON.parse(req.body);
  }

  const clientSessionId = R.path(['body', 'clientSessionId'], req);
  const label = R.path(['body', 'label'], req);
  const message = R.path(['body', 'message'], req);
  // const token = R.path(['body', 'token'], req);

  const result = await postMessage("END_CONVERSATION", clientSessionId, label, message, configParameters);
  if (result.error) {
    return res.status(result.code).json({ error: result.error });
  }
  return res.status(200).json({ end: true });
});

// SRC: MY APP
app.post('/servicenow/sendmessage', async (req, res) => {
  //callback function to post a message to servicenow to send a message (continue conversation).
    const clientSessionId = R.path(['body', 'clientSessionId'], req);
    const message = R.path(['body', 'message'], req);
    //const token = R.path(['body', 'token'], req);
    const label = R.path(['body', 'label'], req);

    const result = await postMessage("", clientSessionId, label, message, configParameters);
    if (result.error) {
      return res.status(result.code).json({ error: result.error });
    }
    return res.status(200).json({ post: true });
})

// SRC: SERVICENOW 
app.post('/servicenow/messageresponse', async (req, res) => {
  console.log('POST /servicenow/messageresponse');
  // åconsole.log(req);
   const iterator = {};

   iterator.clientSessionId = req.clientSessionId;
   iterator.messages = req.body.body;
   iterator.userId = req.body.userId;
 
   const messages = [];
 
   for (let i = 0; i < iterator.messages.length; i++){
     let message = iterator.messages[i];
        const servicenow = message;
        const Text = servicenow.uiType === 'OutputText';
        if (Text) {
          messages.push(servicenow.value);
        }
   }
 
     output = {
       status: 'posted',
       clientSessionId: iterator.clientSessionId,
       userId: iterator.userId,
       messages: messages
    }

    
    console.log(output);
   return res.status(200).json(output);
})

// SRC: MY APP
app.get('/servicenow/messageresponse', async (req, res) => {
  console.log("GET /servicenow/messageresponse");
  console.log(output)

  if (output.status){
    if (output.status == 'posted'){
      return res.status(200).json(output);
    }

  } else{
    return res.status(200).json({status: 'waiting'})
  }


})


http.createServer(app).listen(configParameters.app.port, () => {
  console.log(`Worker ${process.pid} is listening to all incoming requests on ${configParameters.app.port} port`);
});
