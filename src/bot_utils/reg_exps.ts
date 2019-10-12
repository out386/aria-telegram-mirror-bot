export class RegExps {
  readonly start: RegExp;
  readonly mirrorTar: RegExp;
  readonly mirror: RegExp;
  readonly mirrorStatus: RegExp;
  readonly list: RegExp;
  readonly getFolder: RegExp;
  readonly cancelMirror: RegExp;
  readonly cancelAll: RegExp;
  readonly disk: RegExp;

  constructor(commands: string[]) {
    this.start = new RegExp(commands[0], 'i');
    this.mirrorTar = new RegExp(commands[1], 'i');
    this.mirror = new RegExp(commands[2], 'i');
    this.mirrorStatus = new RegExp(commands[3], 'i');
    this.list = new RegExp(commands[4], 'i');
    this.getFolder = new RegExp(commands[5], 'i');
    this.cancelMirror = new RegExp(commands[6], 'i');
    this.cancelAll = new RegExp(commands[7], 'i');
    this.disk = new RegExp(commands[8], 'i');
  }
}