const loglevel = require('loglevel');
const {MonitorManager} = require('taskcluster-lib-monitor');

MonitorManager.register({
  name: 'matrixSdkDebug',
  title: 'Matrix SDK Debug',
  type: 'matrix-sdk-debug',
  version: 1,
  level: 'debug',
  description: 'Log events from the matrix sdk. Contains arbitrary data from them.',
  fields: {
    message: 'Arbitrary message from matrix sdk.',
    level: 'The level that matrix logged this at. We send all logs to debug no matter what.',
  },
});

MonitorManager.register({
  name: 'matrixForbidden',
  title: 'Matrix Forbidden',
  type: 'matrix-forbidden',
  version: 1,
  level: 'notice',
  description: `We have been rejected from messaging a room. This is expected if the user
                has not invited our client into the room yet but we log it as a notice to
                help debug confused users.`,
  fields: {
    roomId: 'The roomId that we were forbidden from.',
  },
});

class MatrixBot {
  constructor({matrixClient, userId, monitor}) {
    this._userId = userId;
    this._client = matrixClient;
    this._monitor = monitor;

    // matrix-js-sdk insists on logging a bunch of stuff to this logger
    // we will override the methods and stick them all in trace messages
    // for structured logging instead since it also throws errors like normal
    const matrixLog = loglevel.getLogger('matrix');
    matrixLog.methodFactory = (methodName, level, loggerName) => message => {
      this._monitor.log.matrixSdkDebug({level, message});
    };
    matrixLog.setLevel(matrixLog.getLevel()); // This makes the methodFactory stuff work
  }

  async start() {
    this._client.on('RoomMember.membership', async (event, member) => {
      if (member.membership === "invite" && member.userId === this._userId) {
        await this._client.joinRoom(member.roomId);
      }
    });
    await this._client.startClient();
  }

  async sendMessage({roomId, format, formattedBody, body, notice, msgtype}) {
    await this._client.sendEvent(roomId, 'm.room.message', {formatted_body: formattedBody, body, msgtype, format}, '');
  }
}

module.exports = MatrixBot;
