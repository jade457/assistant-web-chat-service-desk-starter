import { MessageRequest, MessageResponse } from '../../types/message';
import { User } from '../../types/profiles';
import { ServiceDesk, ServiceDeskFactoryParameters, ServiceDeskStateFromWAC } from '../../types/serviceDesk';
import { AgentProfile, ServiceDeskCallback } from '../../types/serviceDeskCallback';
import { ServicenowSession } from './servicenowTypes';
import { ErrorType } from '../../types/errors';
import { stringToMessageResponseFormat } from '../../utils';
import { SingleEntryPlugin } from 'webpack';



class ServicenowServiceDesk implements ServiceDesk {
  callback: ServiceDeskCallback;
  state: any;

  // will be overwritten with approrpriate user credentials. 
  user: User = { id: 'guest-1'};
  session: ServicenowSession = {clientSessionId: '', currCount: 0, prevCount: 0};
  // session: ServicenowSession = {clientSessionId: '', currCount: 0, prevCount: 0, userToken: window.g_ck, JSESSIONID: xxx};
  agent: AgentProfile = { id: 'liveagent', nickname: 'Live Agent' };

  agentEndedChat: boolean;
  private poller: {stop: boolean};
  private SERVER_BASE_URL: string = process.env.SERVER_BASE_URL || 'http://localhost:3000';

  constructor(parameters: ServiceDeskFactoryParameters) {
    this.callback = parameters.callback;
  }


  async startChat(connectMessage: MessageResponse): Promise<void> {
    console.log("startChat");
    const request = await fetch(`${this.SERVER_BASE_URL}/servicenow/start`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json'},
      body: JSON.stringify({...this.session, username: window.username, email: window.email, name: window.name})
    });

    const response = await request.json();
    if (response.error){
      this.callback.setErrorStatus({ type: ErrorType.DISCONNECTED, isDisconnected: true });
    }else{
      this.session.clientSessionId = response.result.group;
      this.session.currCount = 0;
      this.session.prevCount = 0;
      this.user.id = response.result.opened_by;
      this.startPolling();
    }

    // The before unload event is fired when the window, the document and its resources are about to be unloaded.
    window.addEventListener('unload', (event) => {
      navigator.sendBeacon(`${this.SERVER_BASE_URL}/servicenow/end`, JSON.stringify(this.session)); // https://golb.hplar.ch/2018/09/beacon-api.html
    });
    return Promise.resolve();
  }

  async endChat(): Promise<void> {
    console.log('endChat');
    console.log('this.agentEndedChat: ' + this.agentEndedChat);
    if (this.poller) {
      this.poller.stop = true;
      this.poller = undefined;
    }

    // if user ended the chat 
    if (!this.agentEndedChat){
      const request = await fetch(`${this.SERVER_BASE_URL}/servicenow/end`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...this.session}),
      });
      const status = await request.json();
      console.log(status);

      if (status.error){
        this.callback.setErrorStatus({ type: ErrorType.DISCONNECTED, isDisconnected: true });
      }
    }

    return Promise.resolve();
  }

  async sendMessageToAgent(message: MessageRequest, messageID: string): Promise<void> {
    console.log('sendMessageToAgent')
    const request = await fetch(`${this.SERVER_BASE_URL}/servicenow/sendmessage`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.session, message: message.input.text, label: this.user.id}),
    });
    const response = await request.json();
    console.log(response);

    return Promise.resolve();
  }
  
  updateState?(state: ServiceDeskStateFromWAC): void {
    this.state = state;
  }

  private async startPolling(): Promise<void> {
    console.log("started polling.")
    const poller = { stop: false };
    this.poller = poller;
    let cacheDate = new Date('1900-06-25 16:03:33');
    this.agentEndedChat = false;
    
    do {
      try {
        const request = await fetch(`${this.SERVER_BASE_URL}/servicenow/get`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(this.session)
        });

        

        const output = await request.json();
        this.session.currCount = output.currCount;
        this.session.prevCount = output.prevCount;
        console.log("******FINISHED POST RETRIEVAL REQUEST***********")
        console.log("/servicenow/get output: ");
        console.log(output);
        console.log("currCount: " + output.currCount + ", prevCount: " + output.prevCount);
        console.log("output.status: " + output.status);


        if (output.status){
        switch (output.status) {
          case 'Active':
            this.agent = output.agent;
            this.callback.agentJoined(this.agent);
            break;
          case 'Waiting':
            try {
              const request = await fetch(`${this.SERVER_BASE_URL}/servicenow/queue`, {
                method: 'POST',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify(this.session),
              });
              const output = await request.json();
              console.log('queue: ' + output.queue);
              if (output.queue !== undefined) {
                // Add one since queue value is 0 when there is no line
                //this.callback.updateAgentAvailability({ position_in_queue: output.queue + 1 });
                this.callback.updateAgentAvailability({ position_in_queue: output.queue});
              }
            } catch (error) {
              // Do not stop polling when queue call fails.
              console.error('Unable to retrieve queue information.', error);
            }
            break;
          case 'Disconnected':
            this.agentEndedChat = true;
            this.callback.agentEndedChat();
            poller.stop = true;
            break;
          default:
            break;
        }
      }

      console.log("this.agentEndedChat (polling): " + this.agentEndedChat);

        
        // If there are new messages from agent, relay to user

          if (output.messages?.length > 0) {
            let latestDate = new Date(output.response[0].created_on);
            if (latestDate > cacheDate){
              for (let i = 0; i < output.messages.length; i++) {
                if (new Date(output.response[i].created_on) > cacheDate){
                  if (output.status != 'Disconnected'){
                    this.callback.sendMessageToUser(stringToMessageResponseFormat(output.messages[i]), this.agent.id);
                  }
                }
              }
            }
          }

        cacheDate = new Date(output.response[0].created_on);

      


        if (output.error) {
          this.callback.setErrorStatus({ type: ErrorType.DISCONNECTED, isDisconnected: true });
          poller.stop = true;
        }

        // Set updated chatSessionId as provided by service now - shouldn't change. 
        if (output.clientSessionId) {
          this.session.clientSessionId = output.clientSessionId;
        }
        
      } catch (error) {
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