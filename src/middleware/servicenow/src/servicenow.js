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

import axios from 'axios';
import R from 'ramda';

function populateBody(options){
  const body = {
      action: options.action,
      userId: options.userId,
      requestId: options.requestId,
      clientSessionId: options.clientSessionId, 
      silentMessage: options.silentMessage,
      message: {
        clientMessageId: options.clientMessageId,
        typed: options.typed,
        text: options.text
    }}
  return JSON.stringify(body);
}



async function makeRequest(options) {
  return new Promise((resolve) => {
    axios(options)
      .then((output) => {
        return resolve(R.path(['data'], output));
      })
      .catch((output) => {
        const code = R.pathOr(500, ['response', 'status'], output);
        const error = R.pathOr('Internal Server Error', ['response', 'statusText'], output);
        return resolve({ error, code });
      });
  });
}

const getSession = (token, config) => {
  return new Promise((resolve) => {
    const options = {
      method: 'POST',
      url: `${config.incontact.apiUri}/inContactAPI/services/${config.incontact.version}/contacts/chats`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        pointOfContact: config.incontact.pointOfContact,
        parameters: ['P1', config.incontact.skill, 'P3', 'P4'],
        mediaType: 3,
      },
      responseType: 'json',
    };

    makeRequest(options).then((output) => {
      return resolve(output);
    });
  });
};

const startMessage = (config) => {
  const authentication = Buffer.from(config.servicenow.username+':'+config.servicenow.password).toString('base64')
  return new Promise((resolve) => {
    const options = {
      method: 'POST',
      url: `${config.servicenow.apiUri}/api/now/connect/support/queues/${config.servicenow.queueId}/sessions`,
      headers: {
        Authorization: 'Basic '+authentication,
        Accept: 'application/json', 'Content-Type': 'application/json',
        // 'X-UserToken': userToken,
        // Cookie: 'JSESSIONID='+JSESSIONID
      },
      // dummy phrase - eventually pass in what user typed in the WA widget. 
      data: JSON.stringify({message: 'start live agent conversation'})
    }

    makeRequest(options).then((output) => {
      return resolve(output);
    })
  })
}

const getMessage = (clientSessionId, config) => {
  const authentication = Buffer.from(config.servicenow.username+':'+config.servicenow.password).toString('base64');
  const group_id = clientSessionId;
  return new Promise((resolve) => {
    const options = {
      method: 'GET',
      url: `${config.servicenow.apiUri}/api/now/connect/conversations/${group_id}/messages`,
      headers: {
        Authorization: 'Basic '+ authentication,
        Accept: 'application/json', 'Content-Type': 'application/json'
      }
    };

    makeRequest(options).then((output) => {
      return resolve(output);
    });
  });
};

const postMessage = (clientSessionId, message, config) => {
  const group_id = clientSessionId;
  const authentication = Buffer.from(config.servicenow.username+':'+config.servicenow.password).toString('base64')
  return new Promise((resolve) => {
    const options = {
      method: 'POST',
      url: `${config.servicenow.apiUri}/api/now/connect/conversations/${group_id}/messages`,
      headers: {
        Authorization: 'Basic '+authentication,
        Accept: 'application/json', 'Content-Type': 'application/json'
      },
      data: JSON.stringify({message: message})
    };

    makeRequest(options).then((output) => {
      return resolve(output);
    });
  });
};

const endSession = (clientSessionId, config) => {
  const group_id = clientSessionId;
  const authentication = Buffer.from(config.servicenow.username+':'+config.servicenow.password).toString('base64')
  return new Promise((resolve) => {
    const options = {
      method: 'POST',
      url: `${config.servicenow.apiUri}/api/now/connect/support/sessions/${group_id}/leave`,
      headers: {
        Authorization: 'Basic '+authentication,
        Accept: 'application/json', 'Content-Type': 'application/json'
      },
      data: JSON.stringify({})
    };

    makeRequest(options).then((output) => {
      return resolve(output);
    });
  });
};

const getQueue = async (config) => {
  const authentication = Buffer.from(config.servicenow.username+':'+config.servicenow.password).toString('base64')
  return new Promise((resolve) => {
    const options = {
      method: 'GET',
      url: `${config.servicenow.apiUri}/api/now/connect/support/queues/${config.servicenow.queueId}/sessions`,
      headers: {
        Authorization: 'Basic '+authentication,
        Accept: 'application/json', 'Content-Type': 'application/json'
      }
    };

    makeRequest(options).then((output) => {
      return resolve(output);
    });
  });
};

const getAuth = (config) => {
  return new Promise((resolve) => {
    const options = {
      method: 'POST',
      url: `${config.incontact.accessKeyApiUri}/authentication/v1/token/access-key`,
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        accessKeyId: config.incontact.accessKeyId,
        accessKeySecret: config.incontact.accessKeySecret,
      },
      responseType: 'json',
    };

    makeRequest(options).then((output) => {
      return resolve(output);
    });
  });
};

export {postMessage, getMessage, startMessage, getQueue, endSession}
