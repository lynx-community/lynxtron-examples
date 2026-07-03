export interface Command {
  id: string;
  label: string;
  keybinding?: string;
  execute: () => void | Promise<void>;
  when?: () => boolean;
}

const commands: Command[] = [];

export function registerCommand(cmd: Command): void {
  const existing = commands.findIndex(c => c.id === cmd.id);
  if (existing >= 0) commands[existing] = cmd;
  else commands.push(cmd);
}

export function getVisibleCommands(): Command[] {
  return commands.filter(cmd => !cmd.when || cmd.when());
}

export function executeCommand(id: string): void {
  const cmd = commands.find(c => c.id === id);
  if (cmd) cmd.execute();
}

export function filterCommands(query: string): Command[] {
  const q = query.toLowerCase();
  return getVisibleCommands().filter(cmd =>
    cmd.label.toLowerCase().includes(q)
  );
}
