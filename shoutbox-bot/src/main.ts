import 'dotenv/config'
import './gunNodePrelude.js'
import { loadBotConfig } from './botConfig.js'
import { useEphemeralGunWorkingDirectory } from './gunCwd.js'
import { defaultRuntimeImpl, startShoutboxRoomBotFromConfig } from './bootstrap.js'

async function main(): Promise<void> {
  const cfg = loadBotConfig(process.env)
  const gunWd = useEphemeralGunWorkingDirectory()
  console.log(`[shoutbox-bot] Gun cwd ${gunWd} (avoids radata under the repo on Windows)`)
  const handle = await startShoutboxRoomBotFromConfig(cfg, defaultRuntimeImpl)

  const shutdown = (): void => {
    void handle.stop().finally(() => {
      process.exit(0)
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

void main()
