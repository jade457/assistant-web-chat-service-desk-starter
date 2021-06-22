import { MessageRequest, MessageResponse } from '../../types/message';
import { User } from '../../types/profiles';
import { ServiceDesk, ServiceDeskFactoryParameters, ServiceDeskStateFromWAC } from '../../types/serviceDesk';
import { AgentProfile, ServiceDeskCallback } from '../../types/serviceDeskCallback';
import { ServicenowSession } from './servicenowTypes';
import { ServicenowStatus } from './servicenowStatus';
import { ErrorType } from '../../types/errors';
import { stringToMessageResponseFormat } from '../../utils';
import { SingleEntryPlugin } from 'webpack';



class ServicenowServiceDesk implements ServiceDesk {
  callback: ServiceDeskCallback;
  state: any;
  
  // to-do: look into how to attach a user id to each api request (or client session id)
  user: User;
  session: ServicenowSession;
  agent: AgentProfile = { id: 'liveagent', nickname: 'Live Agent' };
  private poller: {stop: boolean};

  // private SERVER_BASE_URL: string = 'https://harvard-live-chat.mybluemix.net';
  private SERVER_BASE_URL: string = process.env.SERVER_BASE_URL || 'http://localhost:3000';
  
  // private CF_URL: string = '	https://us-south.functions.appdomain.cloud/api/v1/web/Harvard-CF-Org_Harvard%20-%20Service%20Now%20-%20Space/default/virtualagent';

  constructor(parameters: ServiceDeskFactoryParameters) {
    this.callback = parameters.callback;
    this.user = { id: '' };
  }


  async startChat(connectMessage: MessageResponse): Promise<void> {
    console.log('startChat')
    const request = await fetch(`${this.SERVER_BASE_URL}/servicenow/start`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json'},
      body: JSON.stringify({ ...this.session, message: "", label: 'User' }),
    });

    const status = await request.json();
    console.log(status);
    if (status.error){
      this.callback.setErrorStatus({ type: ErrorType.DISCONNECTED, isDisconnected: true });
    }else{
      await this.startPolling(status);
    }

    // The before unload event is fired when the window, the document and its resources are about to be unloaded.
    // window.addEventListener('unload', (event) => {
    //   navigator.sendBeacon(`${this.SERVER_BASE_URL}/incontact/end`, JSON.stringify(this.session)); // https://golb.hplar.ch/2018/09/beacon-api.html
    // });
    return Promise.resolve();
  }

  async endChat(): Promise<void> {
    // Stop polling as we don't want to keep doing it even 
    // if we fail to tell inContact the chat is over. 
    // We'll stop the current poller and clear this so we can get a new poller the next time we start polling.
    console.log('endChat')
    if (this.poller) {
      this.poller.stop = true;
      this.poller = undefined;
    }

    const request = await fetch(`${this.SERVER_BASE_URL}/servicenow/end`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.session, message: '', label: 'User' }),
    });
    await request.json();
    return Promise.resolve();
  }

  async sendMessageToAgent(message: MessageRequest, messageID: string): Promise<void> {
    console.log('sendMessageToAgent')
    const request = await fetch(`${this.SERVER_BASE_URL}/servicenow/sendmessage`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.session, message: message.input.text, label: 'User' }),
    });
    const status = await request.json();
    console.log("MESSAGE STATUS: ");
    console.log(status);

    await this.startPolling(status);
    return Promise.resolve();
  }
  
  updateState?(state: ServiceDeskStateFromWAC): void {
    this.state = state;
  }

  testFunction() {
    

  }

  private async startPolling(status: ServicenowStatus): Promise<void> {
    const poller = { stop: false };
    this.poller = poller;

    if (status.status == 'start') {
      this.callback.agentJoined(this.agent);
    }
    
    do {
      try {
        console.log("polling...")
        const request = await fetch(`${this.SERVER_BASE_URL}/servicenow/messageresponse`, {
          method: 'GET',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
        });

        // eslint-disable-next-line no-await-in-loop
        const output = await request.json();
        //poller.stop = true;
        console.log("SERVICENOW REPSONSE: ");
        console.log(output);

        switch (output.status) {
          case 'posted':
            console.log('case: posted')
            // For production, should change this to load in actual agent profile info
            // investigate what this line means 
            for (let i = 0; i < output.messages.length; i++){
              this.callback.sendMessageToUser(stringToMessageResponseFormat(output.messages[i]), this.agent.id);
            }

            // clear what's at the endpoint by making an empty post request. 
            const request = await fetch(`${this.SERVER_BASE_URL}/servicenow/messageresponse`, {
              method: 'POST',
              headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
              body: JSON.stringify({})
            });

            poller.stop = true;
            break;
          case 'waiting':
            console.log('case: waiting')
            break;
            //break;
          // would this case correspond to takeControl = true field in response? 
          case 'Disconnected':
            console.log('case: disconnected')
            this.callback.agentEndedChat();
            break;
          default:
            break;
        }

        // if (output.error) {
        //   this.callback.setErrorStatus({ type: ErrorType.DISCONNECTED, isDisconnected: true });
        //   poller.stop = true;
        // }

        // // Set updated chatSessionId as provided by service now 
        if (output.clientSessionId) {
          this.session.clientSessionId = output.clientSessionId;
        }

        
        await new Promise(r => setTimeout(r, 1000));
      } catch (error) {
        console.log(error);
        this.callback.setErrorStatus({ type: ErrorType.DISCONNECTED, isDisconnected: true });
        poller.stop = true;
      }
    } while (!poller.stop);

    return Promise.resolve();
  }

   
  // userTyping?(isTyping: boolean): Promise<void> {
  //   throw new Error('Method not implemented.');
  // }
  // userReadMessages?(): Promise<void> {
  //   throw new Error('Method not implemented.');
  // }
  // areAnyAgentsOnline?(connectMessage: MessageResponse): Promise<boolean> {
  //   throw new Error('Method not implemented.');
  // }

}

export { ServicenowServiceDesk };