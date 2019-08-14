import constants = require('../.constants');

export class EventRegex {
  readonly start: RegExp;
  readonly mirrorTar: RegExp;
  readonly mirror: RegExp;
  readonly mirrorStatus: RegExp;
  readonly list: RegExp;
  readonly getFolder: RegExp;
  readonly cancelMirror: RegExp;
  readonly cancelAll: RegExp;

  constructor() {
    var commands = ['^/start', '^/mirrorTar', '^/mirror', '^/mirrorStatus', '^/list', '^/getFolder', '^/cancelMirror', '^/cancelAll'];
    var commandAfter = ['$', ' (.+)', ' (.+)', '$', ' (.+)', '$', '$', '$'];

    if (constants.COMMANDS_USE_BOT_NAME && constants.COMMANDS_USE_BOT_NAME.ENABLED) {
      commands.forEach((command, i) => {
        if (command === '^/list') {
          // In case of more than one of these bots in the same group, we want all of them to respond to /list
          commands[i] = command + commandAfter[i];
        } else {
          commands[i] = command + constants.COMMANDS_USE_BOT_NAME.NAME + commandAfter[i];
        }
      });
    } else {
      commands.forEach((command, i) => {
        commands[i] = command + commandAfter[i];
      });
    }

    this.start = new RegExp(commands[0], 'i');
    this.mirrorTar = new RegExp(commands[1], 'i');
    this.mirror = new RegExp(commands[2], 'i');
    this.mirrorStatus = new RegExp(commands[3], 'i');
    this.list = new RegExp(commands[4], 'i');
    this.getFolder = new RegExp(commands[5], 'i');
    this.cancelMirror = new RegExp(commands[6], 'i');
    this.cancelAll = new RegExp(commands[7], 'i');
  }
}