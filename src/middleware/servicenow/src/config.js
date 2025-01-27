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

// import { config } from 'dotenv';
import pkg from 'dotenv';
const { config } = pkg;

const { parsed } = config();

const configParameters = {
  servicenow: {
    accessKeyId: parsed.INCONTACT_ACCESS_KEY_ID,
    accessKeySecret: parsed.INCONTACT_ACCESS_KEY_SECRET,
    accessKeyApiUri: parsed.INCONTACT_ACCESS_KEY_API_URI,
    apiUri: parsed.SERVICENOW_API_URI,
    pointOfContact: parsed.INCONTACT_POINTOFCONTACT,
    skillId: parsed.INCONTACT_SKILL,
    version: parsed.INCONTACT_VERSION || 'v20.0',
    queueId: '19bc32ec1bfd37405d22419ead4bcb57',
    username: 'ibmwatson',
    password: 'ndD4TwyubHgf'
  },
  app: {
    port: process.env.PORT || 3000,
  },
};

export {configParameters}
