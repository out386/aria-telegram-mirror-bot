import constants = require('../.constants');
import regexps = require('./reg_exps');

export class EventRegex {

  readonly commandsRegex: regexps.RegExps;
  readonly commandsRegexNoName: regexps.RegExps;

  constructor() {
    var commands = ['^/start', '^/mirrorTar', '^/mirror', '^/mirrorStatus', '^/list', '^/getFolder', '^/cancelMirror', '^/cancelAll', '^/disk'];
    var commandsNoName: string[] = [];
    var commandAfter = ['$', ' (.+)', ' (.+)', '$', ' (.+)', '$', '$', '$', '$'];

    if (constants.COMMANDS_USE_BOT_NAME && constants.COMMANDS_USE_BOT_NAME.ENABLED) {
      commands.forEach((command, i) => {
        if (command === '^/list') {
          // In case of more than one of these bots in the same group, we want all of them to respond to /list
          commands[i] = command + commandAfter[i];
        } else {
          commands[i] = command + constants.COMMANDS_USE_BOT_NAME.NAME + commandAfter[i];
        }
        commandsNoName.push(this.getNamelessCommand(command, commandAfter[i]));
      });
    } else {
      commands.forEach((command, i) => {
        commands[i] = command + commandAfter[i];
        commandsNoName.push(this.getNamelessCommand(command, commandAfter[i]));
      });
    }

    this.commandsRegex = new regexps.RegExps(commands);
    this.commandsRegexNoName = new regexps.RegExps(commandsNoName);
  }

  private getNamelessCommand(command: string, after: string): string {
    return `(${command}|${command}@[\\S]+)${after}`;
  }
}