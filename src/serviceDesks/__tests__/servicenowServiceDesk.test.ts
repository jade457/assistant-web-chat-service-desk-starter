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

import { EXAMPLE_CONNECT_MESSAGE, EXAMPLE_SERVICE_DESK_FACTORY_PARAMETERS } from '../../testHelpers';
import { ServiceDeskFactoryParameters } from '../../types/serviceDesk';
import { ExampleServiceDesk } from '../exampleServiceDesk';
import { ServicenowServiceDesk } from '../servicenow/servicenowServiceDesk';

describe('./src/exampleServiceDesk.ts', () => {
  it('successfully initializes the exampleServiceDesk and starts a chat', async () => {
    const params: ServiceDeskFactoryParameters = EXAMPLE_SERVICE_DESK_FACTORY_PARAMETERS();
    const serviceDesk = new ServicenowServiceDesk(params);
    await serviceDesk.startChat(EXAMPLE_CONNECT_MESSAGE());
    expect(serviceDesk.agent.id).toBe('jim');
  });
});
